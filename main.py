"""
LangGraph Legal Assistant Backend
FastAPI server for handling legal document workflows with persistent context
"""

import os
import logging
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
import asyncio

from workflows.legal_workflow_engine import LegalWorkflowEngine, process_message
from models.conversation_models import (
    ConversationRequest, 
    ConversationResponse, 
    WorkflowState,
    DocumentGenerationRequest,
    DocumentGenerationResponse
)
from tools.conversation_store import ConversationStore
from tools.document_generator import DocumentGenerator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
class Settings(BaseSettings):
    """Application settings from environment variables"""
    
    # API Configuration
    openai_api_key: str = Field(..., env="OPENAI_API_KEY")
    langsmith_api_key: Optional[str] = Field(None, env="LANGSMITH_API_KEY")
    
    # Database Configuration
    postgres_url: Optional[str] = Field(None, env="DATABASE_URL")
    redis_url: Optional[str] = Field(None, env="REDIS_URL")
    
    # Vector Database
    qdrant_url: Optional[str] = Field(None, env="QDRANT_URL")
    qdrant_api_key: Optional[str] = Field(None, env="QDRANT_API_KEY")
    
    # Application Settings
    debug: bool = Field(False, env="DEBUG")
    cors_origins: str = Field("*", env="CORS_ORIGINS")
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Global instances
settings = Settings()
workflow_engine: Optional[LegalWorkflowEngine] = None
conversation_store: Optional[ConversationStore] = None
document_generator: Optional[DocumentGenerator] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    global workflow_engine, conversation_store, document_generator
    
    logger.info("🚀 Starting LangGraph Legal Assistant Backend...")
    
    # Initialize core services
    try:
        # Initialize conversation store
        conversation_store = ConversationStore(
            redis_url=settings.redis_url,
            postgres_url=settings.postgres_url
        )
        await conversation_store.initialize()
        logger.info("✅ Conversation store initialized")
        
        # Initialize document generator
        document_generator = DocumentGenerator()
        await document_generator.initialize()
        logger.info("✅ Document generator initialized")
        
        # Initialize workflow engine
        workflow_engine = LegalWorkflowEngine(
            openai_api_key=settings.openai_api_key,
            conversation_store=conversation_store,
            document_generator=document_generator,
            debug=settings.debug
        )
        await workflow_engine.initialize()
        logger.info("✅ LangGraph workflow engine initialized")
        
        logger.info("🎉 LangGraph Legal Assistant Backend ready!")
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize backend: {e}")
        raise
    
    yield
    
    # Cleanup
    logger.info("🔄 Shutting down LangGraph Legal Assistant Backend...")
    if conversation_store:
        await conversation_store.close()
    logger.info("✅ Backend shutdown complete")

# Create FastAPI app
app = FastAPI(
    title="LangGraph Legal Assistant",
    description="AI-powered legal document generation and consultation",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get workflow engine
async def get_workflow_engine() -> LegalWorkflowEngine:
    if workflow_engine is None:
        raise HTTPException(status_code=503, detail="Workflow engine not initialized")
    return workflow_engine

# Dependency to get conversation store
async def get_conversation_store() -> ConversationStore:
    if conversation_store is None:
        raise HTTPException(status_code=503, detail="Conversation store not initialized")
    return conversation_store

# API Routes

@app.get("/")
async def health_check():
    """Health check endpoint"""
    return {
        "service": "LangGraph Legal Assistant Backend",
        "status": "operational",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    checks = {
        "workflow_engine": workflow_engine is not None,
        "conversation_store": conversation_store is not None,
        "document_generator": document_generator is not None
    }
    
    all_healthy = all(checks.values())
    
    return {
        "status": "healthy" if all_healthy else "unhealthy",
        "checks": checks,
        "timestamp": asyncio.get_event_loop().time()
    }

@app.post("/api/conversation/process")
async def process_conversation(request: ConversationRequest) -> ConversationResponse:
    """Process a conversation message through LangGraph workflows"""
    try:
        return process_message(request)
    except Exception as e:
        if settings.debug:
            raise
        raise HTTPException(
            status_code=500,
            detail=f"Error processing message: {str(e)}"
        )

@app.get("/api/conversation/{conversation_id}/state", response_model=WorkflowState)
async def get_conversation_state(
    conversation_id: int,
    store: ConversationStore = Depends(get_conversation_store)
) -> WorkflowState:
    """Get current workflow state for a conversation"""
    try:
        state = await store.get_conversation_state(conversation_id)
        if not state:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return state
        
    except Exception as e:
        logger.error(f"❌ Error getting conversation state: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting state: {str(e)}")

@app.post("/api/conversation/{conversation_id}/reset")
async def reset_conversation(
    conversation_id: int,
    store: ConversationStore = Depends(get_conversation_store)
):
    """Reset conversation state to start over"""
    try:
        await store.reset_conversation(conversation_id)
        return {"status": "reset", "conversation_id": conversation_id}
        
    except Exception as e:
        logger.error(f"❌ Error resetting conversation: {e}")
        raise HTTPException(status_code=500, detail=f"Error resetting conversation: {str(e)}")

@app.post("/api/document/generate", response_model=DocumentGenerationResponse)
async def generate_document(
    request: DocumentGenerationRequest,
    engine: LegalWorkflowEngine = Depends(get_workflow_engine)
) -> DocumentGenerationResponse:
    """Generate a legal document directly (for testing/admin)"""
    try:
        response = await engine.generate_document_direct(request)
        return response
        
    except Exception as e:
        logger.error(f"❌ Error generating document: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating document: {str(e)}")

@app.get("/api/conversation/{conversation_id}/history")
async def get_conversation_history(
    conversation_id: int,
    limit: int = 50,
    store: ConversationStore = Depends(get_conversation_store)
):
    """Get conversation message history"""
    try:
        history = await store.get_conversation_history(conversation_id, limit)
        return {"conversation_id": conversation_id, "messages": history}
        
    except Exception as e:
        logger.error(f"❌ Error getting conversation history: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting history: {str(e)}")

@app.get("/api/debug/workflows")
async def debug_workflows(
    engine: LegalWorkflowEngine = Depends(get_workflow_engine)
):
    """Debug endpoint to see available workflows"""
    if not settings.debug:
        raise HTTPException(status_code=404, detail="Debug endpoints disabled")
    
    return {
        "available_workflows": engine.get_available_workflows(),
        "workflow_states": engine.get_workflow_states()
    }

# Error handlers
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": "internal_error"}
    )

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=settings.debug,
        log_level="info" if not settings.debug else "debug"
    ) 