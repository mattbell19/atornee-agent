"""
LangGraph Legal Workflow Engine
Core engine that processes conversations through structured workflows
"""

import json
import logging
import time
import uuid
from typing import Dict, Any, List, Optional, TypedDict
from datetime import datetime

from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from models.conversation_models import (
    ConversationRequest, ConversationResponse, WorkflowState, WorkflowStateEnum,
    UserIntent, DocumentType, IntentAnalysisResult, RequirementCollectionResult,
    ValidationResult, SuggestedAction, FollowUpQuestion, DocumentSuggestion,
    GeneratedDocument, DocumentGenerationRequest, DocumentGenerationResponse
)
from tools.conversation_store import ConversationStore
from tools.document_generator import DocumentGenerator

# Define LangGraph State
class LegalWorkflowState(TypedDict):
    """State structure for LangGraph workflow"""
    conversation_id: int
    user_id: int
    current_message: str
    current_state: str
    user_intent: Optional[str]
    document_type: Optional[str]
    collected_requirements: Dict[str, Any]
    missing_requirements: List[str]
    validation_errors: List[str]
    ai_response: str
    confidence_score: float
    step_history: List[str]
    generated_document: Optional[Dict[str, Any]]
    processing_time_ms: float

# Initialize Redis for state persistence
import redis
import os
redis_client = redis.Redis.from_url(
    url=os.getenv('REDIS_URL', 'redis://localhost:6379'),
    decode_responses=True,
    ssl_cert_reqs=None  # Disable SSL certificate verification for Heroku Redis
)

logger = logging.getLogger(__name__)

class ConversationState(TypedDict):
    conversation_id: int
    current_state: str
    user_intent: Optional[str]
    document_type: Optional[str]
    collected_requirements: Dict[str, Any]
    missing_requirements: List[str]
    validation_errors: List[str]
    progress_percentage: float
    next_step: Optional[str]
    conversation_history: List[Dict[str, Any]]
    confidence_score: float
    created_at: str
    updated_at: str

def get_conversation_state(conversation_id: int) -> ConversationState:
    """Get persisted conversation state from Redis"""
    state_key = f"conversation:{conversation_id}:state"
    state_json = redis_client.get(state_key)
    if state_json:
        return json.loads(state_json)
    return create_initial_state(conversation_id)

def save_conversation_state(state: ConversationState) -> None:
    """Save conversation state to Redis"""
    state_key = f"conversation:{state['conversation_id']}:state"
    state['updated_at'] = datetime.utcnow().isoformat()
    redis_client.set(state_key, json.dumps(state))

def create_initial_state(conversation_id: int) -> ConversationState:
    """Create initial conversation state"""
    now = datetime.utcnow().isoformat()
    return {
        "conversation_id": conversation_id,
        "current_state": "idle",
        "user_intent": None,
        "document_type": None,
        "collected_requirements": {},
        "missing_requirements": [],
        "validation_errors": [],
        "progress_percentage": 0.0,
        "next_step": None,
        "conversation_history": [],
        "confidence_score": 0.0,
        "created_at": now,
        "updated_at": now
    }

def analyze_intent(state: ConversationState, message: str) -> ConversationState:
    """Analyze user intent and update state"""
    # Simple intent analysis using rule-based logic
    message_lower = message.lower()
    
    # 🔹 NEW: Detect simple greetings and respond politely
    greeting_keywords = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"]
    if any(message_lower.strip().startswith(greet) for greet in greeting_keywords):
        state['user_intent'] = "greeting"
        state['current_state'] = 'greeting'
        state['next_step'] = 'await_user_input'
        state['confidence_score'] = 0.9
        return state
    
    if any(word in message_lower for word in ["nda", "non-disclosure", "confidentiality"]):
        state['user_intent'] = "document_generation"
        state['document_type'] = "nda"
        state['missing_requirements'] = get_document_requirements("nda")
    elif any(word in message_lower for word in ["employment contract", "employment agreement", "job contract", "employee contract"]):
        state['user_intent'] = "document_generation"
        state['document_type'] = "employment_contract"
        state['missing_requirements'] = get_document_requirements("employment_contract")
    elif any(word in message_lower for word in ["terms of service", "terms of use", "user agreement", "tos", "user terms"]):
        state['user_intent'] = "document_generation"
        state['document_type'] = "terms_of_service"
        state['missing_requirements'] = get_document_requirements("terms_of_service")
    elif any(word in message_lower for word in ["privacy policy", "data protection", "gdpr", "privacy notice"]):
        state['user_intent'] = "document_generation"
        state['document_type'] = "privacy_policy"
        state['missing_requirements'] = get_document_requirements("privacy_policy")
    elif any(word in message_lower for word in ["service agreement", "service contract", "contract", "agreement"]):
        state['user_intent'] = "document_generation"
        state['document_type'] = "service_agreement"
        state['missing_requirements'] = get_document_requirements("service_agreement")
    elif any(word in message_lower for word in ["company", "limited", "incorporation", "business", "startup"]):
        state['user_intent'] = "legal_consultation"
        state['current_state'] = 'providing_advice'
        state['next_step'] = 'generate_legal_advice'
    else:
        state['user_intent'] = "legal_consultation"
        state['current_state'] = 'providing_advice'
        state['next_step'] = 'generate_legal_advice'
    
    # Update state based on intent
    if state['user_intent'] == 'document_generation':
        state['current_state'] = 'collecting_requirements'
        state['next_step'] = 'collect_requirements'
    
    state['confidence_score'] = 0.8
    return state

def get_document_requirements(document_type: str) -> List[str]:
    """Get required fields for document type"""
    requirements = {
        'nda': ['parties', 'duration', 'purpose'],
        'service_agreement': ['service_provider', 'client', 'services', 'payment_terms', 'duration', 'deliverables'],
        'employment_contract': ['employer', 'employee', 'position', 'salary', 'start_date', 'benefits'],
        'privacy_policy': ['company_name', 'data_types', 'legal_basis', 'contact_details'],
        'terms_of_service': ['service_name', 'company_name', 'user_obligations', 'liability_limitations']
    }
    return requirements.get(document_type, [])

