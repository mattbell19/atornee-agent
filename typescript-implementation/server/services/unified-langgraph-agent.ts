/**
 * Unified LangGraph Agent Service
 * Phase 1: Core LangGraph Migration
 * Replaces the three separate agent services with a coordinated workflow
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { 
  ConversationState, 
  createInitialState, 
  updateState,
  ConversationMessage 
} from '../types/conversation-state';
import { 
  analyzeQuery, 
  selectModel, 
  executeTools, 
  generateResponse, 
  validateResponse, 
  handleError, 
  finalizeResponse 
} from './legal-workflows';
import { LangGraphToolRegistry } from './langgraph-tools';
import { chatBetaRAGService } from './chat-beta-rag-service';
// Phase 2 imports - conditional loading to prevent build failures
// import { aiModelSelector, QueryAnalysis } from './ai-model-selector';
// import { proactiveAssistant } from './proactive-assistant';
// import { documentWorkflow } from './document-workflow';
// import { contextualMemory } from './contextual-memory';

// Phase 3 imports - Domain specialist handlers
import { employmentLawHandler } from './legal-domain-handlers/employment-law-handler';
import { businessLawSpecialist } from './legal-domain-handlers/business-law-specialist';
import { contractSpecialist } from './legal-domain-handlers/contract-specialist';
import { complianceOfficer } from './legal-domain-handlers/compliance-officer';
import { crossDomainCoordinator } from './cross-domain-coordinator';

/**
 * State annotation for LangGraph
 */
const StateAnnotation = Annotation.Root({
  // Core state
  currentMessage: Annotation<string>,
  conversationId: Annotation<string>,
  userId: Annotation<string>,
  messageHistory: Annotation<ConversationMessage[]>,
  
  // Processing state
  queryComplexity: Annotation<string>,
  detectedIntent: Annotation<string>,
  requiredTools: Annotation<string[]>,
  processingStage: Annotation<string>,
  selectedModel: Annotation<string>,
  selectedAgent: Annotation<string>,
  
  // Results
  ragResults: Annotation<any[]>,
  confidenceScore: Annotation<number>,
  responseContent: Annotation<string>,
  responseMetadata: Annotation<any>,
  
  // Control flow
  errors: Annotation<any[]>,
  retryCount: Annotation<number>,
  fallbackUsed: Annotation<boolean>,
  nextAction: Annotation<string>,
  workflowComplete: Annotation<boolean>,
  requiresHumanValidation: Annotation<boolean>,
  
  // Optional contexts
  legalDomain: Annotation<string>,
  matterContext: Annotation<any>,
  documentContext: Annotation<any>,
  
  // Phase 3: Domain specialists
  detectedDomain: Annotation<string>,
  specialistAgent: Annotation<string>,
  domainAnalysis: Annotation<any>,
  crossDomainRequirements: Annotation<string[]>,
  crossDomainAnalysis: Annotation<any>,
  requiresCrossDomainCoordination: Annotation<boolean>,
  
  // Phase 2: Enhanced Intelligence
  contextualMemory: Annotation<any>,
  proactiveRecommendations: Annotation<any[]>,
  aiModelSelection: Annotation<any>,
  documentVersions: Annotation<any[]>
});

export interface UnifiedAgentResponse {
  content: string;
  metadata: {
    agentUsed: string;
    modelUsed: string;
    toolsUsed: string[];
    ragRetrieved: boolean;
    confidence: number;
    confidenceExplanation: string;
    sources: Array<{
      title: string;
      source: string;
      domain: string;
    }>;
    responseTime: number;
    risksIdentified: string[];
    recommendations: string[];
    canSaveToDocuments: boolean;
    workflowStages: string[];
    errors: any[];
    
    // Phase 2: Enhanced Intelligence metadata
    aiModelSelection?: {
      selectedModel: string;
      reasoning: string;
      confidence: number;
      estimatedComplexity: string;
    };
    proactiveRecommendations?: Array<{
      type: string;
      title: string;
      content: string;
      priority: string;
      actionable: boolean;
    }>;
    contextualMemory?: {
      memoryUsed: boolean;
      relevantMemories: number;
      userPreferences: any;
    };
    documentWorkflow?: {
      versionCreated: boolean;
      workflowStage: string;
      complianceChecks: number;
    };
    
    // Phase 3: Specialist domain analysis
    domainSpecialist?: {
      primaryDomain: string;
      specialistUsed: string;
      domainConfidence: number;
      crossDomainRequirements: string[];
      specialistAnalysis: any;
    };
  };
}

/**
 * Unified LangGraph Agent Service
 */
export class UnifiedLangGraphAgent {
  private workflow: StateGraph<any>;
  private compiledWorkflow: any; // Memoized compiled workflow
  private toolRegistry: LangGraphToolRegistry;
  private models: Map<string, any> = new Map();
  private isInitialized = false;

