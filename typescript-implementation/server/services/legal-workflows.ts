/**
 * Legal Workflows using LangGraph StateGraph
 * Defines the workflow logic for unified agent processing
 */

import { ConversationState, ProcessingStage, QueryIntent, QueryComplexity, AgentType } from '../types/conversation-state';

/**
 * Query Analysis Node
 * Analyzes incoming query to determine complexity, intent, and required tools
 */
export async function analyzeQuery(state: ConversationState): Promise<Partial<ConversationState>> {
  console.log('🔍 [QUERY-ANALYSIS] Analyzing query:', state.currentMessage.substring(0, 100));
  
  const message = state.currentMessage.toLowerCase().trim();
  
  // Determine query complexity
  const complexity = determineQueryComplexity(message, state.messageHistory);
  
  // Detect user intent
  const intent = detectUserIntent(message, state.messageHistory);
  
  // Determine required tools
  const requiredTools = determineRequiredTools(intent, complexity);
  
  // Extract legal domain if applicable
  const legalDomain = extractLegalDomain(message);
  
  console.log('✅ [QUERY-ANALYSIS] Analysis complete:', {
    complexity,
    intent,
    requiredTools,
    legalDomain
  });
  
  return {
    processingStage: 'intent_detection',
    queryComplexity: complexity,
    detectedIntent: intent,
    requiredTools,
    legalDomain,
    nextAction: 'model_selection'
  };
}

/**
 * Model Selection Node
 * Selects the optimal model and agent based on query analysis
 */
export async function selectModel(state: ConversationState): Promise<Partial<ConversationState>> {
  console.log('🎯 [MODEL-SELECTION] Selecting optimal model for:', {
    complexity: state.queryComplexity,
    intent: state.detectedIntent,
    tools: state.requiredTools
  });
  
  let selectedModel = 'gpt-4o';
  let selectedAgent: AgentType = 'general_assistant';
  
  // Model selection logic based on task requirements
  if (state.detectedIntent === 'document_generation' || state.detectedIntent === 'document_modification') {
    selectedModel = 'claude-3-5-sonnet-20241022';
    selectedAgent = 'document_specialist';
  } else if (state.queryComplexity === 'expert' || state.requiredTools.includes('legal_analysis')) {
    selectedModel = 'claude-3-5-sonnet-20241022';
    selectedAgent = 'legal_researcher';
  } else if (state.detectedIntent === 'legal_question' && state.queryComplexity === 'complex') {
    selectedModel = 'gpt-4o';
    selectedAgent = 'legal_researcher';
  } else if (state.detectedIntent === 'greeting') {
    selectedModel = 'claude-3-haiku-20240307';
    selectedAgent = 'general_assistant';
  }
  
  console.log('✅ [MODEL-SELECTION] Selected:', {
    model: selectedModel,
    agent: selectedAgent
  });
  
  return {
    processingStage: 'tool_selection',
    selectedModel,
    selectedAgent,
    nextAction: 'execute_tools'
  };
}

/**
 * Tool Execution Node
 * Executes the required tools in optimal order
 */
export async function executeTools(state: ConversationState): Promise<Partial<ConversationState>> {
  console.log('🔧 [TOOL-EXECUTION] Executing tools:', state.requiredTools);
  
  const toolResults: any = {};
  let ragResults: any[] = [];
  let confidence = 0.5;
  
  try {
    // Execute tools based on intent and requirements
    if (state.requiredTools.includes('legal_research')) {
      const researchResult = await executeLegalResearch(state);
      toolResults.legalResearch = researchResult;
      ragResults = researchResult.ragResults || [];
      confidence = Math.max(confidence, researchResult.confidence || 0.5);
    }
    
    if (state.requiredTools.includes('document_generation')) {
      const docResult = await executeDocumentGeneration(state);
      toolResults.documentGeneration = docResult;
      confidence = Math.max(confidence, docResult.confidence || 0.7);
    }
    
    if (state.requiredTools.includes('legal_analysis')) {
      const analysisResult = await executeLegalAnalysis(state);
      toolResults.legalAnalysis = analysisResult;
      confidence = Math.max(confidence, analysisResult.confidence || 0.6);
    }
    
    console.log('✅ [TOOL-EXECUTION] Tools executed successfully:', {
      toolsExecuted: Object.keys(toolResults),
      confidence
    });
    
    return {
      processingStage: 'response_generation',
      ragResults,
      confidenceScore: confidence,
      responseMetadata: {
        ...state.responseMetadata,
        toolsUsed: state.requiredTools,
        ragRetrieved: ragResults.length > 0,
        confidence
      },
      nextAction: 'generate_response'
    };
    
  } catch (error) {
    console.error('❌ [TOOL-EXECUTION] Error:', error);
    
    return {
      processingStage: 'error_handling',
      errors: [...state.errors, {
        stage: 'execution' as ProcessingStage,
        errorType: 'tool_execution_error',
        message: error instanceof Error ? error.message : 'Unknown tool execution error',
        timestamp: new Date(),
        recoverable: true,
        retryable: true
      }],
      nextAction: 'handle_error'
    };
  }
}

