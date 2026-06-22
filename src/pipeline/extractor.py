import google.generativeai as genai
from typing import List, Dict, Any
import json
import asyncio
from qdrant_client.models import PointStruct, VectorParams, Distance
from src.core.config import settings
from src.core.database import qdrant_client, async_session, DocumentModel
from src.pipeline.schemas import StructuredDocumentExtraction
from sqlalchemy import update

class AIExtractor:
    """Service to handle Gemini structured extraction and Qdrant vector indexing."""
    
    def __init__(self):
        # Configure Gemini API client
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.extraction_model = genai.GenerativeModel(settings.GEMINI_MODEL)
        self.embedding_model = "models/text-embedding-004"

    async def get_embedding(self, text: str) -> List[float]:
        """Generates semantic text embeddings using Gemini's text-embedding-004 model."""
        # Wrap the sync call in an executor to avoid blocking the async event loop
        loop = asyncio.get_running_loop()
        try:
            response = await loop.run_in_executor(
                None,
                lambda: genai.embed_content(
                    model=self.embedding_model,
                    content=text,
                    task_type="retrieval_document"
                )
            )
            return response["embedding"]
        except Exception as e:
            # Fallback mock embedding if API key is invalid/missing (e.g. for testing)
            if not settings.GEMINI_API_KEY or "api key" in str(e).lower():
                # Return standard dimension-768 mock vector
                return [0.0] * 768
            raise e

    async def extract_structured_data(self, text: str, page_number: int, section_header: str) -> StructuredDocumentExtraction:
        """Extracts structured entities, relationships, tables, and summary from text."""
        prompt = f"""
        You are a senior AI data extraction agent. Extract structured information from the following page text:
        
        Metadata:
        - Page: {page_number}
        - Section: {section_header}
        
        Text Content:
        {text}
        """

        loop = asyncio.get_running_loop()
        try:
            response = await loop.run_in_executor(
                None,
                lambda: self.extraction_model.generate_content(
                    prompt,
                    generation_config=genai.GenerationConfig(
                        response_schema=StructuredDocumentExtraction,
                        temperature=0.1
                    )
                )
            )
            # Parse response back to Pydantic object
            data = json.loads(response.text)
            return StructuredDocumentExtraction(**data)
        except Exception as e:
            # Fallback if API key is not configured or errors occur
            if not settings.GEMINI_API_KEY or "api key" in str(e).lower():
                return StructuredDocumentExtraction(
                    summary="Mock summary (API Key not configured)",
                    entities=[],
                    relationships=[],
                    tables=[]
                )
            raise e

    async def process_and_index_document(self, document_id: str, filename: str, chunks: List[Dict[str, Any]]):
        """Processes chunks, generates embeddings, performs AI extraction, and indexes all metadata."""
        collection_name = "docustruct_chunks"
        
        # 1. Ensure Qdrant collection exists
        # 768 is the default dimension size for Gemini's text-embedding-004
        try:
            collections = await qdrant_client.get_collections()
            exist = any(c.name == collection_name for c in collections.collections)
            if not exist:
                await qdrant_client.create_collection(
                    collection_name=collection_name,
                    vectors_config=VectorParams(size=768, distance=Distance.COSINE)
                )
        except Exception as e:
            print(f"Failed to verify/create Qdrant collection: {e}")

        all_extractions = []
        points = []

        # 2. Process each chunk
        for i, chunk in enumerate(chunks):
            page_num = chunk["page_number"]
            sec_header = chunk["section_header"]
            text_content = chunk["text"]

            # AI Extract & Embed tasks
            extracted_task = self.extract_structured_data(text_content, page_num, sec_header)
            embedding_task = self.get_embedding(text_content)
            
            extracted, embedding = await asyncio.gather(extracted_task, embedding_task)
            
            all_extractions.append(extracted.model_dump())

            # Prepare Qdrant point index
            point_id = f"{document_id}-{page_num}"
            points.append(PointStruct(
                id=hash(point_id) % (2**63 - 1),  # Convert string pair to 64-bit int for Qdrant compatibility
                vector=embedding,
                payload={
                    "document_id": document_id,
                    "filename": filename,
                    "page_number": page_num,
                    "section_header": sec_header,
                    "text": text_content,
                    "summary": extracted.summary
                }
            ))

        # 3. Write points to Qdrant
        if points:
            await qdrant_client.upsert(
                collection_name=collection_name,
                points=points
            )

        # 4. Consolidate extracted data (summarize entities and relationships)
        consolidated = {
            "num_pages": len(chunks),
            "chapters": list(set(c["section_header"] for c in chunks)),
            "all_extracted_entities": [e for chunk in all_extractions for e in chunk["entities"]],
            "all_extracted_relationships": [r for chunk in all_extractions for r in chunk["relationships"]]
        }

        # 5. Update Postgres Database status
        async with async_session() as session:
            await session.execute(
                update(DocumentModel)
                .where(DocumentModel.id == document_id)
                .values(
                    status="COMPLETED",
                    extracted_data=consolidated
                )
            )
            await session.commit()
