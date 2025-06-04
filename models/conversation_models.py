"""
Conversation Models for LangGraph Legal Assistant
Defines all data structures for API communication
"""

from typing import Dict, Any, List, Optional, Union, Literal
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum

# Workflow State Enums
class WorkflowStateEnum(str, Enum):
    """Possible workflow states"""
    IDLE = "idle"
    ANALYZING_INTENT = "analyzing_intent"
    COLLECTING_REQUIREMENTS = "collecting_requirements"
    VALIDATING_REQUIREMENTS = "validating_requirements"
    GENERATING_DOCUMENT = "generating_document"
    REVIEWING_DOCUMENT = "reviewing_document"
    PROVIDING_ADVICE = "providing_advice"
    COMPLETED = "completed"
    ERROR = "error"

class DocumentType(str, Enum):
    """Supported document types"""
    NDA = "nda"
    SERVICE_AGREEMENT = "service_agreement"
    EMPLOYMENT_CONTRACT = "employment_contract"
    PRIVACY_POLICY = "privacy_policy"
    TERMS_OF_SERVICE = "terms_of_service"
    FREELANCER_AGREEMENT = "freelancer_agreement"

class UserIntent(str, Enum):
    """User intent classifications"""
    DOCUMENT_GENERATION = "document_generation"
    LEGAL_CONSULTATION = "legal_consultation"
    DOCUMENT_REVIEW = "document_review"
    INFORMATION_REQUEST = "information_request"
    FOLLOW_UP = "follow_up"
    GENERAL_INQUIRY = "general_inquiry"

# Request Models
class ConversationRequest(BaseModel):
    """Request to process a conversation message"""
    conversation_id: int = Field(..., description="Unique conversation identifier")
    user_id: int = Field(..., description="User identifier")
    message: str = Field(..., description="User message content")
    message_type: Optional[str] = Field("text", description="Type of message")
    
    # Context and metadata
    context: Optional[Dict[str, Any]] = Field(None, description="Additional context")
    session_id: Optional[str] = Field(None, description="Session identifier")
    
    class Config:
        json_schema_extra = {
            "example": {
                "conversation_id": 123,
                "user_id": 456,
                "message": "I need an NDA for my startup",
                "message_type": "text"
            }
        }

class DocumentGenerationRequest(BaseModel):
    """Direct document generation request"""
    document_type: DocumentType = Field(..., description="Type of document to generate")
    parameters: Dict[str, Any] = Field(..., description="Document parameters")
    user_id: Optional[int] = Field(None, description="User identifier")
    conversation_id: Optional[int] = Field(None, description="Associated conversation")
    
    class Config:
        json_schema_extra = {
            "example": {
                "document_type": "nda",
                "parameters": {
                    "parties": ["Alice Corp", "Bob Ltd"],
                    "duration": "2 years",
                    "purpose": "business partnership discussions"
                }
            }
        }

# Response Models
class SuggestedAction(BaseModel):
    """Suggested action for the user"""
    type: str = Field(..., description="Action type")
    title: str = Field(..., description="Action title")
    description: str = Field(..., description="Action description")
    priority: Literal["low", "medium", "high"] = Field(..., description="Action priority")
    parameters: Optional[Dict[str, Any]] = Field(None, description="Action parameters")

class FollowUpQuestion(BaseModel):
    """Follow-up question for the user"""
    id: str = Field(..., description="Question identifier")
    question: str = Field(..., description="Question text")
    type: Literal["text", "select", "multiselect", "date", "number"] = Field(..., description="Question type")
    options: Optional[List[str]] = Field(None, description="Options for select questions")
    required: bool = Field(True, description="Whether answer is required")
    category: str = Field(..., description="Question category")

class DocumentSuggestion(BaseModel):
    """Document generation suggestion"""
    type: DocumentType = Field(..., description="Document type")
    title: str = Field(..., description="Document title")
    description: str = Field(..., description="Document description")
    estimated_time: str = Field(..., description="Estimated generation time")
    complexity: Literal["simple", "moderate", "complex"] = Field(..., description="Document complexity")
    confidence: float = Field(..., ge=0, le=1, description="Confidence in suggestion")

class GeneratedDocument(BaseModel):
    """Generated document information"""
    id: str = Field(..., description="Document identifier")
    title: str = Field(..., description="Document title")
    type: DocumentType = Field(..., description="Document type")
    content: str = Field(..., description="Document content")
    download_url: Optional[str] = Field(None, description="Download URL")
    preview_url: Optional[str] = Field(None, description="Preview URL")
    generated_at: datetime = Field(..., description="Generation timestamp")
    parameters_used: Dict[str, Any] = Field(..., description="Parameters used for generation")