def collect_requirements(state: ConversationState, message: str) -> ConversationState:
    """Collect document requirements from user message"""
    message_lower = message.lower()
    
    # Extract requirements using simple text parsing
    if state['document_type'] == 'nda':
        # Extract parties
        if 'parties' in state['missing_requirements']:
            # Look for "and" patterns: "matt bell and mtb holdings"
            parts = message.split(' and ')
            if len(parts) >= 2:
                state['collected_requirements']['parties'] = [p.strip().title() for p in parts[:2]]
                state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'parties']
        
        # Extract duration
        if 'duration' in state['missing_requirements']:
            duration_keywords = ['year', 'month', 'week', 'day']
            for keyword in duration_keywords:
                if keyword in message_lower:
                    # Extract number + keyword pattern
                    words = message.split()
                    for i, word in enumerate(words):
                        if keyword in word.lower() and i > 0:
                            if words[i-1].isdigit():
                                state['collected_requirements']['duration'] = f"{words[i-1]} {keyword}{'s' if int(words[i-1]) > 1 else ''}"
                                state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'duration']
                                break
        
        # Extract purpose
        if 'purpose' in state['missing_requirements']:
            purpose_keywords = ['sharing', 'discussing', 'about', 'regarding', 'for']
            for keyword in purpose_keywords:
                if keyword in message_lower:
                    # Extract everything after the keyword
                    parts = message_lower.split(keyword, 1)
                    if len(parts) > 1:
                        purpose = parts[1].strip()
                        if purpose:
                            state['collected_requirements']['purpose'] = purpose
                            state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'purpose']
                            break
    
    elif state['document_type'] == 'service_agreement':
        # Extract service provider and client
        if 'service_provider' in state['missing_requirements'] or 'client' in state['missing_requirements']:
            # Look for provider/client patterns
            if ' and ' in message:
                parts = message.split(' and ')
                if len(parts) >= 2:
                    if 'service_provider' in state['missing_requirements']:
                        # Take only the first part as service provider
                        provider = parts[0].strip().split(',')[0].strip()
                        state['collected_requirements']['service_provider'] = provider.title()
                        state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'service_provider']
                    if 'client' in state['missing_requirements']:
                        # Take only the second part as client, remove extra details
                        client = parts[1].strip().split(',')[0].strip()
                        state['collected_requirements']['client'] = client.title()
                        state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'client']
        
        # Extract services
        if 'services' in state['missing_requirements']:
            service_keywords = ['services', 'consulting', 'development', 'design', 'marketing', 'support']
            for keyword in service_keywords:
                if keyword in message_lower:
                    # Extract service description
                    if 'provide' in message_lower or 'services' in message_lower:
                        state['collected_requirements']['services'] = f"Professional {keyword} services"
                        state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'services']
                        break
        
        # Extract payment terms
        if 'payment_terms' in state['missing_requirements']:
            payment_keywords = ['hourly', 'monthly', 'fixed', 'per hour', 'per month', '$', '£']
            for keyword in payment_keywords:
                if keyword in message_lower:
                    state['collected_requirements']['payment_terms'] = f"Payment as agreed ({keyword})"
                    state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'payment_terms']
                    break
        
        # Extract duration (same logic as NDA)
        if 'duration' in state['missing_requirements']:
            duration_keywords = ['year', 'month', 'week', 'day']
            for keyword in duration_keywords:
                if keyword in message_lower:
                    words = message.split()
                    for i, word in enumerate(words):
                        if keyword in word.lower() and i > 0:
                            if words[i-1].isdigit():
                                state['collected_requirements']['duration'] = f"{words[i-1]} {keyword}{'s' if int(words[i-1]) > 1 else ''}"
                                state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'duration']
                                break
        
        # Extract deliverables
        if 'deliverables' in state['missing_requirements']:
            deliverable_keywords = ['deliver', 'provide', 'create', 'build', 'design', 'develop']
            for keyword in deliverable_keywords:
                if keyword in message_lower:
                    state['collected_requirements']['deliverables'] = "As specified in project scope"
                    state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'deliverables']
                    break
    
    elif state['document_type'] == 'employment_contract':
        # Extract employer and employee
        if 'employer' in state['missing_requirements'] or 'employee' in state['missing_requirements']:
            if ' and ' in message or ' hire ' in message_lower or ' employ ' in message_lower:
                parts = message.split(' and ') if ' and ' in message else message.split()
                if len(parts) >= 2:
                    if 'employer' in state['missing_requirements']:
                        employer = parts[0].strip().title()
                        state['collected_requirements']['employer'] = employer
                        state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'employer']
                    if 'employee' in state['missing_requirements']:
                        employee = parts[1].strip().title()
                        state['collected_requirements']['employee'] = employee
                        state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'employee']
        
        # Extract position/role
        if 'position' in state['missing_requirements']:
            position_keywords = ['developer', 'manager', 'analyst', 'engineer', 'designer', 'consultant', 'director', 'assistant']
            for keyword in position_keywords:
                if keyword in message_lower:
                    state['collected_requirements']['position'] = keyword.title()
                    state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'position']
                    break
        
        # Extract salary
        if 'salary' in state['missing_requirements']:
            salary_keywords = ['salary', 'pay', 'wage', '£', '$', 'per year', 'per month', 'annual']
            for keyword in salary_keywords:
                if keyword in message_lower:
                    # Extract salary amount if present
                    words = message.split()
                    for i, word in enumerate(words):
                        if any(char.isdigit() for char in word) and (keyword in word or (i < len(words)-1 and keyword in words[i+1])):
                            state['collected_requirements']['salary'] = f"As agreed ({word})"
                            state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'salary']
                            break
        
        # Extract start date
        if 'start_date' in state['missing_requirements']:
            date_keywords = ['start', 'begin', 'commence', 'january', 'february', 'march', 'april', 'may', 'june', 
                           'july', 'august', 'september', 'october', 'november', 'december']
            for keyword in date_keywords:
                if keyword in message_lower:
                    state['collected_requirements']['start_date'] = "As agreed in contract"
                    state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'start_date']
                    break
        
        # Extract benefits
        if 'benefits' in state['missing_requirements']:
            benefit_keywords = ['benefits', 'holiday', 'pension', 'insurance', 'health', 'bonus']
            for keyword in benefit_keywords:
                if keyword in message_lower:
                    state['collected_requirements']['benefits'] = "Standard employment benefits package"
                    state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'benefits']
                    break
    
    elif state['document_type'] == 'privacy_policy':
        # Extract company name
        if 'company_name' in state['missing_requirements']:
            # Look for company indicators
            company_indicators = ['ltd', 'limited', 'inc', 'corp', 'company', 'llc']
            words = message.split()
            for i, word in enumerate(words):
                if any(indicator in word.lower() for indicator in company_indicators):
                    # Take surrounding words as company name
                    if i > 0:
                        company_name = f"{words[i-1]} {word}".title()
                        state['collected_requirements']['company_name'] = company_name
                        state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'company_name']
                        break
        
        # Extract data types
        if 'data_types' in state['missing_requirements']:
            data_keywords = ['personal', 'email', 'name', 'address', 'phone', 'data', 'information', 'cookies']
            for keyword in data_keywords:
                if keyword in message_lower:
                    state['collected_requirements']['data_types'] = "Personal information and website analytics data"
                    state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'data_types']
                    break
        
        # Extract legal basis
        if 'legal_basis' in state['missing_requirements']:
            if 'gdpr' in message_lower or 'consent' in message_lower or 'legitimate' in message_lower:
                state['collected_requirements']['legal_basis'] = "GDPR compliance and legitimate business interests"
                state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'legal_basis']
        
        # Extract contact details
        if 'contact_details' in state['missing_requirements']:
            contact_keywords = ['contact', 'email', 'address', 'phone', 'reach']
            for keyword in contact_keywords:
                if keyword in message_lower:
                    state['collected_requirements']['contact_details'] = "Contact information as provided"
                    state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'contact_details']
                    break
    
    elif state['document_type'] == 'terms_of_service':
        # Extract service name
        if 'service_name' in state['missing_requirements']:
            service_keywords = ['app', 'website', 'platform', 'service', 'software', 'application']
            for keyword in service_keywords:
                if keyword in message_lower:
                    state['collected_requirements']['service_name'] = f"Digital {keyword}"
                    state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'service_name']
                    break
        
        # Extract company name (similar to privacy policy)
        if 'company_name' in state['missing_requirements']:
            company_indicators = ['ltd', 'limited', 'inc', 'corp', 'company', 'llc']
            words = message.split()
            for i, word in enumerate(words):
                if any(indicator in word.lower() for indicator in company_indicators):
                    if i > 0:
                        company_name = f"{words[i-1]} {word}".title()
                        state['collected_requirements']['company_name'] = company_name
                        state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'company_name']
                        break
        
        # Extract user obligations
        if 'user_obligations' in state['missing_requirements']:
            obligation_keywords = ['use', 'responsible', 'comply', 'agree', 'accept']
            for keyword in obligation_keywords:
                if keyword in message_lower:
                    state['collected_requirements']['user_obligations'] = "Standard user responsibilities and acceptable use"
                    state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'user_obligations']
                    break
        
        # Extract liability limitations
        if 'liability_limitations' in state['missing_requirements']:
            liability_keywords = ['liability', 'responsible', 'damages', 'limitation']
            for keyword in liability_keywords:
                if keyword in message_lower:
                    state['collected_requirements']['liability_limitations'] = "Standard liability limitations as permitted by law"
                    state['missing_requirements'] = [req for req in state['missing_requirements'] if req != 'liability_limitations']
                    break
    
    # Calculate progress
    total_reqs = len(get_document_requirements(state['document_type']))
    completed_reqs = total_reqs - len(state['missing_requirements'])
    state['progress_percentage'] = (completed_reqs / total_reqs) * 100
    
    # Generate follow-up questions or proceed to validation
    if state['missing_requirements']:
        state['next_step'] = 'ask_requirements'
    else:
        state['current_state'] = 'generating_document'
        state['next_step'] = 'generate_document'
    
    return state