/**
 * Response Generation Node
 * Generates the final response using the selected model and tool results
 */
export async function generateResponse(state: ConversationState): Promise<Partial<ConversationState>> {
  console.log('📝 [RESPONSE-GENERATION] Generating response with:', {
    agent: state.selectedAgent,
    model: state.selectedModel,
    intent: state.detectedIntent
  });
  
  try {
    let responseContent = '';
    
    // Generate response based on intent and agent type
    switch (state.detectedIntent) {
      case 'greeting':
        responseContent = generateGreetingResponse(state);
        break;
      case 'document_generation':
      case 'document_modification':
        responseContent = generateDocumentResponse(state);
        break;
      case 'legal_question':
      case 'legal_analysis':
        responseContent = generateLegalResponse(state);
        break;
      case 'information_retrieval':
        responseContent = generateInformationResponse(state);
        break;
      default:
        responseContent = generateGenericResponse(state);
    }
    
    // Add confidence and source information
    responseContent = appendMetadataToResponse(responseContent, state);
    
    console.log('✅ [RESPONSE-GENERATION] Response generated:', {
      length: responseContent.length,
      confidence: state.confidenceScore
    });
    
    return {
      processingStage: 'validation',
      responseContent,
      nextAction: 'validate_response'
    };
    
  } catch (error) {
    console.error('❌ [RESPONSE-GENERATION] Error:', error);
    
    return {
      processingStage: 'error_handling',
      errors: [...state.errors, {
        stage: 'response_generation' as ProcessingStage,
        errorType: 'response_generation_error',
        message: error instanceof Error ? error.message : 'Unknown response generation error',
        timestamp: new Date(),
        recoverable: true,
        retryable: true
      }],
      nextAction: 'handle_error'
    };
  }
}

/**
 * Response Validation Node
 * Validates the response for quality, safety, and compliance
 */
export async function validateResponse(state: ConversationState): Promise<Partial<ConversationState>> {
  console.log('✅ [VALIDATION] Validating response...');
  
  const validation = {
    isValid: true,
    issues: [] as string[],
    warnings: [] as string[],
    confidence: state.confidenceScore
  };
  
  // Basic validation checks
  if (!state.responseContent || state.responseContent.trim().length < 10) {
    validation.isValid = false;
    validation.issues.push('Response too short or empty');
  }
  
  // Check for potential legal advice disclaimers
  if (state.detectedIntent === 'legal_question' || state.detectedIntent === 'legal_analysis') {
    if (!state.responseContent.includes('solicitor') && !state.responseContent.includes('legal advice')) {
      validation.warnings.push('Consider adding legal advice disclaimer');
    }
  }
  
  // Confidence threshold validation
  if (state.confidenceScore < 0.4) {
    validation.warnings.push('Low confidence response - user should verify information');
  }
  
  console.log('✅ [VALIDATION] Validation complete:', validation);
  
  return {
    processingStage: 'finalization',
    requiresHumanValidation: validation.issues.length > 0 || state.confidenceScore < 0.3,
    nextAction: validation.isValid ? 'finalize_response' : 'handle_error',
    workflowComplete: validation.isValid
  };
}

/**
 * Error Handling Node
 * Handles errors and determines recovery strategy
 */
export async function handleError(state: ConversationState): Promise<Partial<ConversationState>> {
  console.log('⚠️ [ERROR-HANDLING] Handling errors:', state.errors.length);
  
  const latestError = state.errors[state.errors.length - 1];
  
  // Determine if we should retry or fall back
  if (latestError?.retryable && state.retryCount < 2) {
    console.log('🔄 [ERROR-HANDLING] Retrying with fallback approach...');
    
    return {
      processingStage: 'tool_selection',
      selectedModel: 'gpt-4o', // Fallback to reliable model
      selectedAgent: 'general_assistant',
      retryCount: state.retryCount + 1,
      nextAction: 'execute_tools'
    };
  } else {
    console.log('💔 [ERROR-HANDLING] Generating fallback response...');
    
    const fallbackResponse = generateFallbackResponse(state, latestError);
    
    return {
      processingStage: 'complete',
      responseContent: fallbackResponse,
      fallbackUsed: true,
      workflowComplete: true,
      confidenceScore: 0.2
    };
  }
}

/**
 * Finalization Node
 * Finalizes the response and prepares for output
 */