class WorkflowState(BaseModel):
    """Current workflow state"""
    conversation_id: int = Field(..., description="Conversation identifier")
    current_state: WorkflowStateEnum = Field(..., description="Current workflow state")
    user_intent: Optional[UserIntent] = Field(None, description="Detected user intent")
    document_type: Optional[DocumentType] = Field(None, description="Document type being worked on")
    
    # Requirements collection
    collected_requirements: Dict[str, Any] = Field(default_factory=dict, description="Collected requirements")
    missing_requirements: List[str] = Field(default_factory=list, description="Missing requirements")
    validation_errors: List[str] = Field(default_factory=list, description="Validation errors")
    
    # Progress tracking
    progress_percentage: float = Field(0, ge=0, le=100, description="Progress percentage")
    next_step: Optional[str] = Field(None, description="Next step description")
    
    # Context
    conversation_history: List[Dict[str, Any]] = Field(default_factory=list, description="Conversation history")
    confidence_score: float = Field(0, ge=0, le=1, description="Confidence in current state")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.now, description="State creation time")
    updated_at: datetime = Field(default_factory=datetime.now, description="Last update time")

class ConversationResponse(BaseModel):
    """Response from conversation processing"""
    message_id: str = Field(..., description="Generated message identifier")
    content: str = Field(..., description="AI response content")
    
    # Workflow information
    current_state: WorkflowStateEnum = Field(..., description="Current workflow state")
    user_intent: Optional[UserIntent] = Field(None, description="Detected user intent")
    
    # Interactive elements
    suggested_actions: List[SuggestedAction] = Field(default_factory=list, description="Suggested actions")
    follow_up_questions: List[FollowUpQuestion] = Field(default_factory=list, description="Follow-up questions")
    document_suggestions: List[DocumentSuggestion] = Field(default_factory=list, description="Document suggestions")
    
    # Generated content
    generated_document: Optional[GeneratedDocument] = Field(None, description="Generated document if any")
    
    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Response metadata")
    processing_time_ms: float = Field(..., description="Processing time in milliseconds")
    confidence: float = Field(..., ge=0, le=1, description="Response confidence")
    
    # Context
    workflow_state: WorkflowState = Field(..., description="Current workflow state")
    
    class Config:
        json_schema_extra = {
            "example": {
                "message_id": "msg_123",
                "content": "I understand you need an NDA. To create the right agreement, I need some information...",
                "current_state": "collecting_requirements",
                "user_intent": "document_generation",
                "suggested_actions": [
                    {
                        "type": "provide_parties",
                        "title": "Provide Parties",
                        "description": "Tell me who will be signing this NDA",
                        "priority": "high"
                    }
                ],
                "processing_time_ms": 1250.5,
                "confidence": 0.95
            }
        }

class DocumentGenerationResponse(BaseModel):
    """Response from document generation"""
    document: GeneratedDocument = Field(..., description="Generated document")
    status: Literal["success", "partial", "failed"] = Field(..., description="Generation status")
    warnings: List[str] = Field(default_factory=list, description="Generation warnings")
    suggestions: List[str] = Field(default_factory=list, description="Improvement suggestions")
    
    class Config:
        json_schema_extra = {
            "example": {
                "document": {
                    "id": "doc_123",
                    "title": "Non-Disclosure Agreement",
                    "type": "nda",
                    "content": "CONFIDENTIALITY AGREEMENT...",
                    "generated_at": "2024-01-01T00:00:00Z"
                },
                "status": "success",
                "warnings": [],
                "suggestions": ["Consider adding a return clause"]
            }
        }

# Internal Models (for workflow engine)
class IntentAnalysisResult(BaseModel):
    """Result of intent analysis"""
    intent: UserIntent = Field(..., description="Detected user intent")
    document_type: Optional[DocumentType] = Field(None, description="Document type if applicable")
    confidence: float = Field(..., ge=0, le=1, description="Confidence in analysis")
    reasoning: str = Field(..., description="Reasoning for the classification")
    extracted_entities: Dict[str, Any] = Field(default_factory=dict, description="Extracted entities")

class RequirementCollectionResult(BaseModel):
    """Result of requirement collection"""
    collected: Dict[str, Any] = Field(..., description="Collected requirements")
    missing: List[str] = Field(..., description="Missing requirements")
    next_questions: List[FollowUpQuestion] = Field(..., description="Next questions to ask")
    is_complete: bool = Field(..., description="Whether collection is complete")
    
class ValidationResult(BaseModel):
    """Result of requirement validation"""
    is_valid: bool = Field(..., description="Whether requirements are valid")
    errors: List[str] = Field(default_factory=list, description="Validation errors")
    warnings: List[str] = Field(default_factory=list, description="Validation warnings")
    suggestions: List[str] = Field(default_factory=list, description="Improvement suggestions") 