  constructor() {
    console.log('🚀 [UNIFIED-AGENT] Initializing unified LangGraph agent...');
    
    // Initialize tool registry
    this.toolRegistry = new LangGraphToolRegistry();
    
    // Initialize models
    this.initializeModels();
    
    // Create the workflow
    this.workflow = this.createWorkflow();
    
    console.log('✅ [UNIFIED-AGENT] Unified agent created');
  }

  /**
   * Initialize available models
   */
  private initializeModels(): void {
    // OpenAI models
    this.models.set('gpt-4o', new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o',
      temperature: 0.1,
      maxTokens: 4096
    }));

    this.models.set('gpt-4o-mini', new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o-mini',
      temperature: 0.1,
      maxTokens: 4096
    }));

    // Anthropic models
    if (process.env.ANTHROPIC_API_KEY) {
      this.models.set('claude-3-5-sonnet-20241022', new ChatAnthropic({
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        modelName: 'claude-3-5-sonnet-20241022',
        temperature: 0.1,
        maxTokens: 8192
      }));

      this.models.set('claude-3-haiku-20240307', new ChatAnthropic({
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        modelName: 'claude-3-haiku-20240307',
        temperature: 0.3,
        maxTokens: 4096
      }));
    }

    console.log('🤖 [UNIFIED-AGENT] Models initialized:', Array.from(this.models.keys()));
  }

  /**
   * Create the LangGraph workflow
   */
  private createWorkflow(): StateGraph<any> {
    console.log('📊 [UNIFIED-AGENT] Creating workflow graph...');
    
    const workflow = new StateGraph(StateAnnotation)
      // Phase 1: Core workflow nodes
      .addNode('analyze_query', this.wrapWorkflowNode(analyzeQuery))
      .addNode('detect_domain', this.wrapWorkflowNode(this.detectLegalDomain.bind(this)))
      .addNode('route_specialist', this.wrapWorkflowNode(this.routeToSpecialist.bind(this)))
      .addNode('coordinate_domains', this.wrapWorkflowNode(this.coordinateCrossDomain.bind(this)))
      .addNode('select_model', this.wrapWorkflowNode(this.enhancedModelSelection.bind(this)))
      .addNode('retrieve_context', this.wrapWorkflowNode(this.retrieveContextualMemory.bind(this)))
      .addNode('execute_tools', this.wrapWorkflowNode(this.executeToolsNode.bind(this)))
      .addNode('generate_response', this.wrapWorkflowNode(this.generateResponseNode.bind(this)))
      .addNode('generate_proactive', this.wrapWorkflowNode(this.generateProactiveRecommendations.bind(this)))
      .addNode('validate_response', this.wrapWorkflowNode(validateResponse))
      .addNode('store_memory', this.wrapWorkflowNode(this.storeConversationMemory.bind(this)))
      .addNode('handle_error', this.wrapWorkflowNode(handleError))
      .addNode('finalize_response', this.wrapWorkflowNode(finalizeResponse));

    // Define the enhanced workflow edges with Phase 3 domain routing and coordination
    workflow
      .addEdge(START, 'analyze_query')
      .addEdge('analyze_query', 'detect_domain')
      .addEdge('detect_domain', 'route_specialist')
      .addConditionalEdges('route_specialist', this.shouldCoordinateDomains, {
        coordinate: 'coordinate_domains',
        continue: 'retrieve_context'
      })
      .addEdge('coordinate_domains', 'retrieve_context')
      .addEdge('retrieve_context', 'select_model')
      .addEdge('select_model', 'execute_tools')
      .addEdge('execute_tools', 'generate_response')
      .addEdge('generate_response', 'generate_proactive')
      .addEdge('generate_proactive', 'validate_response')
      .addConditionalEdges('validate_response', this.shouldFinalize, {
        finalize: 'store_memory',
        error: 'handle_error'
      })
      .addConditionalEdges('handle_error', this.shouldRetry, {
        retry: 'select_model',
        end: END
      })
      .addEdge('store_memory', 'finalize_response')
      .addEdge('finalize_response', END);

    console.log('✅ [UNIFIED-AGENT] Workflow graph created');
    return workflow;
  }

  /**
   * Wrap workflow nodes with error handling and logging
   */
  private wrapWorkflowNode(nodeFunction: Function) {
    return async (state: any) => {
      const nodeName = nodeFunction.name;
      console.log(`🔄 [WORKFLOW-${nodeName.toUpperCase()}] Starting...`);
      
      try {
        const result = await nodeFunction(state);
        console.log(`✅ [WORKFLOW-${nodeName.toUpperCase()}] Completed`);
        return result;
      } catch (error) {
        console.error(`❌ [WORKFLOW-${nodeName.toUpperCase()}] Error:`, error);
        return {
          ...state,
          errors: [...(state.errors || []), {
            stage: nodeName,
            errorType: 'workflow_node_error',
            message: error instanceof Error ? error.message : 'Unknown workflow error',
            timestamp: new Date(),
            recoverable: true,
            retryable: true
          }],
          nextAction: 'handle_error'
        };
      }
    };
  }

  /**
   * Enhanced AI-powered model selection node (Phase 2 - temporarily disabled)
   */
  private async enhancedModelSelection(state: ConversationState): Promise<Partial<ConversationState>> {
    console.log('🎯 [MODEL-SELECTION] Using fallback model selection...');
    
    // Phase 2 functionality temporarily disabled for deployment
    // Fallback to original selection logic
    return selectModel(state);
  }

  /**
   * Contextual memory retrieval node (Phase 2 - temporarily disabled)
   */
  private async retrieveContextualMemory(state: ConversationState): Promise<Partial<ConversationState>> {
    console.log('🧠 [MEMORY] Skipping contextual memory (Phase 2 disabled)...');
    
    // Phase 2 functionality temporarily disabled for deployment
    return {
      processingStage: 'model_selection',
      contextualMemory: null,
      nextAction: 'select_model'
    };
  }

  /**
   * Proactive recommendations generation node (Phase 2 - temporarily disabled)
   */
  private async generateProactiveRecommendations(state: ConversationState): Promise<Partial<ConversationState>> {
    console.log('🔮 [PROACTIVE] Skipping proactive recommendations (Phase 2 disabled)...');
    
    // Phase 2 functionality temporarily disabled for deployment
    return {
      processingStage: 'validation',
      proactiveRecommendations: [],
      nextAction: 'validate_response'
    };
  }

  /**
   * Store conversation memory node (Phase 2 - temporarily disabled)
   */
  private async storeConversationMemory(state: ConversationState): Promise<Partial<ConversationState>> {
    console.log('💾 [MEMORY] Skipping memory storage (Phase 2 disabled)...');
    
    // Phase 2 functionality temporarily disabled for deployment
    return {
      processingStage: 'finalization',
      nextAction: 'finalize_response'
    };
  }

  /**
   * Enhanced tool execution node
   */
  private async executeToolsNode(state: ConversationState): Promise<Partial<ConversationState>> {
    console.log('🔧 [EXECUTE-TOOLS] Executing tools:', state.requiredTools);
    
    const toolResults: any = {};
    let ragResults: any[] = [];
    let confidence = 0.5;
    const sources: any[] = [];
    
    try {
      // Execute legal research if required
      if (state.requiredTools?.includes('legal_research')) {
        const researchTool = this.toolRegistry.getTool('legal_research');
        if (researchTool) {
          const researchArgs = {
            query: state.currentMessage,
            domain: state.legalDomain || state.detectedDomain,
            depth: state.queryComplexity === 'expert' ? 'expert' : 'basic',
            conversationMemory: this.buildConversationMemory(state)
          };
          
          const researchResult = await researchTool._call(researchArgs);
          const parsedResult = JSON.parse(researchResult);
          
          if (parsedResult.success) {
            toolResults.legalResearch = parsedResult.research;
            ragResults = parsedResult.research?.primarySources || [];
            confidence = Math.max(confidence, parsedResult.confidence || 0.5);
            
            // Extract sources
            ragResults.forEach(source => {
              sources.push({
                title: source.title,
                source: source.source,
                domain: source.domain
              });
            });
          }
        }
      }
      
      // Execute document generation if required
      if (state.requiredTools?.includes('document_generation')) {
        const docTool = this.toolRegistry.getTool('document_generation');
        if (docTool) {
          const docArgs = {
            documentType: this.extractDocumentType(state.currentMessage),
            requirements: state.currentMessage,
            jurisdiction: 'UK',
            complexity: state.queryComplexity === 'expert' ? 'comprehensive' : 'standard'
          };
          
          const docResult = await docTool._call(docArgs);
          const parsedResult = JSON.parse(docResult);
          
          if (parsedResult.success) {
            toolResults.documentGeneration = parsedResult.document;
            confidence = Math.max(confidence, parsedResult.confidence || 0.7);
          }
        }
      }
      
      // Execute legal analysis if required
      if (state.requiredTools?.includes('legal_analysis')) {
        const analysisTool = this.toolRegistry.getTool('legal_analysis');
        if (analysisTool) {
          const analysisArgs = {
            situation: state.currentMessage,
            domain: state.legalDomain,
            urgency: state.queryComplexity === 'expert' ? 'high' : 'medium'
          };
          
          const analysisResult = await analysisTool._call(analysisArgs);
          const parsedResult = JSON.parse(analysisResult);
          
          if (parsedResult.success) {
            toolResults.legalAnalysis = parsedResult.analysis;
            confidence = Math.max(confidence, parsedResult.confidence || 0.6);
          }
        }
      }
      
      console.log('✅ [EXECUTE-TOOLS] All tools executed:', {
        toolsExecuted: Object.keys(toolResults),
        finalConfidence: confidence,
        sourcesFound: sources.length
      });
      
      return {
        processingStage: 'response_generation',
        ragResults,
        confidenceScore: confidence,
        responseMetadata: {
          ...state.responseMetadata,
          toolsUsed: state.requiredTools || [],
          ragRetrieved: ragResults.length > 0,
          confidence,
          sources
        },
        nextAction: 'generate_response'
      };
      
    } catch (error) {
      console.error('❌ [EXECUTE-TOOLS] Error:', error);
      throw error; // Let the wrapper handle it
    }
  }

  /**
   * Enhanced response generation node
   */
  private async generateResponseNode(state: ConversationState): Promise<Partial<ConversationState>> {
    console.log('📝 [GENERATE-RESPONSE] Generating response with model:', state.selectedModel);
    console.log('📝 [GENERATE-RESPONSE] Available models:', Array.from(this.models.keys()));
    console.log('📝 [GENERATE-RESPONSE] State details:', {
      detectedIntent: state.detectedIntent,
      selectedModel: state.selectedModel,
      processingStage: state.processingStage
    });
    
    try {
      await this.initialize(); // Ensure models are initialized
      
      const modelName = state.selectedModel || 'gpt-4o';
      const model = this.models.get(modelName);
      console.log('📝 [GENERATE-RESPONSE] Using model:', modelName, 'Found:', !!model);
      
      if (!model) {
        console.error('❌ [GENERATE-RESPONSE] Model not found:', modelName);
        console.error('❌ [GENERATE-RESPONSE] Available models:', Array.from(this.models.keys()));
        throw new Error(`Model ${modelName} not available`);
      }
      
      // Build context from tool results
      const context = this.buildContextForGeneration(state);
      console.log('📝 [GENERATE-RESPONSE] Context built, length:', context.length);
      
      // Generate system prompt based on intent
      const systemPrompt = this.buildSystemPrompt(state);
      console.log('📝 [GENERATE-RESPONSE] System prompt built, length:', systemPrompt.length);
      
      const userMessage = `${context}\n\nUser Query: ${state.currentMessage}`;
      console.log('📝 [GENERATE-RESPONSE] About to invoke model with message length:', userMessage.length);
      
      // Generate response using selected model
      const response = await model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userMessage)
      ]);
      
      const responseContent = response.content as string;
      console.log('📝 [GENERATE-RESPONSE] Model response received, length:', responseContent.length);
      
      // Add legal disclaimer and metadata
      const finalResponse = this.addDisclaimer(responseContent, state);
      
      console.log('✅ [GENERATE-RESPONSE] Response generated:', {
        length: finalResponse.length,
        model: state.selectedModel
      });
      
      return {
        processingStage: 'validation',
        responseContent: finalResponse,
        nextAction: 'validate_response'
      };
      
    } catch (error) {
      console.error('❌ [GENERATE-RESPONSE] Error:', error);
      throw error; // Let the wrapper handle it
    }
  }

  /**
   * Conditional edge: Should we finalize or handle error?
   */
  private shouldFinalize(state: any): string {
    return state.workflowComplete && !state.requiresHumanValidation ? 'finalize' : 'error';
  }

  /**
   * Conditional edge: Should we retry or end?
   */
  private shouldRetry(state: any): string {
    return state.retryCount < 2 && state.errors?.some((e: any) => e.retryable) ? 'retry' : 'end';
  }

  /**
   * Main processing method
   */
  async processQuery(
    query: string,
    options?: {
      userId?: string;
      conversationId?: string;
      domain?: string;
      conversationHistory?: Array<{ role: string; content: string }>;
    }
  ): Promise<UnifiedAgentResponse> {
    const startTime = Date.now();
    
    console.log('🚀 [UNIFIED-AGENT] Processing query:', {
      query: query.substring(0, 100),
      options: {
        userId: options?.userId,
        conversationId: options?.conversationId,
        domain: options?.domain,
        historyLength: options?.conversationHistory?.length || 0
      }
    });
    
    try {
      // Initialize RAG service if needed
      await chatBetaRAGService.initialize();
      
      // Create initial state
      const history: ConversationMessage[] = options?.conversationHistory?.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        timestamp: new Date()
      })) || [];
      
      const initialState = createInitialState(
        query,
        options?.conversationId || 'default',
        options?.userId || 'default',
        history
      );
      
      // Add domain if provided
      if (options?.domain) {
        initialState.legalDomain = options.domain as any;
      }
      
      console.log('📊 [UNIFIED-AGENT] Initial state created, starting workflow...');
      
      // Use memoized compiled workflow for performance
      if (!this.compiledWorkflow) {
        console.log('📊 [UNIFIED-AGENT] Compiling workflow for first time...');
        this.compiledWorkflow = this.workflow.compile();
      }
      const finalState = await this.compiledWorkflow.invoke(initialState);
      
      const responseTime = Date.now() - startTime;
      
      console.log('✅ [UNIFIED-AGENT] Workflow completed:', {
        responseLength: finalState.responseContent?.length || 0,
        confidence: finalState.confidenceScore,
        toolsUsed: finalState.responseMetadata?.toolsUsed || [],
        processingTime: responseTime
      });
      
      // Build unified response with Phase 2 enhancements
      return {
        content: finalState.responseContent || 'No response generated',
        metadata: {
          agentUsed: finalState.selectedAgent || 'unified_agent',
          modelUsed: finalState.selectedModel || 'unknown',
          toolsUsed: finalState.responseMetadata?.toolsUsed || [],
          ragRetrieved: finalState.responseMetadata?.ragRetrieved || false,
          confidence: finalState.confidenceScore || 0.5,
          confidenceExplanation: this.generateConfidenceExplanation(finalState.confidenceScore || 0.5),
          sources: finalState.responseMetadata?.sources || [],
          responseTime,
          risksIdentified: this.extractRisks(finalState),
          recommendations: this.extractRecommendations(finalState),
          canSaveToDocuments: finalState.detectedIntent === 'document_generation',
          workflowStages: this.extractWorkflowStages(finalState),
          errors: finalState.errors || [],
          
          // Phase 2: Enhanced Intelligence metadata
          aiModelSelection: finalState.aiModelSelection ? {
            selectedModel: finalState.aiModelSelection.selectedModel,
            reasoning: finalState.aiModelSelection.reasoning,
            confidence: finalState.aiModelSelection.confidence,
            estimatedComplexity: finalState.aiModelSelection.estimatedComplexity
          } : undefined,
          
          proactiveRecommendations: finalState.proactiveRecommendations?.map((rec: any) => ({
            type: rec.type,
            title: rec.title,
            content: rec.content,
            priority: rec.priority,
            actionable: rec.actionable
          })) || [],
          
          contextualMemory: finalState.contextualMemory ? {
            memoryUsed: true,
            relevantMemories: finalState.contextualMemory.relevantMemories?.length || 0,
            userPreferences: finalState.contextualMemory.userContext
          } : { memoryUsed: false, relevantMemories: 0, userPreferences: null },
          
          documentWorkflow: finalState.documentVersions?.length > 0 ? {
            versionCreated: true,
            workflowStage: 'created',
            complianceChecks: 0
          } : { versionCreated: false, workflowStage: 'none', complianceChecks: 0 },
          
          // Phase 3: Specialist domain analysis
          domainSpecialist: finalState.detectedDomain && finalState.detectedDomain !== 'general' ? {
            primaryDomain: finalState.detectedDomain,
            specialistUsed: finalState.specialistAgent || 'general',
            domainConfidence: this.calculateDomainConfidence(finalState),
            crossDomainRequirements: finalState.crossDomainRequirements || [],
            specialistAnalysis: finalState.domainAnalysis
          } : undefined
        }
      };
      
    } catch (error) {
      console.error('❌ [UNIFIED-AGENT] Workflow error:', error);
      
      const responseTime = Date.now() - startTime;
      
      return {
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        metadata: {
          agentUsed: 'error_handler',
          modelUsed: 'none',
          toolsUsed: [],
          ragRetrieved: false,
          confidence: 0.1,
          confidenceExplanation: 'Error occurred during processing',
          sources: [],
          responseTime,
          risksIdentified: ['System error during processing'],
          recommendations: ['Please try again or contact support'],
          canSaveToDocuments: false,
          workflowStages: ['initialization', 'error'],
          errors: [{
            stage: 'workflow',
            errorType: 'processing_error',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
            recoverable: true,
            retryable: true
          }]
        }
      };
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    toolsAvailable: string[];
    modelsAvailable: string[];
    workflowNodes: string[];
  } {
    return {
      initialized: this.isInitialized,
      toolsAvailable: this.toolRegistry.getToolNames(),
      modelsAvailable: Array.from(this.models.keys()),
      workflowNodes: [
        'analyze_query',
        'detect_domain',
        'route_specialist',
        'coordinate_domains',
        'retrieve_context',
        'select_model', 
        'execute_tools',
        'generate_response',
        'generate_proactive',
        'validate_response',
        'store_memory',
        'handle_error',
        'finalize_response'
      ]
    };
  }

  // Helper methods

  /**
   * Calculate domain detection confidence score
   */
  private calculateDomainConfidence(state: ConversationState): number {
    if (!state.detectedDomain || state.detectedDomain === 'general') {
      return 0.5;
    }
    
    // Calculate confidence based on keyword matches and cross-domain complexity
    const crossDomainPenalty = (state.crossDomainRequirements?.length || 0) * 0.1;
    const baseConfidence = 0.8; // Starting confidence for domain detection
    
    return Math.max(0.5, Math.min(1.0, baseConfidence - crossDomainPenalty));
  }

  /**
   * Build conversation memory context for enhanced RAG
   */
  private buildConversationMemory(state: ConversationState): {
    previousQueries: string[];
    domainHistory: string[];
    userPreferences?: any;
    matterContext?: any;
  } {
    const previousQueries = state.messageHistory
      ?.filter(msg => msg.role === 'user')
      ?.slice(-3) // Last 3 user messages
      ?.map(msg => msg.content) || [];

    // Build domain history from conversation
    const domainHistory: string[] = [];
    if (state.detectedDomain && state.detectedDomain !== 'general') {
      domainHistory.push(state.detectedDomain);
    }
    if (state.legalDomain && state.legalDomain !== state.detectedDomain) {
      domainHistory.push(state.legalDomain);
    }

    // Extract user preferences from contextual memory
    const userPreferences = state.contextualMemory?.userContext || undefined;

    return {
      previousQueries,
      domainHistory,
      userPreferences,
      matterContext: state.matterContext
    };
  }

  /**
   * Map AI-selected model to agent type
   */
  private mapModelToAgent(modelName: string): AgentType {
    switch (modelName) {
      case 'claude-3-5-sonnet-20241022':
        return 'document_specialist';
      case 'claude-3-haiku-20240307':
        return 'general_assistant';
      case 'gpt-4o':
        return 'legal_researcher';
      case 'gpt-4o-mini':
        return 'general_assistant';
      default:
        return 'enhanced_router';
    }
  }

  private extractDocumentType(message: string): string {
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

  private buildContextForGeneration(state: ConversationState): string {
    let context = '';
    
    // Phase 3: Add domain specialist context
    if (state.detectedDomain && state.detectedDomain !== 'general') {
      context += `LEGAL DOMAIN ANALYSIS:\n`;
      context += `Primary Domain: ${state.detectedDomain}\n`;
      context += `Specialist Agent: ${state.specialistAgent}\n`;
      
      if (state.crossDomainRequirements && state.crossDomainRequirements.length > 0) {
        context += `Cross-Domain Requirements: ${state.crossDomainRequirements.join(', ')}\n`;
      }
      
      // Add cross-domain coordination analysis
      if (state.crossDomainAnalysis && state.requiresCrossDomainCoordination) {
        context += `CROSS-DOMAIN COORDINATION:\n`;
        context += `Specialists Consulted: ${state.crossDomainAnalysis.specialistInputs?.map((s: any) => s.domain).join(', ')}\n`;
        context += `Overall Confidence: ${state.crossDomainAnalysis.overallConfidence}\n`;
        
        if (state.crossDomainAnalysis.crossDomainRisks?.length > 0) {
          context += `Key Risks: ${state.crossDomainAnalysis.crossDomainRisks.slice(0, 2).join(', ')}\n`;
        }
        
        if (state.crossDomainAnalysis.integrationPoints?.length > 0) {
          context += `Integration Points: ${state.crossDomainAnalysis.integrationPoints.slice(0, 2).join(', ')}\n`;
        }
        context += '\n';
      }
      
      if (state.domainAnalysis) {
        context += `Domain Analysis: ${JSON.stringify(state.domainAnalysis).substring(0, 200)}...\n`;
      }
      context += '\n';
    }
    
    // Add conversation history
    if (state.messageHistory && state.messageHistory.length > 0) {
      context += 'CONVERSATION CONTEXT:\n';
      state.messageHistory.slice(-4).forEach(msg => {
        context += `${msg.role.toUpperCase()}: ${msg.content}\n`;
      });
      context += '\n';
    }
    
    // Add RAG results with domain prioritization
    if (state.ragResults && state.ragResults.length > 0) {
      context += 'RELEVANT LEGAL INFORMATION:\n';
      // Prioritize domain-specific results if available
      const domainResults = state.ragResults.filter(r => 
        state.detectedDomain && r.domain === state.detectedDomain
      );
      const generalResults = state.ragResults.filter(r => 
        !state.detectedDomain || r.domain !== state.detectedDomain
      );
      
      const prioritizedResults = [...domainResults, ...generalResults].slice(0, 3);
      prioritizedResults.forEach(result => {
        context += `[${result.domain?.toUpperCase() || 'GENERAL'}] ${result.title}: ${result.content.substring(0, 300)}...\n\n`;
      });
    }
    
    // Add matter context if available
    if (state.matterContext) {
      context += 'MATTER CONTEXT:\n';
      context += `Matter: ${state.matterContext.title || 'Unspecified'}\n`;
      if (state.matterContext.description) {
        context += `Description: ${state.matterContext.description.substring(0, 200)}...\n`;
      }
      context += '\n';
    }
    
    return context;
  }

  private buildSystemPrompt(state: ConversationState): string {
    let basePrompt = `You are an expert UK legal assistant. Provide accurate, helpful legal guidance while recommending professional legal advice for specific situations.`;
    
    // Phase 3: Add domain-specific expertise
    if (state.detectedDomain && state.specialistAgent && state.detectedDomain !== 'general') {
      const domainPrompts = {
        employment: `You are specifically drawing on employment law expertise, focusing on UK employment rights, dismissal procedures, discrimination law, and workplace regulations.`,
        business: `You are specifically drawing on business law expertise, focusing on UK corporate governance, company formation, commercial structures, and business compliance.`,
        contract: `You are specifically drawing on contract law expertise, focusing on UK contract principles, commercial agreements, risk assessment, and contract negotiation.`,
        compliance: `You are specifically drawing on regulatory compliance expertise, focusing on UK regulatory requirements, data protection, health & safety, and corporate compliance.`
      };
      
      const domainPrompt = domainPrompts[state.detectedDomain as keyof typeof domainPrompts];
      if (domainPrompt) {
        basePrompt += '\n\n' + domainPrompt;
      }
      
      if (state.crossDomainRequirements && state.crossDomainRequirements.length > 0) {
        basePrompt += `\n\nThis query also touches on: ${state.crossDomainRequirements.join(', ')}. Consider cross-domain implications in your response.`;
      }
    }
    
    let specificPrompt = '';
    
    switch (state.detectedIntent) {
      case 'greeting':
        specificPrompt = 'Respond naturally to the user\'s greeting and briefly introduce your capabilities.';
        break;
      case 'document_generation':
        specificPrompt = 'Generate a professional legal document based on the requirements. Include all necessary clauses and proper formatting.';
        break;
      case 'legal_analysis':
        specificPrompt = 'Provide structured legal analysis including key issues, applicable law, risks, and recommendations.';
        break;
      default:
        specificPrompt = 'Answer the legal question clearly and provide practical guidance based on UK law.';
    }
    
    return `${basePrompt}\n\n${specificPrompt}\n\nAlways include appropriate disclaimers about seeking professional legal advice.`;
  }

  private addDisclaimer(response: string, state: ConversationState): string {
    const disclaimer = '\n\n*This information is for guidance only. For specific legal advice, consult a qualified UK solicitor.*';
    return response + disclaimer;
  }

  private generateConfidenceExplanation(confidence: number): string {
    if (confidence > 0.8) {
      return 'High confidence based on comprehensive legal research and established principles.';
    } else if (confidence > 0.6) {
      return 'Moderate to high confidence with good legal backing.';
    } else if (confidence > 0.4) {
      return 'Moderate confidence - please verify with additional sources.';
    } else {
      return 'Lower confidence - recommend professional legal consultation.';
    }
  }

  private extractRisks(state: any): string[] {
    const risks = [];
    
    if (state.confidenceScore < 0.6) {
      risks.push('Information may require verification');
    }
    
    if (state.detectedIntent === 'legal_analysis') {
      risks.push('Fact-specific circumstances may vary outcome');
    }
    
    if (state.queryComplexity === 'expert') {
      risks.push('Complex legal matter requiring specialist advice');
    }
    
    return risks;
  }

  private extractRecommendations(state: any): string[] {
    const recommendations = ['Consider professional legal advice for important decisions'];
    
    if (state.ragResults && state.ragResults.length > 0) {
      recommendations.push('Review the specific legal sources provided');
    }
    
    if (state.detectedIntent === 'document_generation') {
      recommendations.push('Have document reviewed by qualified solicitor before use');
    }
    
    return recommendations;
  }

  private extractWorkflowStages(state: any): string[] {
    // Extract the stages that were actually completed
    const stages = ['initialization'];
    
    if (state.queryComplexity) stages.push('query_analysis');
    if (state.detectedDomain) stages.push('domain_detection');
    if (state.specialistAgent) stages.push('specialist_routing');
    if (state.requiresCrossDomainCoordination) stages.push('cross_domain_coordination');
    if (state.contextualMemory) stages.push('context_retrieval');
    if (state.aiModelSelection) stages.push('ai_model_selection');
    if (state.selectedModel) stages.push('model_selection');
    if (state.responseMetadata?.toolsUsed?.length > 0) stages.push('tool_execution');
    if (state.responseContent) stages.push('response_generation');
    if (state.proactiveRecommendations?.length > 0) stages.push('proactive_recommendations');
    if (state.workflowComplete) stages.push('validation', 'memory_storage', 'finalization');
    
    return stages;
  }

  // Phase 3: Domain Detection and Specialist Routing

  /**
   * Conditional edge function to determine if cross-domain coordination is needed
   */
  private shouldCoordinateDomains(state: ConversationState): string {
    return state.crossDomainRequirements && state.crossDomainRequirements.length > 0 ? 'coordinate' : 'continue';
  }

  /**
   * Cross-domain coordination node
   */
  private async coordinateCrossDomain(state: ConversationState): Promise<Partial<ConversationState>> {
    console.log('🔗 [CROSS-DOMAIN] Starting cross-domain coordination...', {
      primaryDomain: state.detectedDomain,
      crossDomains: state.crossDomainRequirements
    });

    try {
      if (!state.crossDomainRequirements || state.crossDomainRequirements.length === 0) {
        return {
          requiresCrossDomainCoordination: false,
          processingStage: 'context_retrieval',
          nextAction: 'retrieve_context'
        };
      }

      const coordinationRequest = {
        query: state.currentMessage,
        primaryDomain: state.detectedDomain || 'general',
        crossDomainRequirements: state.crossDomainRequirements,
        conversationMemory: this.buildConversationMemory(state)
      };

      const crossDomainAnalysis = await crossDomainCoordinator.coordinateAnalysis(coordinationRequest);

      console.log('✅ [CROSS-DOMAIN] Coordination completed:', {
        primaryDomain: crossDomainAnalysis.primaryDomain,
        specialistsConsulted: crossDomainAnalysis.specialistInputs.length,
        overallConfidence: crossDomainAnalysis.overallConfidence
      });

      return {
        crossDomainAnalysis,
        requiresCrossDomainCoordination: true,
        processingStage: 'context_retrieval',
        nextAction: 'retrieve_context'
      };

    } catch (error) {
      console.error('❌ [CROSS-DOMAIN] Coordination error:', error);
      return {
        requiresCrossDomainCoordination: false,
        crossDomainAnalysis: null,
        processingStage: 'context_retrieval',
        nextAction: 'retrieve_context'
      };
    }
  }

  /**
   * Detect the primary legal domain from the query
   */
  private async detectLegalDomain(state: ConversationState): Promise<Partial<ConversationState>> {
    console.log('🔍 [DOMAIN-DETECTION] Analyzing legal domain...');
    
    try {
      const message = state.currentMessage.toLowerCase();
      const domains = {
        employment: {
          keywords: ['employment', 'job', 'work', 'fired', 'dismissed', 'discrimination', 'harassment', 'wage', 'overtime', 'redundancy', 'grievance', 'unfair dismissal'],
          priority: 1
        },
        business: {
          keywords: ['business', 'company', 'limited', 'partnership', 'corporation', 'director', 'shareholder', 'governance', 'formation', 'acquisition'],
          priority: 1
        },
        contract: {
          keywords: ['contract', 'agreement', 'terms', 'breach', 'negotiate', 'clause', 'liability', 'indemnity', 'service agreement', 'supply agreement'],
          priority: 1
        },
        compliance: {
          keywords: ['compliance', 'regulation', 'gdpr', 'data protection', 'health safety', 'audit', 'policy', 'procedure', 'risk'],
          priority: 1
        },
        general: {
          keywords: ['legal', 'law', 'advice', 'help', 'question'],
          priority: 2
        }
      };

      let bestMatch = { domain: 'general', score: 0, keywords: [] };

      // Analyze message against each domain
      for (const [domain, config] of Object.entries(domains)) {
        let score = 0;
        const matchedKeywords: string[] = [];
        
        for (const keyword of config.keywords) {
          if (message.includes(keyword)) {
            score += config.priority;
            matchedKeywords.push(keyword);
          }
        }
        
        if (score > bestMatch.score) {
          bestMatch = { domain, score, keywords: matchedKeywords };
        }
      }

      // Check for cross-domain requirements
      const crossDomainRequirements: string[] = [];
      if (bestMatch.score > 0) {
        // Check if multiple domains are relevant
        const otherDomains = Object.keys(domains).filter(d => d !== bestMatch.domain);
        for (const domain of otherDomains) {
          const keywords = domains[domain as keyof typeof domains].keywords;
          if (keywords.some(keyword => message.includes(keyword))) {
            crossDomainRequirements.push(domain);
          }
        }
      }

      console.log('✅ [DOMAIN-DETECTION] Domain detected:', {
        primaryDomain: bestMatch.domain,
        confidence: bestMatch.score,
        keywords: bestMatch.keywords,
        crossDomain: crossDomainRequirements
      });

      return {
        detectedDomain: bestMatch.domain,
        crossDomainRequirements,
        processingStage: 'specialist_routing',
        nextAction: 'route_specialist'
      };

    } catch (error) {
      console.error('❌ [DOMAIN-DETECTION] Error:', error);
      return {
        detectedDomain: 'general',
        crossDomainRequirements: [],
        processingStage: 'specialist_routing',
        nextAction: 'route_specialist'
      };
    }
  }

  /**
   * Route to appropriate specialist agent based on detected domain
   */
  private async routeToSpecialist(state: ConversationState): Promise<Partial<ConversationState>> {
    console.log('🎯 [SPECIALIST-ROUTING] Routing to specialist...');
    
    try {
      const domain = state.detectedDomain || 'general';
      let specialistAgent = 'general';
      let domainAnalysis = null;

      // Route to appropriate specialist
      switch (domain) {
        case 'employment':
          specialistAgent = 'employment_law_handler';
          console.log('👔 [ROUTING] Using Employment Law Handler');
          break;
          
        case 'business':
          specialistAgent = 'business_law_specialist';
          console.log('🏢 [ROUTING] Using Business Law Specialist');
          break;
          
        case 'contract':
          specialistAgent = 'contract_specialist';
          console.log('📄 [ROUTING] Using Contract Specialist');
          break;
          
        case 'compliance':
          specialistAgent = 'compliance_officer';
          console.log('🔍 [ROUTING] Using Compliance Officer');
          break;
          
        default:
          specialistAgent = 'general';
          console.log('⚖️ [ROUTING] Using General Legal Assistant');
          break;
      }

      console.log('✅ [SPECIALIST-ROUTING] Routed to:', specialistAgent);

      return {
        specialistAgent,
        domainAnalysis,
        processingStage: 'context_retrieval',
        nextAction: 'retrieve_context'
      };

    } catch (error) {
      console.error('❌ [SPECIALIST-ROUTING] Error:', error);
      return {
        specialistAgent: 'general',
        domainAnalysis: null,
        processingStage: 'context_retrieval',
        nextAction: 'retrieve_context'
      };
    }
  }
}

// Export singleton instance
export const unifiedLangGraphAgent = new UnifiedLangGraphAgent();