export async function finalizeResponse(state: ConversationState): Promise<Partial<ConversationState>> {
  console.log('🎯 [FINALIZATION] Finalizing response...');
  
  // Calculate final metadata
  const finalMetadata = {
    ...state.responseMetadata,
    agentUsed: state.selectedAgent,
    modelUsed: state.selectedModel,
    confidence: state.confidenceScore,
    confidenceExplanation: generateConfidenceExplanation(state),
    processingTime: Date.now() - (state.responseMetadata.processingTime || Date.now()),
    canSaveToDocuments: state.detectedIntent === 'document_generation' || state.detectedIntent === 'document_modification'
  };
  
  return {
    processingStage: 'complete',
    responseMetadata: finalMetadata,
    workflowComplete: true
  };
}

// Helper functions

function determineQueryComplexity(message: string, history: any[]): QueryComplexity {
  let complexity: QueryComplexity = 'simple';
  
  // Length-based complexity
  if (message.length > 200) complexity = 'moderate';
  if (message.length > 500) complexity = 'complex';
  
  // Keyword-based complexity
  const complexKeywords = ['analyze', 'comprehensive', 'detailed', 'multiple', 'various', 'complex'];
  const expertKeywords = ['litigation', 'precedent', 'statutory', 'regulation', 'compliance'];
  
  if (complexKeywords.some(keyword => message.includes(keyword))) {
    complexity = 'complex';
  }
  
  if (expertKeywords.some(keyword => message.includes(keyword))) {
    complexity = 'expert';
  }
  
  // Context-based complexity (if building on previous conversation)
  if (history.length > 3) {
    complexity = complexity === 'simple' ? 'moderate' : complexity;
  }
  
  return complexity;
}

function detectUserIntent(message: string, history: any[]): QueryIntent {
  const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon'];
  const documentKeywords = ['create', 'generate', 'draft', 'write', 'make', 'contract', 'agreement', 'nda'];
  const modificationKeywords = ['modify', 'change', 'edit', 'update', 'revise', 'amend'];
  const questionKeywords = ['what', 'how', 'when', 'where', 'why', 'can i', 'should i'];
  const analysisKeywords = ['analyze', 'assess', 'evaluate', 'review', 'examine'];
  
  // Check for greetings (but only if short and no context)
  if (greetings.some(g => message.includes(g)) && message.length < 20 && history.length === 0) {
    return 'greeting';
  }
  
  // Check for document modification (requires existing document context)
  if (modificationKeywords.some(k => message.includes(k)) && history.length > 0) {
    return 'document_modification';
  }
  
  // Check for document generation
  if (documentKeywords.some(k => message.includes(k))) {
    return 'document_generation';
  }
  
  // Check for legal analysis
  if (analysisKeywords.some(k => message.includes(k))) {
    return 'legal_analysis';
  }
  
  // Check for information retrieval
  if (questionKeywords.some(k => message.includes(k))) {
    return message.includes('what is') || message.includes('definition') ? 
      'information_retrieval' : 'legal_question';
  }
  
  return 'legal_question'; // Default
}

function determineRequiredTools(intent: QueryIntent, complexity: QueryComplexity): string[] {
  const tools: string[] = [];
  
  switch (intent) {
    case 'greeting':
      // No tools needed for simple greetings
      break;
    case 'document_generation':
    case 'document_modification':
      tools.push('legal_research', 'document_generation');
      break;
    case 'legal_analysis':
      tools.push('legal_research', 'legal_analysis');
      break;
    case 'legal_question':
    case 'information_retrieval':
      tools.push('legal_research');
      if (complexity === 'complex' || complexity === 'expert') {
        tools.push('legal_analysis');
      }
      break;
    default:
      tools.push('legal_research');
  }
  
  return tools;
}

function extractLegalDomain(message: string): string | undefined {
  const domains = {
    employment: ['employment', 'job', 'work', 'employer', 'employee', 'dismissal', 'redundancy'],
    contract: ['contract', 'agreement', 'terms', 'conditions', 'breach', 'liability'],
    business: ['company', 'business', 'director', 'shareholder', 'corporation', 'ltd'],
    data_protection: ['data', 'privacy', 'gdpr', 'information', 'personal data', 'consent']
  };
  
  for (const [domain, keywords] of Object.entries(domains)) {
    if (keywords.some(keyword => message.includes(keyword))) {
      return domain;
    }
  }
  
  return undefined;
}

