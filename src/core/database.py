from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Text, DateTime, JSON
from datetime import datetime
import uuid
from qdrant_client import AsyncQdrantClient
from src.core.config import settings

# 1. PostgreSQL Asynchronous Engine & Session
engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def get_db():
    async with async_session() as session:
        yield session

# Declarative base for SQLAlchemy models
class Base(DeclarativeBase):
    pass

# Relational Model for Document Tracking
class DocumentModel(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="PENDING")  # PENDING, PROCESSING, COMPLETED, FAILED
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Store the extracted structured data summary directly
    extracted_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

# 2. Qdrant Client Setup
qdrant_client = AsyncQdrantClient(
    url=settings.QDRANT_URL,
    api_key=settings.QDRANT_API_KEY
)

async def init_databases():
    """Initializes schema in Postgres and verifies Qdrant connection."""
    # Create Postgres tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    # Verify Qdrant connection
    try:
        await qdrant_client.get_collections()
    except Exception as e:
        print(f"Warning: Qdrant connection failed: {e}")
