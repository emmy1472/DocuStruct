from pydantic import BaseModel, Field
from datetime import datetime

# --- Relational / API Schemas ---

class DocumentResponse(BaseModel):
    id: str
    filename: str
    status: str
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime
    extracted_data: dict | None = None

    class Config:
        from_attributes = True

class QueryRequest(BaseModel):
    query: str
    document_id: str | None = None  # Optional filter by document

class Citation(BaseModel):
    source_chunk_id: str
    page_number: int
    text_segment: str

class QueryResponse(BaseModel):
    query: str
    answer: str
    citations: list[Citation] = []


# --- Agentic Extraction Schemas ---

class Entity(BaseModel):
    name: str = Field(..., description="The name of the entity, e.g., 'CoreProcessor', 'ACME System'")
    type: str = Field(..., description="The category/type of entity, e.g., Component, Protocol, Rule, Person")
    description: str = Field(..., description="Detailed explanation of what this entity is and its role in the manual")

class Relationship(BaseModel):
    source: str = Field(..., description="The name of the source entity")
    target: str = Field(..., description="The name of the target entity")
    type: str = Field(..., description="The verb/relationship type, e.g., 'configures', 'depends_on', 'inherits'")
    description: str = Field(..., description="Contextual explanation of why they are related")

class TableRow(BaseModel):
    columns: dict[str, str] = Field(..., description="Key-value representation of row headers and cells")

class ExtractedTable(BaseModel):
    title: str = Field(..., description="Constructed title of the table based on surrounding context")
    headers: list[str] = Field(..., description="List of columns headers")
    rows: list[TableRow] = Field(..., description="The parsed content of each row")

class StructuredDocumentExtraction(BaseModel):
    summary: str = Field(..., description="A high-level summary of the document chunk")
    entities: list[Entity] = Field(default_factory=list, description="All key entities mentioned in the chunk")
    relationships: list[Relationship] = Field(default_factory=list, description="All semantic connections between entities")
    tables: list[ExtractedTable] = Field(default_factory=list, description="Any tabular data extracted from this chunk")
