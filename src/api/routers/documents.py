from fastapi import APIRouter, UploadFile, File, BackgroundTasks, Depends, HTTPException
from sqlalchemy.future import select
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
import os
import shutil
import uuid
import google.generativeai as genai
from typing import List

from src.core.database import get_db, DocumentModel, qdrant_client, async_session
from src.core.config import settings
from src.pipeline.schemas import DocumentResponse, QueryRequest, QueryResponse, Citation
from src.pipeline.parser import DocumentParser
from src.pipeline.extractor import AIExtractor

router = APIRouter()

# Local upload directory setup
UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

async def background_process_document(document_id: str, file_path: str, filename: str):
    """Asynchronous background worker execution to parse and index documents."""
    try:
        # 1. Parse PDF pages and layout headings
        chunks = DocumentParser.parse_pdf(file_path)
        
        # 2. Extract structured schemas and index to Qdrant Vector database
        extractor = AIExtractor()
        await extractor.process_and_index_document(document_id, filename, chunks)
        
        # Clean up local temp file
        if os.path.exists(file_path):
            os.remove(file_path)
            
    except Exception as e:
        # Set state to FAILED and log error message
        async with async_session() as session:
            await session.execute(
                update(DocumentModel)
                .where(DocumentModel.id == document_id)
                .values(
                    status="FAILED",
                    error_message=str(e)
                )
            )
            await session.commit()
        if os.path.exists(file_path):
            os.remove(file_path)

@router.post("/documents/upload", response_model=DocumentResponse, status_code=202)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Uploads a PDF manual and kicks off async layout parsing and vector indexing."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    # Save the file temporarily
    temp_id = str(uuid.uuid4())
    temp_filename = f"{temp_id}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, temp_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Create DB entity
    doc_record = DocumentModel(
        id=temp_id,
        filename=file.filename,
        status="PROCESSING"
    )
    db.add(doc_record)
    await db.commit()
    await db.refresh(doc_record)
    
    # Enqueue background task
    background_tasks.add_task(
        background_process_document,
        doc_record.id,
        file_path,
        doc_record.filename
    )
    
    return doc_record

@router.get("/documents", response_model=List[DocumentResponse])
async def list_documents(db: AsyncSession = Depends(get_db)):
    """Lists all uploaded documents and their structured extraction status."""
    result = await db.execute(select(DocumentModel).order_by(DocumentModel.created_at.desc()))
    return result.scalars().all()

@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str, db: AsyncSession = Depends(get_db)):
    """Gets details and structured consolidated metadata of a single document."""
    result = await db.execute(select(DocumentModel).where(DocumentModel.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc

@router.post("/query", response_model=QueryResponse)
async def query_rag(request: QueryRequest):
    """
    RAG endpoint that searches across chunks in Qdrant,
    synthesizes answers, and verifies source citations.
    """
    extractor = AIExtractor()
    
    # 1. Embed query
    query_vector = await extractor.get_embedding(request.query)
    
    # 2. Retrieve top-3 chunks from Qdrant vector database
    collection_name = "docustruct_chunks"
    
    # Optional filter criteria
    query_filter = None
    if request.document_id:
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        query_filter = Filter(
            must=[
                FieldCondition(
                    key="document_id",
                    match=MatchValue(value=request.document_id)
                )
            ]
        )

    try:
        hits = await qdrant_client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            query_filter=query_filter,
            limit=3
        )
    except Exception as e:
        # Fallback if Qdrant isn't fully operational
        raise HTTPException(status_code=503, detail=f"Vector search failed: {e}")

    if not hits:
        return QueryResponse(
            query=request.query,
            answer="No relevant context could be found to answer this question.",
            citations=[]
        )

    # 3. Format Context and extract citations
    context_blocks = []
    citations = []
    
    for hit in hits:
        p = hit.payload
        context_blocks.append(
            f"Page {p['page_number']} | Section: {p['section_header']}\nContent: {p['text']}"
        )
        citations.append(Citation(
            source_chunk_id=str(hit.id),
            page_number=p['page_number'],
            text_segment=p['text'][:200] + "..."
        ))
        
    context_str = "\n\n---\n\n".join(context_blocks)
    
    # 4. Generate synthesized response from Gemini model
    prompt = f"""
    You are an advanced AI technical support specialist. Answer the user query using ONLY the provided document context blocks.
    If the context does not contain the answer, state "I cannot find the answer in the provided documents."
    Support your answer with clear descriptions.
    
    User Query: {request.query}
    
    Document Context:
    {context_str}
    """
    
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(settings.GEMINI_MODEL)
        
        # Use sync execution wrapper inside event loop
        import asyncio
        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(
            None,
            lambda: model.generate_content(prompt)
        )
        answer = response.text
    except Exception as e:
        if not settings.GEMINI_API_KEY or "api key" in str(e).lower():
            answer = "API Key not configured. (Mock response: Matching context found on pages " + ", ".join(str(c.page_number) for c in citations) + ")"
        else:
            raise HTTPException(status_code=500, detail=f"LLM generation failed: {e}")

    return QueryResponse(
        query=request.query,
        answer=answer,
        citations=citations
    )
