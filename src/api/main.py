from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.core.config import settings
from src.core.database import init_databases
from src.api.routers import documents

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="DocuStruct: Agentic Document Ingestion & Structured Knowledge Graph Engine",
    version="1.0.0",
)

# Enable CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup hook to prepare database schemas
@app.on_event("startup")
async def startup_event():
    await init_databases()

# Include routing
app.include_router(
    documents.router,
    prefix="/api/v1",
    tags=["documents"]
)

@app.get("/")
def read_root():
    return {
        "app": settings.PROJECT_NAME,
        "status": "online",
        "documentation": "/docs"
    }