def validate_requirements(state: ConversationState) -> ConversationState:
    """Validate collected requirements"""
    # Clear previous validation errors
    state['validation_errors'] = []
    
    # Validate based on document type
    if state['document_type'] == 'nda':
        if not state['collected_requirements'].get('parties'):
            state['validation_errors'].append("Missing parties information")
        if not state['collected_requirements'].get('duration'):
            state['validation_errors'].append("Missing duration")
        if not state['collected_requirements'].get('purpose'):
            state['validation_errors'].append("Missing purpose of NDA")
    
    elif state['document_type'] == 'service_agreement':
        if not state['collected_requirements'].get('service_provider'):
            state['validation_errors'].append("Missing service provider information")
        if not state['collected_requirements'].get('client'):
            state['validation_errors'].append("Missing client information")
        if not state['collected_requirements'].get('services'):
            state['validation_errors'].append("Missing services description")
        if not state['collected_requirements'].get('payment_terms'):
            state['validation_errors'].append("Missing payment terms")
        if not state['collected_requirements'].get('duration'):
            state['validation_errors'].append("Missing agreement duration")
        if not state['collected_requirements'].get('deliverables'):
            state['validation_errors'].append("Missing deliverables specification")
    
    elif state['document_type'] == 'employment_contract':
        if not state['collected_requirements'].get('employer'):
            state['validation_errors'].append("Missing employer information")
        if not state['collected_requirements'].get('employee'):
            state['validation_errors'].append("Missing employee information")
        if not state['collected_requirements'].get('position'):
            state['validation_errors'].append("Missing job position/title")
        if not state['collected_requirements'].get('salary'):
            state['validation_errors'].append("Missing salary information")
        if not state['collected_requirements'].get('start_date'):
            state['validation_errors'].append("Missing start date")
        if not state['collected_requirements'].get('benefits'):
            state['validation_errors'].append("Missing benefits information")
    
    elif state['document_type'] == 'privacy_policy':
        if not state['collected_requirements'].get('company_name'):
            state['validation_errors'].append("Missing company name")
        if not state['collected_requirements'].get('data_types'):
            state['validation_errors'].append("Missing data types collected")
        if not state['collected_requirements'].get('legal_basis'):
            state['validation_errors'].append("Missing legal basis for processing")
        if not state['collected_requirements'].get('contact_details'):
            state['validation_errors'].append("Missing contact details")
    
    elif state['document_type'] == 'terms_of_service':
        if not state['collected_requirements'].get('service_name'):
            state['validation_errors'].append("Missing service/platform name")
        if not state['collected_requirements'].get('company_name'):
            state['validation_errors'].append("Missing company name")
        if not state['collected_requirements'].get('user_obligations'):
            state['validation_errors'].append("Missing user obligations")
        if not state['collected_requirements'].get('liability_limitations'):
            state['validation_errors'].append("Missing liability limitations")
    
    # Update state based on validation
    if state['validation_errors']:
        state['current_state'] = 'collecting_requirements'
        state['next_step'] = 'ask_requirements'
    else:
        state['current_state'] = 'generating_document'
        state['next_step'] = 'generate_document'
    
    return state

