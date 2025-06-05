/**
 * AI-Powered Model Selection Service
 * Phase 2: Enhanced Intelligence - Intelligent model routing based on query analysis
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface ModelSelectionResult {
  selectedModel: string;
  reasoning: string;
  confidence: number;
  fallbackOptions: string[];
  estimatedComplexity: 'simple' | 'moderate' | 'complex' | 'expert';
  recommendedTimeout: number;
}

export interface QueryAnalysis {
  query: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  userPreferences?: {
    preferFastResponses?: boolean;
    preferDetailedAnalysis?: boolean;
    riskTolerance?: 'low' | 'medium' | 'high';
  };
}

/**
 * AI-Powered Model Selection Service
 */
export class AIModelSelector {
  private analysisModel: ChatOpenAI;
  private availableModels: Map<string, ModelCapabilities>;
  private selectionHistory: Map<string, ModelSelectionResult[]> = new Map();
  private isInitialized = false;

  constructor() {
    // Use a fast, cost-effective model for selection analysis
    this.analysisModel = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o-mini',
      temperature: 0.1,
      maxTokens: 1000
    });

    this.initializeModelCapabilities();
  }

  /**
   * Initialize model capabilities database
   */
  private initializeModelCapabilities(): void {
    this.availableModels = new Map([
      ['gpt-4o', {
        name: 'GPT-4o',
        provider: 'OpenAI',
        strengths: ['general_reasoning', 'complex_analysis', 'code_generation', 'structured_output'],
        weaknesses: ['cost', 'speed'],
        bestFor: ['complex_legal_analysis', 'multi_step_reasoning', 'structured_data'],
        costTier: 'high',
        speedTier: 'medium',
        qualityTier: 'very_high',
        contextLimit: 128000,
        timeoutRecommendation: 30000
      }],
      ['gpt-4o-mini', {
        name: 'GPT-4o Mini',
        provider: 'OpenAI',
        strengths: ['speed', 'cost_effective', 'simple_tasks'],
        weaknesses: ['complex_reasoning', 'specialized_knowledge'],
        bestFor: ['simple_queries', 'quick_responses', 'classification'],
        costTier: 'low',
        speedTier: 'very_high',
        qualityTier: 'high',
        contextLimit: 128000,
        timeoutRecommendation: 15000
      }],
      ['claude-3-5-sonnet-20241022', {
        name: 'Claude 3.5 Sonnet',
        provider: 'Anthropic',
        strengths: ['document_generation', 'legal_writing', 'analysis', 'safety'],
        weaknesses: ['speed', 'cost'],
        bestFor: ['legal_documents', 'detailed_analysis', 'professional_writing'],
        costTier: 'high',
        speedTier: 'medium',
        qualityTier: 'very_high',
        contextLimit: 200000,
        timeoutRecommendation: 35000
      }],
      ['claude-3-haiku-20240307', {
        name: 'Claude 3 Haiku',
        provider: 'Anthropic',
        strengths: ['speed', 'cost_effective', 'simple_tasks'],
        weaknesses: ['complex_reasoning', 'document_generation'],
        bestFor: ['simple_queries', 'quick_responses', 'greetings'],
        costTier: 'low',
        speedTier: 'very_high',
        qualityTier: 'good',
        contextLimit: 200000,
        timeoutRecommendation: 10000
      }]
    ]);

    this.isInitialized = true;
    console.log('🤖 [AI-MODEL-SELECTOR] Initialized with', this.availableModels.size, 'available models');
  }

  /**
   * Select optimal model using AI analysis
   */
  async selectOptimalModel(analysis: QueryAnalysis): Promise<ModelSelectionResult> {
    if (!this.isInitialized) {
      throw new Error('Model selector not initialized');
    }

    console.log('🎯 [AI-MODEL-SELECTOR] Analyzing query for optimal model selection...');

    try {
      // Prepare context for AI analysis
      const modelOptions = Array.from(this.availableModels.entries())
        .map(([key, capabilities]) => ({
          model: key,
          strengths: capabilities.strengths,
          bestFor: capabilities.bestFor,
          costTier: capabilities.costTier,
          speedTier: capabilities.speedTier,
          qualityTier: capabilities.qualityTier,
          timeoutRecommendation: capabilities.timeoutRecommendation
        }));

      const systemPrompt = `You are an AI model selection expert. Your job is to analyze user queries and select the optimal AI model for the task.

Available Models:
${JSON.stringify(modelOptions, null, 2)}

User Preferences:
- Fast responses: ${analysis.userPreferences?.preferFastResponses ? 'Yes' : 'No'}
- Detailed analysis: ${analysis.userPreferences?.preferDetailedAnalysis ? 'Yes' : 'No'}
- Risk tolerance: ${analysis.userPreferences?.riskTolerance || 'medium'}

Instructions:
1. Analyze the query complexity, type, and requirements
2. Consider user preferences and conversation context
3. Select the most appropriate model
4. Provide clear reasoning for your choice
5. Estimate the query complexity level
6. Suggest fallback options

Response format (JSON):
{
  "selectedModel": "model_name",
  "reasoning": "detailed explanation of why this model is optimal",
  "confidence": 0.85,
  "estimatedComplexity": "moderate",
  "fallbackOptions": ["alternative1", "alternative2"],
  "recommendedTimeout": 25000
}`;

      const contextHistory = analysis.conversationHistory 
        ? analysis.conversationHistory.slice(-4).map(msg => `${msg.role}: ${msg.content}`).join('\n')
        : 'No previous context';

      const userPrompt = `Query to analyze: "${analysis.query}"

Recent conversation context:
${contextHistory}

Please analyze this query and select the optimal model, providing your response as JSON.`;

      // Get AI recommendation
      const response = await this.analysisModel.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt)
      ]);

      const responseContent = response.content as string;
      
      // Parse AI response
      const aiSelection = this.parseAIResponse(responseContent);
      
      // Validate and enhance the selection
      const validatedSelection = this.validateAndEnhanceSelection(aiSelection, analysis);
      
      // Store selection history for learning
      this.recordSelection(analysis.query, validatedSelection);
      
      console.log('✅ [AI-MODEL-SELECTOR] Model selected:', {
        model: validatedSelection.selectedModel,
        complexity: validatedSelection.estimatedComplexity,
        confidence: validatedSelection.confidence
      });

      return validatedSelection;

    } catch (error) {
      console.error('❌ [AI-MODEL-SELECTOR] Error during selection:', error);
      
      // Fallback to rule-based selection
      return this.fallbackSelection(analysis);
    }
  }

  /**
   * Parse AI response with error handling
   */
  private parseAIResponse(responseContent: string): Partial<ModelSelectionResult> {
    try {
      // Try to extract JSON from response
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // If no JSON found, parse manually
      return this.parseNonJsonResponse(responseContent);
    } catch (error) {
      console.warn('⚠️ [AI-MODEL-SELECTOR] Failed to parse AI response, using fallback');
      return {};
    }
  }

  /**
   * Parse non-JSON response manually
   */
  private parseNonJsonResponse(content: string): Partial<ModelSelectionResult> {
    const result: Partial<ModelSelectionResult> = {};
    
    // Extract model name
    const modelMatch = content.match(/model[:\s]+([\w\-]+)/i);
    if (modelMatch) {
      result.selectedModel = modelMatch[1];
    }
    
    // Extract reasoning
    const reasoningMatch = content.match(/reason[:\s]+([^.]+)/i);
    if (reasoningMatch) {
      result.reasoning = reasoningMatch[1].trim();
    }
    
    // Extract confidence
    const confidenceMatch = content.match(/confidence[:\s]+([\d.]+)/i);
    if (confidenceMatch) {
      result.confidence = parseFloat(confidenceMatch[1]);
    }
    
    return result;
  }

  /**
   * Validate and enhance AI selection
   */
  private validateAndEnhanceSelection(
    aiSelection: Partial<ModelSelectionResult>, 
    analysis: QueryAnalysis
  ): ModelSelectionResult {
    // Ensure selected model exists
    const selectedModel = aiSelection.selectedModel && this.availableModels.has(aiSelection.selectedModel)
      ? aiSelection.selectedModel
      : this.getDefaultModel(analysis);

    const modelCapabilities = this.availableModels.get(selectedModel)!;

    return {
      selectedModel,
      reasoning: aiSelection.reasoning || `Selected ${selectedModel} based on query analysis`,
      confidence: aiSelection.confidence || 0.7,
      estimatedComplexity: aiSelection.estimatedComplexity || this.estimateComplexity(analysis.query),
      fallbackOptions: aiSelection.fallbackOptions || this.generateFallbackOptions(selectedModel),
      recommendedTimeout: aiSelection.recommendedTimeout || modelCapabilities.timeoutRecommendation
    };
  }

  /**
   * Fallback selection using rule-based logic
   */
  private fallbackSelection(analysis: QueryAnalysis): ModelSelectionResult {
    console.log('🔄 [AI-MODEL-SELECTOR] Using fallback rule-based selection');
    
    const query = analysis.query.toLowerCase();
    const complexity = this.estimateComplexity(analysis.query);
    
    let selectedModel = 'gpt-4o'; // Default
    
    // Rule-based selection
    if (query.includes('nda') || query.includes('contract') || query.includes('agreement')) {
      selectedModel = 'claude-3-5-sonnet-20241022'; // Best for documents
    } else if (query.includes('hello') || query.includes('hi') || query.length < 20) {
      selectedModel = 'claude-3-haiku-20240307'; // Fast for simple queries
    } else if (analysis.userPreferences?.preferFastResponses) {
      selectedModel = 'gpt-4o-mini'; // Fast option
    } else if (complexity === 'expert' || complexity === 'complex') {
      selectedModel = 'claude-3-5-sonnet-20241022'; // Best quality
    }

    const modelCapabilities = this.availableModels.get(selectedModel)!;

    return {
      selectedModel,
      reasoning: 'Rule-based selection due to AI analysis failure',
      confidence: 0.6,
      estimatedComplexity: complexity,
      fallbackOptions: this.generateFallbackOptions(selectedModel),
      recommendedTimeout: modelCapabilities.timeoutRecommendation
    };
  }

  /**
   * Get default model based on query
   */
  private getDefaultModel(analysis: QueryAnalysis): string {
    if (analysis.userPreferences?.preferFastResponses) {
      return 'gpt-4o-mini';
    }
    return 'gpt-4o';
  }

  /**
   * Estimate query complexity
   */
  private estimateComplexity(query: string): 'simple' | 'moderate' | 'complex' | 'expert' {
    const length = query.length;
    const complexity_indicators = ['analyze', 'comprehensive', 'detailed', 'complex', 'multiple'];
    const expert_indicators = ['litigation', 'precedent', 'statutory', 'compliance', 'regulation'];
    
    if (expert_indicators.some(indicator => query.toLowerCase().includes(indicator))) {
      return 'expert';
    }
    
    if (complexity_indicators.some(indicator => query.toLowerCase().includes(indicator)) || length > 200) {
      return 'complex';
    }
    
    if (length > 50) {
      return 'moderate';
    }
    
    return 'simple';
  }

  /**
   * Generate fallback options
   */
  private generateFallbackOptions(selectedModel: string): string[] {
    const allModels = Array.from(this.availableModels.keys());
    return allModels.filter(model => model !== selectedModel).slice(0, 2);
  }

  /**
   * Record selection for learning
   */
  private recordSelection(query: string, selection: ModelSelectionResult): void {
    const queryKey = query.substring(0, 50); // Use first 50 chars as key
    const history = this.selectionHistory.get(queryKey) || [];
    history.push(selection);
    
    // Keep only last 5 selections per query pattern
    if (history.length > 5) {
      history.shift();
    }
    
    this.selectionHistory.set(queryKey, history);
  }

  /**
   * Get selection statistics
   */
  getSelectionStats(): {
    totalSelections: number;
    modelUsage: Record<string, number>;
    averageConfidence: number;
    complexityDistribution: Record<string, number>;
  } {
    const stats = {
      totalSelections: 0,
      modelUsage: {} as Record<string, number>,
      averageConfidence: 0,
      complexityDistribution: {} as Record<string, number>
    };

    let totalConfidence = 0;

    for (const selections of this.selectionHistory.values()) {
      for (const selection of selections) {
        stats.totalSelections++;
        stats.modelUsage[selection.selectedModel] = (stats.modelUsage[selection.selectedModel] || 0) + 1;
        stats.complexityDistribution[selection.estimatedComplexity] = (stats.complexityDistribution[selection.estimatedComplexity] || 0) + 1;
        totalConfidence += selection.confidence;
      }
    }

    stats.averageConfidence = stats.totalSelections > 0 ? totalConfidence / stats.totalSelections : 0;

    return stats;
  }

  /**
   * Get available models info
   */
  getAvailableModels(): Array<{model: string; capabilities: ModelCapabilities}> {
    return Array.from(this.availableModels.entries()).map(([model, capabilities]) => ({
      model,
      capabilities
    }));
  }
}

interface ModelCapabilities {
  name: string;
  provider: string;
  strengths: string[];
  weaknesses: string[];
  bestFor: string[];
  costTier: 'low' | 'medium' | 'high';
  speedTier: 'low' | 'medium' | 'high' | 'very_high';
  qualityTier: 'good' | 'high' | 'very_high';
  contextLimit: number;
  timeoutRecommendation: number;
}

// Export singleton instance
export const aiModelSelector = new AIModelSelector();