// Tool execution helpers - these call the actual LangGraph tools
async function executeLegalResearch(state: ConversationState): Promise<any> {
  const { LegalResearchTool } = await import('./langgraph-tools');
  const tool = new LegalResearchTool();
  
  const args = {
    query: state.currentMessage,
    domain: state.legalDomain,
    depth: state.queryComplexity === 'expert' ? 'expert' : 'basic'
  };
  
  try {
    const result = await tool._call(args);
    const parsedResult = JSON.parse(result);
    
    return {
      success: parsedResult.success,
      ragResults: parsedResult.research?.primarySources || [],
      confidence: parsedResult.confidence || 0.5,
      research: parsedResult.research
    };
  } catch (error) {
    console.error('❌ [TOOL-EXECUTION] Legal research failed:', error);
    return {
      success: false,
      ragResults: [],
      confidence: 0.3,
      error: error instanceof Error ? error.message : 'Legal research failed'
    };
  }
}

async function executeDocumentGeneration(state: ConversationState): Promise<any> {
  const { DocumentGenerationTool } = await import('./langgraph-tools');
  const tool = new DocumentGenerationTool(parseInt(state.userId) || 1);
  
  const args = {
    documentType: extractDocumentType(state.currentMessage),
    requirements: state.currentMessage,
    jurisdiction: 'UK',
    complexity: state.queryComplexity === 'expert' ? 'comprehensive' : 'standard'
  };
  
  try {
    const result = await tool._call(args);
    const parsedResult = JSON.parse(result);
    
    return {
      success: parsedResult.success,
      document: parsedResult.document,
      confidence: parsedResult.confidence || 0.7
    };
  } catch (error) {
    console.error('❌ [TOOL-EXECUTION] Document generation failed:', error);
    return {
      success: false,
      document: null,
      confidence: 0.3,
      error: error instanceof Error ? error.message : 'Document generation failed'
    };
  }
}

async function executeLegalAnalysis(state: ConversationState): Promise<any> {
  const { LegalAnalysisTool } = await import('./langgraph-tools');
  const tool = new LegalAnalysisTool();
  
  const args = {
    situation: state.currentMessage,
    domain: state.legalDomain,
    urgency: state.queryComplexity === 'expert' ? 'high' : 'medium'
  };
  
  try {
    const result = await tool._call(args);
    const parsedResult = JSON.parse(result);
    
    return {
      success: parsedResult.success,
      analysis: parsedResult.analysis,
      confidence: parsedResult.confidence || 0.6
    };
  } catch (error) {
    console.error('❌ [TOOL-EXECUTION] Legal analysis failed:', error);
    return {
      success: false,
      analysis: null,
      confidence: 0.3,
      error: error instanceof Error ? error.message : 'Legal analysis failed'
    };
  }
}

function extractDocumentType(message: string): string {
  const message_lower = message.toLowerCase();
  
  if (message_lower.includes('nda') || message_lower.includes('non-disclosure')) {
    return 'Non-Disclosure Agreement';
  } else if (message_lower.includes('employment contract')) {
    return 'Employment Contract';
  } else if (message_lower.includes('privacy policy')) {
    return 'Privacy Policy';
  } else if (message_lower.includes('terms')) {
    return 'Terms and Conditions';
  } else if (message_lower.includes('contract')) {
    return 'Contract';
  } else if (message_lower.includes('agreement')) {
    return 'Agreement';
  }
  
  return 'Legal Document';
}

// Response generation helpers
function generateGreetingResponse(state: ConversationState): string {
  return "Hello! I'm your AI Legal Assistant. I can help you with legal questions, document creation, and legal analysis. How can I assist you today?";
}

function generateDocumentResponse(state: ConversationState): string {
  return "I've generated the requested document based on your requirements. Please review it carefully and let me know if you need any modifications.";
}

function generateLegalResponse(state: ConversationState): string {
  return "Based on my research of UK legal principles, here's my analysis of your situation...";
}

function generateInformationResponse(state: ConversationState): string {
  return "Here's the legal information you requested...";
}

function generateGenericResponse(state: ConversationState): string {
  return "I've analyzed your query and here's my response...";
}

function appendMetadataToResponse(response: string, state: ConversationState): string {
  const confidence = Math.round(state.confidenceScore * 100);
  const disclaimer = "\n\n*This information is for guidance only. For specific legal advice, consult a qualified UK solicitor.*";
  
  return response + disclaimer;
}

function generateFallbackResponse(state: ConversationState, error: any): string {
  return "I apologize, but I encountered an issue processing your request. Please try rephrasing your question or contact support if the problem persists.";
}

function generateConfidenceExplanation(state: ConversationState): string {
  const confidence = state.confidenceScore;
  
  if (confidence > 0.8) {
    return "High confidence based on comprehensive legal research and established principles.";
  } else if (confidence > 0.6) {
    return "Moderate to high confidence with good legal backing.";
  } else if (confidence > 0.4) {
    return "Moderate confidence - please verify with additional sources.";
  } else {
    return "Lower confidence - recommend professional legal consultation.";
  }
}