def generate_response(state: ConversationState) -> ConversationResponse:
    """Generate appropriate response based on state"""
    if state['current_state'] == 'collecting_requirements':
        if state['missing_requirements']:
            # Generate more natural acknowledgment based on document type
            doc_type_name = state['document_type'].replace('_', ' ')
            
            # First time asking - provide acknowledgment and context
            if len(state['conversation_history']) <= 2:  # Initial request + first response
                if state['document_type'] == 'nda':
                    intro_text = f"I'll help you create a professional NDA (Non-Disclosure Agreement). To generate a comprehensive document that meets your needs, I need to gather some key information:"
                elif state['document_type'] == 'service_agreement':
                    intro_text = f"I'll help you create a service agreement. To generate a comprehensive contract, I need to gather some essential details:"
                elif state['document_type'] == 'employment_contract':
                    intro_text = f"I'll help you create an employment contract. To generate a UK employment law compliant document, I need to gather some key information:"
                elif state['document_type'] == 'privacy_policy':
                    intro_text = f"I'll help you create a GDPR-compliant privacy policy. To generate the appropriate document, I need to gather some essential information:"
                elif state['document_type'] == 'terms_of_service':
                    intro_text = f"I'll help you create terms of service for your platform. To generate a comprehensive document, I need to gather some key details:"
                else:
                    intro_text = f"I'll help you create your {doc_type_name}. To generate a comprehensive document, I need to gather some information:"
            else:
                # Follow-up questions - more concise
                intro_text = f"I need a few more details to complete your {doc_type_name}:"
            
            # Generate specific questions for missing requirements
            questions = []
            for req in state['missing_requirements']:
                if req == 'parties':
                    questions.append("Who are the parties that will be signing this NDA?")
                elif req == 'duration':
                    questions.append("How long should this NDA remain in effect?")
                elif req == 'purpose':
                    questions.append("What is the purpose of this NDA? What information will be shared?")
                # Service Agreement questions
                elif req == 'service_provider':
                    questions.append("Who is the service provider for this agreement?")
                elif req == 'client':
                    questions.append("Who is the client receiving the services?")
                elif req == 'services':
                    questions.append("What services will be provided under this agreement?")
                elif req == 'payment_terms':
                    questions.append("What are the payment terms (hourly rate, fixed fee, etc.)?")
                elif req == 'deliverables':
                    questions.append("What specific deliverables or outcomes are expected?")
                # Employment Contract questions
                elif req == 'employer':
                    questions.append("What is the name of the employing company or organization?")
                elif req == 'employee':
                    questions.append("What is the full name of the employee?")
                elif req == 'position':
                    questions.append("What is the job title or position?")
                elif req == 'salary':
                    questions.append("What is the salary or compensation package?")
                elif req == 'start_date':
                    questions.append("What is the proposed start date for employment?")
                elif req == 'benefits':
                    questions.append("What benefits are included (holiday, pension, health insurance, etc.)?")
                # Privacy Policy questions
                elif req == 'company_name':
                    questions.append("What is the name of your company or organization?")
                elif req == 'data_types':
                    questions.append("What types of personal data do you collect (email, names, addresses, etc.)?")
                elif req == 'legal_basis':
                    questions.append("What is your legal basis for processing personal data?")
                elif req == 'contact_details':
                    questions.append("What contact information should be provided for data protection inquiries?")
                # Terms of Service questions
                elif req == 'service_name':
                    questions.append("What is the name of your service, app, or platform?")
                elif req == 'user_obligations':
                    questions.append("What are the key user responsibilities and acceptable use requirements?")
                elif req == 'liability_limitations':
                    questions.append("What liability limitations should be included?")
            
            return ConversationResponse(
                message_id=str(uuid.uuid4()),
                content=intro_text,
                current_state=state['current_state'],
                user_intent=state['user_intent'],
                follow_up_questions=[
                    FollowUpQuestion(
                        id=str(uuid.uuid4()), 
                        question=q,
                        type="text",
                        category="requirements"
                    )
                    for q in questions
                ],
                processing_time_ms=0,
                confidence=0.9,
                workflow_state=state
            )
    
    elif state['current_state'] == 'generating_document':
        # Actually generate the document
        from tools.document_generator import DocumentGenerator
        
        # Create document based on type
        if state['document_type'] == 'nda':
            generated_doc = {
                "id": str(uuid.uuid4()),
                "title": "Non-Disclosure Agreement",
                "type": state['document_type'],
                "content": f"**NON-DISCLOSURE AGREEMENT**\n\nParties: {', '.join(state['collected_requirements'].get('parties', []))}\nDuration: {state['collected_requirements'].get('duration', 'Not specified')}\nPurpose: {state['collected_requirements'].get('purpose', 'Not specified')}\n\n[Full legal document would be generated here]",
                "generated_at": datetime.utcnow().isoformat(),
                "parameters_used": state['collected_requirements']
            }
        elif state['document_type'] == 'service_agreement':
            generated_doc = {
                "id": str(uuid.uuid4()),
                "title": "Service Agreement",
                "type": state['document_type'],
                "content": f"**SERVICE AGREEMENT**\n\nService Provider: {state['collected_requirements'].get('service_provider', 'Not specified')}\nClient: {state['collected_requirements'].get('client', 'Not specified')}\nServices: {state['collected_requirements'].get('services', 'Not specified')}\nPayment Terms: {state['collected_requirements'].get('payment_terms', 'Not specified')}\nDuration: {state['collected_requirements'].get('duration', 'Not specified')}\nDeliverables: {state['collected_requirements'].get('deliverables', 'Not specified')}\n\n[Full legal document would be generated here]",
                "generated_at": datetime.utcnow().isoformat(),
                "parameters_used": state['collected_requirements']
            }
        elif state['document_type'] == 'employment_contract':
            generated_doc = {
                "id": str(uuid.uuid4()),
                "title": "Employment Contract",
                "type": state['document_type'],
                "content": f"**EMPLOYMENT CONTRACT**\n\nEmployer: {state['collected_requirements'].get('employer', 'Not specified')}\nEmployee: {state['collected_requirements'].get('employee', 'Not specified')}\nPosition: {state['collected_requirements'].get('position', 'Not specified')}\nSalary: {state['collected_requirements'].get('salary', 'Not specified')}\nStart Date: {state['collected_requirements'].get('start_date', 'Not specified')}\nBenefits: {state['collected_requirements'].get('benefits', 'Not specified')}\n\n**TERMS AND CONDITIONS**\n1. This employment is subject to UK employment law\n2. Notice period as per statutory requirements\n3. Confidentiality and non-disclosure obligations apply\n4. Standard probationary period of 6 months\n\n[Full employment contract would be generated here]",
                "generated_at": datetime.utcnow().isoformat(),
                "parameters_used": state['collected_requirements']
            }
        elif state['document_type'] == 'privacy_policy':
            generated_doc = {
                "id": str(uuid.uuid4()),
                "title": "Privacy Policy",
                "type": state['document_type'],
                "content": f"**PRIVACY POLICY**\n\nCompany: {state['collected_requirements'].get('company_name', 'Not specified')}\nData Types Collected: {state['collected_requirements'].get('data_types', 'Not specified')}\nLegal Basis: {state['collected_requirements'].get('legal_basis', 'Not specified')}\nContact Details: {state['collected_requirements'].get('contact_details', 'Not specified')}\n\n**GDPR COMPLIANCE**\n1. Data collection is limited to specified purposes\n2. Users have right to access, rectify, and delete personal data\n3. Data retention periods are clearly defined\n4. Security measures protect personal information\n5. Third-party sharing is limited and disclosed\n\n[Full GDPR-compliant privacy policy would be generated here]",
                "generated_at": datetime.utcnow().isoformat(),
                "parameters_used": state['collected_requirements']
            }
        elif state['document_type'] == 'terms_of_service':
            generated_doc = {
                "id": str(uuid.uuid4()),
                "title": "Terms of Service",
                "type": state['document_type'],
                "content": f"**TERMS OF SERVICE**\n\nService: {state['collected_requirements'].get('service_name', 'Not specified')}\nCompany: {state['collected_requirements'].get('company_name', 'Not specified')}\nUser Obligations: {state['collected_requirements'].get('user_obligations', 'Not specified')}\nLiability Limitations: {state['collected_requirements'].get('liability_limitations', 'Not specified')}\n\n**USER AGREEMENT**\n1. Users must comply with acceptable use policies\n2. Service availability is provided on \"as is\" basis\n3. Intellectual property rights are reserved\n4. Termination procedures are clearly defined\n5. Dispute resolution follows UK jurisdiction\n\n[Full terms of service would be generated here]",
                "generated_at": datetime.utcnow().isoformat(),
                "parameters_used": state['collected_requirements']
            }
        else:
            # Default document template for any other document type
            generated_doc = {
                "id": str(uuid.uuid4()),
                "title": f"{state['document_type'].replace('_', ' ').title()}",
                "type": state['document_type'],
                "content": f"**{state['document_type'].replace('_', ' ').upper()}**\n\n[Professional {state['document_type'].replace('_', ' ')} document would be generated here with the collected requirements]",
                "generated_at": datetime.utcnow().isoformat(),
                "parameters_used": state['collected_requirements']
            }
        
        return ConversationResponse(
            message_id=str(uuid.uuid4()),
            content=f"Perfect! I've successfully generated your {state['document_type'].replace('_', ' ')}. The document includes all the information you provided and is ready for review.",
            current_state=state['current_state'],
            user_intent=state['user_intent'],
            processing_time_ms=0,
            confidence=0.95,
            workflow_state=state,
            generated_document=GeneratedDocument(**generated_doc)
        )
    
    elif state['current_state'] == 'providing_advice':
        # Generate detailed legal advice based on the question
        advice_content = "To start a limited company in the UK, you need to follow these key requirements:\n\n"
        advice_content += "**1. Companies House Registration**\n"
        advice_content += "- Register with Companies House using Form IN01\n"
        advice_content += "- Choose a unique company name (check availability first)\n"
        advice_content += "- Provide a UK registered office address\n\n"
        advice_content += "**2. Required Documents**\n"
        advice_content += "- Memorandum of Association\n"
        advice_content += "- Articles of Association\n"
        advice_content += "- Statement of Capital and Initial Shareholdings\n\n"
        advice_content += "**3. Key Appointments**\n"
        advice_content += "- At least one director (must be a natural person)\n"
        advice_content += "- Company secretary (optional but recommended)\n"
        advice_content += "- Shareholders (can be individuals or companies)\n\n"
        advice_content += "**4. Ongoing Compliance**\n"
        advice_content += "- File annual confirmation statement\n"
        advice_content += "- Submit annual accounts to Companies House\n"
        advice_content += "- Maintain statutory books and records\n\n"
        advice_content += "The current registration fee is £12 online or £40 by post. The process typically takes 1-3 working days if submitted online."
        
        return ConversationResponse(
            message_id=str(uuid.uuid4()),
            content=advice_content,
            current_state=state['current_state'],
            user_intent=state['user_intent'],
            processing_time_ms=0,
            confidence=0.9,
            workflow_state=state
        )
    
    elif state['current_state'] == 'greeting':
        # Polite greeting response prompting user for their request
        return ConversationResponse(
            message_id=str(uuid.uuid4()),
            content="Hello! How can I assist you with your legal needs today?",
            current_state=state['current_state'],
            user_intent=state['user_intent'],
            processing_time_ms=0,
            confidence=0.9,
            workflow_state=state
        )
    
    # Default response for other states
    return ConversationResponse(
        message_id=str(uuid.uuid4()),
        content="I'm here to help with your legal question. Could you provide more details about what you need?",
        current_state=state['current_state'],
        user_intent=state['user_intent'],
        processing_time_ms=0,
        confidence=0.8,
        workflow_state=state
    )

def process_message(request: ConversationRequest) -> ConversationResponse:
    """Process a conversation message through the workflow"""
    start_time = time.time()
    
    # Get or create conversation state
    state = get_conversation_state(request.conversation_id)
    
    # Add message to history
    state['conversation_history'].append({
        'content': request.message,
        'is_user': True,
        'timestamp': datetime.utcnow().isoformat()
    })
    
    # Process based on current state
    if state['current_state'] == 'idle':
        state = analyze_intent(state, request.message)
    
    elif state['current_state'] == 'collecting_requirements':
        state = collect_requirements(state, request.message)
        if not state['missing_requirements']:
            state = validate_requirements(state)
    
    # Generate appropriate response
    response = generate_response(state)
    
    # Add response to history
    state['conversation_history'].append({
        'content': response.content,
        'is_user': False,
        'timestamp': datetime.utcnow().isoformat()
    })
    
    # Save updated state
    save_conversation_state(state)
    
    # Add processing time
    response.processing_time_ms = (time.time() - start_time) * 1000
    
    return response

class LegalWorkflowEngine:
    """LangGraph-powered workflow engine for legal document generation"""
    
    def __init__(self, openai_api_key: str, conversation_store: ConversationStore, 
                 document_generator: DocumentGenerator, debug: bool = False):
        self.openai_api_key = openai_api_key
        self.conversation_store = conversation_store
        self.document_generator = document_generator
        self.debug = debug
        
        # Initialize OpenAI client
        self.llm = ChatOpenAI(
            api_key=openai_api_key,
            model="gpt-4o",
            temperature=0.1,
            max_tokens=2000
        )
        
        # Workflow graph will be built in initialize()
        self.workflow_graph: Optional[StateGraph] = None
        self.compiled_workflow = None
        
        logger.info("🚀 LegalWorkflowEngine initialized")
    
    async def initialize(self):
        """Initialize the workflow graph"""
        try:
            self.workflow_graph = self._build_workflow_graph()
            self.compiled_workflow = self.workflow_graph.compile()
            logger.info("✅ LangGraph workflow compiled successfully")
        except Exception as e:
            logger.error(f"❌ Failed to compile workflow: {e}")
            raise
    
    def _build_workflow_graph(self) -> StateGraph:
        """Build the LangGraph workflow"""
        workflow = StateGraph(LegalWorkflowState)
        
        # Define workflow nodes
        workflow.add_node("analyze_intent", self._analyze_intent)
        workflow.add_node("collect_requirements", self._collect_requirements)
        workflow.add_node("validate_requirements", self._validate_requirements)
        workflow.add_node("generate_document", self._generate_document)
        workflow.add_node("review_document", self._review_document)
        workflow.add_node("provide_response", self._provide_response)
        workflow.add_node("handle_error", self._handle_error)
        
        # Define the workflow flow
        workflow.set_entry_point("analyze_intent")
        
        # Intent analysis leads to different paths
        workflow.add_conditional_edges(
            "analyze_intent",
            self._route_after_intent_analysis,
            {
                "collect_requirements": "collect_requirements",
                "provide_response": "provide_response",
                "error": "handle_error"
            }
        )
        
        # Requirements collection
        workflow.add_conditional_edges(
            "collect_requirements",
            self._route_after_collection,
            {
                "validate_requirements": "validate_requirements",
                "provide_response": "provide_response",
                "error": "handle_error"
            }
        )
        
        # Requirements validation
        workflow.add_conditional_edges(
            "validate_requirements",
            self._route_after_validation,
            {
                "generate_document": "generate_document",
                "collect_requirements": "collect_requirements",
                "provide_response": "provide_response",
                "error": "handle_error"
            }
        )
        
        # Document generation
        workflow.add_conditional_edges(
            "generate_document",
            self._route_after_generation,
            {
                "review_document": "review_document",
                "provide_response": "provide_response",
                "error": "handle_error"
            }
        )
        
        # Document review leads to response
        workflow.add_edge("review_document", "provide_response")
        
        # All paths lead to END
        workflow.add_edge("provide_response", END)
        workflow.add_edge("handle_error", END)
        
        return workflow
    
    # Workflow Node Functions
    
    async def _analyze_intent(self, state: LegalWorkflowState) -> LegalWorkflowState:
        """Analyze user intent from the current message"""
        try:
            state["step_history"].append("analyze_intent")
            state["current_state"] = "analyzing_intent"
            
            # Simple intent analysis - in production this would be more sophisticated
            message = state["current_message"].lower()
            
            if any(word in message for word in ["nda", "non-disclosure", "confidentiality"]):
                state["user_intent"] = "document_generation"
                state["document_type"] = "nda"
                state["ai_response"] = "I understand you need an NDA. Let me collect the required information."
            elif any(word in message for word in ["service agreement", "contract", "agreement"]):
                state["user_intent"] = "document_generation"
                state["document_type"] = "service_agreement"
                state["ai_response"] = "I'll help you create a service agreement. Let me gather the necessary details."
            elif any(word in message for word in ["employment", "job", "hire"]):
                state["user_intent"] = "document_generation"
                state["document_type"] = "employment_contract"
                state["ai_response"] = "I'll assist you with an employment contract. Let me collect the required information."
            else:
                state["user_intent"] = "legal_consultation"
                state["ai_response"] = "I'm here to help with your legal question. Could you provide more details about what you need?"
            
            state["confidence_score"] = 0.8
            
        except Exception as e:
            logger.error(f"Error in intent analysis: {e}")
            state["current_state"] = "error"
            state["ai_response"] = "I encountered an issue analyzing your request. Please try rephrasing."
        
        return state
    
    async def _collect_requirements(self, state: LegalWorkflowState) -> LegalWorkflowState:
        """Collect requirements for document generation"""
        try:
            state["step_history"].append("collect_requirements")
            state["current_state"] = "collecting_requirements"
            
            doc_type = state.get("document_type")
            message = state["current_message"]
            
            # Extract information from the message
            if doc_type == "nda":
                self._extract_nda_requirements(state, message)
            elif doc_type == "service_agreement":
                self._extract_service_requirements(state, message)
            elif doc_type == "employment_contract":
                self._extract_employment_requirements(state, message)
            
            # Check what's still missing
            self._check_missing_requirements(state)
            
        except Exception as e:
            logger.error(f"Error collecting requirements: {e}")
            state["current_state"] = "error"
            state["ai_response"] = "I had trouble processing your requirements. Please try again."
        
        return state
    
    async def _validate_requirements(self, state: LegalWorkflowState) -> LegalWorkflowState:
        """Validate collected requirements"""
        try:
            state["step_history"].append("validate_requirements")
            state["current_state"] = "validating_requirements"
            
            requirements = state["collected_requirements"]
            errors = []
            
            # Basic validation
            if state["document_type"] == "nda":
                if not requirements.get("parties") or len(requirements.get("parties", [])) < 2:
                    errors.append("Need at least two parties for the NDA")
                if not requirements.get("purpose"):
                    errors.append("Need to specify the purpose of the NDA")
            
            elif state["document_type"] == "service_agreement":
                if not requirements.get("service_provider"):
                    errors.append("Missing service provider information")
                if not requirements.get("client"):
                    errors.append("Missing client information")
                if not requirements.get("services"):
                    errors.append("Missing services description")
                if not requirements.get("payment_terms"):
                    errors.append("Missing payment terms")
                if not requirements.get("duration"):
                    errors.append("Missing agreement duration")
                if not requirements.get("deliverables"):
                    errors.append("Missing deliverables specification")
            
            elif state["document_type"] == "employment_contract":
                if not requirements.get("employer"):
                    errors.append("Missing employer information")
                if not requirements.get("employee"):
                    errors.append("Missing employee information")
                if not requirements.get("position"):
                    errors.append("Missing job position/title")
                if not requirements.get("salary"):
                    errors.append("Missing salary information")
                if not requirements.get("start_date"):
                    errors.append("Missing start date")
                if not requirements.get("benefits"):
                    errors.append("Missing benefits information")
            
            elif state["document_type"] == "privacy_policy":
                if not requirements.get("company_name"):
                    errors.append("Missing company name")
                if not requirements.get("data_types"):
                    errors.append("Missing data types collected")
                if not requirements.get("legal_basis"):
                    errors.append("Missing legal basis for processing")
                if not requirements.get("contact_details"):
                    errors.append("Missing contact details")
            
            elif state["document_type"] == "terms_of_service":
                if not requirements.get("service_name"):
                    errors.append("Missing service/platform name")
                if not requirements.get("company_name"):
                    errors.append("Missing company name")
                if not requirements.get("user_obligations"):
                    errors.append("Missing user obligations")
                if not requirements.get("liability_limitations"):
                    errors.append("Missing liability limitations")
            
            state["validation_errors"] = errors
            
            if not errors:
                state["ai_response"] = "Great! I have all the information needed. Generating your document now..."
            else:
                state["ai_response"] = f"I need a bit more information: {', '.join(errors)}"
            
        except Exception as e:
            logger.error(f"Error validating requirements: {e}")
            state["current_state"] = "error"
        
        return state
    
    async def _generate_document(self, state: LegalWorkflowState) -> LegalWorkflowState:
        """Generate the legal document"""
        try:
            state["step_history"].append("generate_document")
            state["current_state"] = "generating_document"
            
            doc_request = DocumentGenerationRequest(
                document_type=DocumentType(state["document_type"]),
                parameters=state["collected_requirements"]
            )
            
            doc_response = await self.document_generator.generate_document(doc_request)
            
            if doc_response.status == "success":
                state["generated_document"] = doc_response.document.dict()
                state["ai_response"] = f"I've successfully generated your {state['document_type'].replace('_', ' ')}!"
            else:
                state["ai_response"] = "I encountered an issue generating the document. Please try again."
            
        except Exception as e:
            logger.error(f"Error generating document: {e}")
            state["current_state"] = "error"
            state["ai_response"] = "Document generation failed. Please try again."
        
        return state
    
    async def _review_document(self, state: LegalWorkflowState) -> LegalWorkflowState:
        """Review the generated document"""
        try:
            state["step_history"].append("review_document")
            state["current_state"] = "reviewing_document"
            
            if state.get("generated_document"):
                state["ai_response"] = "Your document has been generated successfully. Please review it carefully."
            else:
                state["ai_response"] = "No document was generated to review."
            
        except Exception as e:
            logger.error(f"Error reviewing document: {e}")
            state["current_state"] = "error"
        
        return state
    
    async def _provide_response(self, state: LegalWorkflowState) -> LegalWorkflowState:
        """Provide the final response to the user"""
        try:
            state["step_history"].append("provide_response")
            state["current_state"] = "completed"
            
            # Ensure we have a response
            if not state.get("ai_response"):
                state["ai_response"] = "I'm here to help with your legal needs. What can I assist you with?"
            
        except Exception as e:
            logger.error(f"Error providing response: {e}")
            state["current_state"] = "error"
            state["ai_response"] = "I encountered an issue. Please try again."
        
        return state
    
    async def _handle_error(self, state: LegalWorkflowState) -> LegalWorkflowState:
        """Handle workflow errors"""
        state["step_history"].append("handle_error")
        state["current_state"] = "error"
        state["ai_response"] = "I apologize, but I encountered an error. Please try rephrasing your request."
        return state
    
    # Routing Functions
    
    def _route_after_intent_analysis(self, state: LegalWorkflowState) -> str:
        """Route after intent analysis"""
        if state.get("current_state") == "error":
            return "error"
        elif state.get("user_intent") == "document_generation":
            return "collect_requirements"
        else:
            return "provide_response"
    
    def _route_after_collection(self, state: LegalWorkflowState) -> str:
        """Route after requirements collection"""
        if state.get("current_state") == "error":
            return "error"
        elif state.get("missing_requirements"):
            return "provide_response"  # Ask for missing info
        else:
            return "validate_requirements"
    
    def _route_after_validation(self, state: LegalWorkflowState) -> str:
        """Route after requirements validation"""
        if state.get("current_state") == "error":
            return "error"
        elif state.get("validation_errors"):
            return "collect_requirements"  # Go back to collect more info
        else:
            return "generate_document"
    
    def _route_after_generation(self, state: LegalWorkflowState) -> str:
        """Route after document generation"""
        if state.get("current_state") == "error":
            return "error"
        elif state.get("generated_document"):
            return "review_document"
        else:
            return "provide_response"
    
    # Helper Functions
    
    def _extract_nda_requirements(self, state: LegalWorkflowState, message: str):
        """Extract NDA requirements from message"""
        # Simple extraction - in production this would be more sophisticated
        requirements = state.get("collected_requirements", {})
        
        # Look for parties
        if " and " in message:
            parts = message.split(" and ")
            if len(parts) >= 2:
                requirements["parties"] = [parts[0].strip(), parts[1].split(",")[0].strip()]
        
        # Look for duration
        if "year" in message:
            words = message.split()
            for i, word in enumerate(words):
                if "year" in word and i > 0:
                    try:
                        duration = words[i-1]
                        requirements["duration"] = f"{duration} years"
                    except:
                        pass
        
        # Look for purpose
        purpose_keywords = ["for", "regarding", "about", "concerning", "sharing"]
        for keyword in purpose_keywords:
            if keyword in message:
                parts = message.split(keyword, 1)
                if len(parts) > 1:
                    requirements["purpose"] = parts[1].strip().rstrip(".")
                    break
        
        state["collected_requirements"] = requirements
    
    def _extract_service_requirements(self, state: LegalWorkflowState, message: str):
        """Extract service agreement requirements"""
        requirements = state.get("collected_requirements", {})
        # Basic extraction logic here
        state["collected_requirements"] = requirements
    
    def _extract_employment_requirements(self, state: LegalWorkflowState, message: str):
        """Extract employment contract requirements"""
        requirements = state.get("collected_requirements", {})
        # Basic extraction logic here
        state["collected_requirements"] = requirements
    
    def _check_missing_requirements(self, state: LegalWorkflowState):
        """Check what requirements are still missing"""
        requirements = state.get("collected_requirements", {})
        missing = []
        
        if state["document_type"] == "nda":
            if not requirements.get("parties") or len(requirements.get("parties", [])) < 2:
                missing.append("parties")
            if not requirements.get("duration"):
                missing.append("duration")
            if not requirements.get("purpose"):
                missing.append("purpose")
        
        state["missing_requirements"] = missing
    
    # Public API
    
    async def process_message(self, request: ConversationRequest) -> ConversationResponse:
        """Process a conversation message through the workflow"""
        try:
            # Initialize state
            initial_state: LegalWorkflowState = {
                "conversation_id": request.conversation_id,
                "user_id": request.user_id,
                "current_message": request.message,
                "message_history": [],
                "current_state": "idle",
                "user_intent": None,
                "document_type": None,
                "collected_requirements": {},
                "missing_requirements": [],
                "validation_errors": [],
                "ai_response": "",
                "suggested_actions": [],
                "follow_up_questions": [],
                "document_suggestions": [],
                "generated_document": None,
                "confidence_score": 0.0,
                "processing_start_time": time.time(),
                "step_history": []
            }
            
            # Run through workflow
            result = await self.compiled_workflow.ainvoke(initial_state)
            
            # Convert to response format
            response = ConversationResponse(
                message_id=str(uuid.uuid4()),
                content=result["ai_response"],
                current_state=WorkflowStateEnum(result["current_state"]),
                user_intent=UserIntent(result["user_intent"]) if result.get("user_intent") else None,
                processing_time_ms=(time.time() - result["processing_start_time"]) * 1000,
                confidence=result["confidence_score"],
                workflow_state=WorkflowState(
                    conversation_id=result["conversation_id"],
                    current_state=WorkflowStateEnum(result["current_state"]),
                    user_intent=UserIntent(result["user_intent"]) if result.get("user_intent") else None,
                    document_type=DocumentType(result["document_type"]) if result.get("document_type") else None,
                    collected_requirements=result["collected_requirements"],
                    missing_requirements=result["missing_requirements"],
                    validation_errors=result["validation_errors"],
                    confidence_score=result["confidence_score"]
                ),
                generated_document=GeneratedDocument(**result["generated_document"]) if result.get("generated_document") else None
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            # Return error response
            return ConversationResponse(
                message_id=str(uuid.uuid4()),
                content="I apologize, but I encountered an error processing your request. Please try again.",
                current_state=WorkflowStateEnum.ERROR,
                processing_time_ms=0,
                confidence=0,
                workflow_state=WorkflowState(
                    conversation_id=request.conversation_id,
                    current_state=WorkflowStateEnum.ERROR
                )
            )
    
    async def generate_document_direct(self, request: DocumentGenerationRequest) -> DocumentGenerationResponse:
        """Generate a document directly (for testing)"""
        return await self.document_generator.generate_document(request)
    
    def get_available_workflows(self) -> List[str]:
        """Get available workflow types"""
        return ["document_generation", "legal_consultation", "document_review"]
    
    def get_workflow_states(self) -> List[str]:
        """Get possible workflow states"""
        return [state.value for state in WorkflowStateEnum] 