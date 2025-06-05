/**
 * Proactive Legal Assistant Service
 * Phase 2: Enhanced Intelligence - Proactive assistance capabilities
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { chatBetaRAGService } from './chat-beta-rag-service';
import { aiModelSelector, QueryAnalysis } from './ai-model-selector';

export interface ProactiveRecommendation {
  type: 'suggestion' | 'warning' | 'opportunity' | 'followup';
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  actionable: boolean;
  actions?: ProactiveAction[];
  confidence: number;
  reasoning: string;
}

export interface ProactiveAction {
  id: string;
  label: string;
  description: string;
  type: 'document_generation' | 'legal_research' | 'deadline_check' | 'compliance_review';
  parameters?: Record<string, any>;
}

export interface ConversationContext {
  userId: string;
  conversationId: string;
  messageHistory: Array<{ role: string; content: string; timestamp: Date }>;
  lastActivity: Date;
  documentsGenerated: string[];
  legalDomains: string[];
  userProfile?: UserProfile;
}

export interface UserProfile {
  preferredResponseStyle: 'concise' | 'detailed' | 'technical';
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  expertiseLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  typicalUseCases: string[];
  timePreferences: {
    preferQuickResponses: boolean;
    acceptLongerForQuality: boolean;
  };
}

/**
 * Proactive Legal Assistant Service
 */
export class ProactiveAssistant {
  private analysisModel: ChatOpenAI;
  private conversationContexts: Map<string, ConversationContext> = new Map();
  private recommendationHistory: Map<string, ProactiveRecommendation[]> = new Map();
  private isInitialized = false;

  constructor() {
    this.analysisModel = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o-mini',
      temperature: 0.3,
      maxTokens: 1500
    });
  }

  /**
   * Initialize the proactive assistant
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🤖 [PROACTIVE-ASSISTANT] Initializing proactive assistant...');
      await chatBetaRAGService.initialize();
      this.isInitialized = true;
      console.log('✅ [PROACTIVE-ASSISTANT] Proactive assistant initialized');
    } catch (error) {
      console.error('❌ [PROACTIVE-ASSISTANT] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Analyze conversation and generate proactive recommendations
   */
  async generateProactiveRecommendations(
    conversationId: string,
    userId: string,
    messageHistory: Array<{ role: string; content: string; timestamp?: Date }>,
    currentResponse?: string
  ): Promise<ProactiveRecommendation[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log('🔮 [PROACTIVE-ASSISTANT] Generating proactive recommendations...');

    try {
      // Update conversation context
      this.updateConversationContext(conversationId, userId, messageHistory);
      
      const context = this.conversationContexts.get(conversationId);
      if (!context) {
        return [];
      }

      // Analyze conversation patterns
      const patterns = this.analyzeConversationPatterns(context);
      
      // Generate recommendations based on patterns
      const recommendations = await this.generateRecommendationsFromPatterns(context, patterns, currentResponse);
      
      // Filter and prioritize recommendations
      const prioritizedRecommendations = this.prioritizeRecommendations(recommendations, context);
      
      // Store recommendations for learning
      this.storeRecommendations(conversationId, prioritizedRecommendations);
      
      console.log('✅ [PROACTIVE-ASSISTANT] Generated', prioritizedRecommendations.length, 'recommendations');
      
      return prioritizedRecommendations;

    } catch (error) {
      console.error('❌ [PROACTIVE-ASSISTANT] Error generating recommendations:', error);
      return [];
    }
  }

  /**
   * Update conversation context
   */
  private updateConversationContext(
    conversationId: string,
    userId: string,
    messageHistory: Array<{ role: string; content: string; timestamp?: Date }>
  ): void {
    const existingContext = this.conversationContexts.get(conversationId);
    
    const context: ConversationContext = {
      userId,
      conversationId,
      messageHistory: messageHistory.map(msg => ({
        ...msg,
        timestamp: msg.timestamp || new Date()
      })),
      lastActivity: new Date(),
      documentsGenerated: this.extractDocumentsFromHistory(messageHistory),
      legalDomains: this.extractLegalDomainsFromHistory(messageHistory),
      userProfile: existingContext?.userProfile || this.inferUserProfile(messageHistory)
    };

    this.conversationContexts.set(conversationId, context);
  }

  /**
   * Analyze conversation patterns
   */
  private analyzeConversationPatterns(context: ConversationContext): ConversationPatterns {
    const patterns: ConversationPatterns = {
      documentGenerationPattern: false,
      legalQuestionPattern: false,
      followUpNeeded: false,
      incompleteInformation: false,
      complexityEscalation: false,
      timeUrgency: false,
      domainExpertiseGap: false
    };

    const recentMessages = context.messageHistory.slice(-6);
    const userMessages = recentMessages.filter(msg => msg.role === 'user');
    const assistantMessages = recentMessages.filter(msg => msg.role === 'assistant');

    // Document generation pattern
    patterns.documentGenerationPattern = context.documentsGenerated.length > 0 ||
      recentMessages.some(msg => 
        /\b(contract|agreement|nda|policy|letter|document)\b/i.test(msg.content)
      );

    // Legal question pattern
    patterns.legalQuestionPattern = userMessages.some(msg =>
      /\b(legal|law|rights|obligations|liable|court|claim)\b/i.test(msg.content)
    );

    // Follow-up needed
    patterns.followUpNeeded = assistantMessages.some(msg =>
      msg.content.includes('Would you like') || 
      msg.content.includes('Do you need') ||
      msg.content.includes('Should I')
    );

    // Incomplete information
    patterns.incompleteInformation = userMessages.some(msg =>
      msg.content.length < 30 || 
      /\b(general|basic|simple|not sure|maybe)\b/i.test(msg.content)
    );

    // Complexity escalation
    patterns.complexityEscalation = userMessages.some(msg =>
      /\b(complex|complicated|detailed|comprehensive|thorough)\b/i.test(msg.content)
    );

    // Time urgency
    patterns.timeUrgency = userMessages.some(msg =>
      /\b(urgent|asap|quickly|deadline|immediate|fast)\b/i.test(msg.content)
    );

    // Domain expertise gap
    patterns.domainExpertiseGap = userMessages.some(msg =>
      /\b(don't understand|confusing|help me|explain|what does|how do)\b/i.test(msg.content)
    );

    return patterns;
  }

  /**
   * Generate recommendations from patterns using AI
   */
  private async generateRecommendationsFromPatterns(
    context: ConversationContext,
    patterns: ConversationPatterns,
    currentResponse?: string
  ): Promise<ProactiveRecommendation[]> {
    const systemPrompt = `You are a proactive legal assistant AI that generates helpful suggestions based on conversation patterns.

CONVERSATION CONTEXT:
- User ID: ${context.userId}
- Legal domains discussed: ${context.legalDomains.join(', ')}
- Documents generated: ${context.documentsGenerated.length}
- User expertise level: ${context.userProfile?.expertiseLevel || 'unknown'}

DETECTED PATTERNS:
- Document generation: ${patterns.documentGenerationPattern}
- Legal questions: ${patterns.legalQuestionPattern}
- Follow-up needed: ${patterns.followUpNeeded}
- Incomplete information: ${patterns.incompleteInformation}
- Complexity escalation: ${patterns.complexityEscalation}
- Time urgency: ${patterns.timeUrgency}
- Expertise gap: ${patterns.domainExpertiseGap}

RECENT CONVERSATION:
${context.messageHistory.slice(-4).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

${currentResponse ? `CURRENT RESPONSE:\n${currentResponse}\n` : ''}

Generate 1-3 proactive recommendations that would be helpful to the user. Focus on:
1. Actionable next steps
2. Potential issues they should consider
3. Additional resources or documents they might need
4. Preventive measures for legal compliance

Format as JSON array:
[
  {
    "type": "suggestion|warning|opportunity|followup",
    "title": "Brief title",
    "content": "Detailed recommendation",
    "priority": "low|medium|high|urgent",
    "actionable": true/false,
    "confidence": 0.85,
    "reasoning": "Why this recommendation is relevant"
  }
]`;

    try {
      const response = await this.analysisModel.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage('Please analyze the conversation and generate proactive recommendations.')
      ]);

      const content = response.content as string;
      return this.parseRecommendationsResponse(content);

    } catch (error) {
      console.error('❌ [PROACTIVE-ASSISTANT] AI recommendation generation failed:', error);
      return this.generateFallbackRecommendations(patterns, context);
    }
  }

  /**
   * Parse AI recommendations response
   */
  private parseRecommendationsResponse(content: string): ProactiveRecommendation[] {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const recommendations = JSON.parse(jsonMatch[0]);
        return recommendations.map((rec: any) => ({
          ...rec,
          actions: this.generateActionsForRecommendation(rec)
        }));
      }

      // Fallback parsing
      return this.parseNonJsonRecommendations(content);
    } catch (error) {
      console.warn('⚠️ [PROACTIVE-ASSISTANT] Failed to parse recommendations:', error);
      return [];
    }
  }

  /**
   * Generate fallback recommendations based on patterns
   */
  private generateFallbackRecommendations(
    patterns: ConversationPatterns,
    context: ConversationContext
  ): ProactiveRecommendation[] {
    const recommendations: ProactiveRecommendation[] = [];

    if (patterns.documentGenerationPattern && context.documentsGenerated.length > 0) {
      recommendations.push({
        type: 'suggestion',
        title: 'Document Review Recommended',
        content: 'Consider having your generated document reviewed by a qualified UK solicitor before use, especially for important legal matters.',
        priority: 'medium',
        actionable: true,
        confidence: 0.9,
        reasoning: 'Documents were generated in this conversation'
      });
    }

    if (patterns.incompleteInformation) {
      recommendations.push({
        type: 'opportunity',
        title: 'Provide More Details',
        content: 'Providing more specific details about your situation could help me give you more tailored and accurate legal guidance.',
        priority: 'low',
        actionable: true,
        confidence: 0.8,
        reasoning: 'User queries appear to lack specific details'
      });
    }

    if (patterns.timeUrgency) {
      recommendations.push({
        type: 'warning',
        title: 'Time-Sensitive Legal Matter',
        content: 'Since this appears to be urgent, consider consulting with a solicitor immediately to ensure you don\'t miss any critical deadlines.',
        priority: 'urgent',
        actionable: true,
        confidence: 0.95,
        reasoning: 'User indicated urgency in their request'
      });
    }

    return recommendations;
  }

  /**
   * Generate actions for recommendations
   */
  private generateActionsForRecommendation(recommendation: any): ProactiveAction[] {
    const actions: ProactiveAction[] = [];

    if (recommendation.type === 'suggestion' && recommendation.title.includes('Document')) {
      actions.push({
        id: 'review_document',
        label: 'Schedule Legal Review',
        description: 'Find a qualified solicitor to review your document',
        type: 'compliance_review'
      });
    }

    if (recommendation.type === 'opportunity' && recommendation.content.includes('details')) {
      actions.push({
        id: 'provide_details',
        label: 'Add More Information',
        description: 'Provide additional context about your situation',
        type: 'legal_research'
      });
    }

    if (recommendation.type === 'warning' && recommendation.priority === 'urgent') {
      actions.push({
        id: 'urgent_consultation',
        label: 'Find Urgent Legal Help',
        description: 'Connect with emergency legal services',
        type: 'compliance_review'
      });
    }

    return actions;
  }

  /**
   * Prioritize recommendations
   */
  private prioritizeRecommendations(
    recommendations: ProactiveRecommendation[],
    context: ConversationContext
  ): ProactiveRecommendation[] {
    // Sort by priority and confidence
    return recommendations
      .filter(rec => rec.confidence > 0.6) // Filter low confidence recommendations
      .sort((a, b) => {
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.confidence - a.confidence;
      })
      .slice(0, 3); // Limit to top 3 recommendations
  }

  /**
   * Store recommendations for learning
   */
  private storeRecommendations(conversationId: string, recommendations: ProactiveRecommendation[]): void {
    const existing = this.recommendationHistory.get(conversationId) || [];
    existing.push(...recommendations);
    
    // Keep only last 20 recommendations per conversation
    if (existing.length > 20) {
      existing.splice(0, existing.length - 20);
    }
    
    this.recommendationHistory.set(conversationId, existing);
  }

  /**
   * Helper methods
   */
  private extractDocumentsFromHistory(messageHistory: Array<{ role: string; content: string }>): string[] {
    const documents: string[] = [];
    
    messageHistory.forEach(msg => {
      if (msg.role === 'assistant') {
        if (msg.content.includes('Generated Document:') || 
            msg.content.includes('CONTRACT') || 
            msg.content.includes('AGREEMENT')) {
          documents.push('document_' + Date.now());
        }
      }
    });
    
    return documents;
  }

  private extractLegalDomainsFromHistory(messageHistory: Array<{ role: string; content: string }>): string[] {
    const domains = new Set<string>();
    const domainKeywords = {
      employment: ['employment', 'job', 'work', 'employer', 'dismissal'],
      contract: ['contract', 'agreement', 'terms', 'breach'],
      business: ['company', 'business', 'director', 'shareholder'],
      data_protection: ['data', 'privacy', 'gdpr', 'personal data']
    };

    messageHistory.forEach(msg => {
      const content = msg.content.toLowerCase();
      Object.entries(domainKeywords).forEach(([domain, keywords]) => {
        if (keywords.some(keyword => content.includes(keyword))) {
          domains.add(domain);
        }
      });
    });

    return Array.from(domains);
  }

  private inferUserProfile(messageHistory: Array<{ role: string; content: string }>): UserProfile {
    const userMessages = messageHistory.filter(msg => msg.role === 'user').map(msg => msg.content);
    const allText = userMessages.join(' ').toLowerCase();

    // Infer expertise level
    let expertiseLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' = 'beginner';
    if (allText.includes('statute') || allText.includes('precedent') || allText.includes('litigation')) {
      expertiseLevel = 'expert';
    } else if (allText.includes('clause') || allText.includes('liability') || allText.includes('breach')) {
      expertiseLevel = 'advanced';
    } else if (allText.includes('contract') || allText.includes('legal') || allText.includes('rights')) {
      expertiseLevel = 'intermediate';
    }

    // Infer response style preference
    let preferredResponseStyle: 'concise' | 'detailed' | 'technical' = 'detailed';
    if (allText.includes('quickly') || allText.includes('brief') || allText.includes('simple')) {
      preferredResponseStyle = 'concise';
    } else if (allText.includes('technical') || allText.includes('detailed') || allText.includes('comprehensive')) {
      preferredResponseStyle = 'technical';
    }

    return {
      preferredResponseStyle,
      riskTolerance: 'moderate',
      expertiseLevel,
      typicalUseCases: this.extractLegalDomainsFromHistory(messageHistory),
      timePreferences: {
        preferQuickResponses: allText.includes('quick') || allText.includes('fast'),
        acceptLongerForQuality: allText.includes('detailed') || allText.includes('thorough')
      }
    };
  }

  private parseNonJsonRecommendations(content: string): ProactiveRecommendation[] {
    // Simple fallback parsing for non-JSON responses
    const recommendations: ProactiveRecommendation[] = [];
    
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    
    lines.forEach(line => {
      if (line.includes('recommend') || line.includes('suggest') || line.includes('consider')) {
        recommendations.push({
          type: 'suggestion',
          title: 'AI Recommendation',
          content: line.trim(),
          priority: 'medium',
          actionable: true,
          confidence: 0.7,
          reasoning: 'Extracted from AI response'
        });
      }
    });
    
    return recommendations.slice(0, 2); // Limit to 2 recommendations
  }

  /**
   * Get recommendation statistics
   */
  getRecommendationStats(): {
    totalRecommendations: number;
    averageConfidence: number;
    typeDistribution: Record<string, number>;
    priorityDistribution: Record<string, number>;
  } {
    const stats = {
      totalRecommendations: 0,
      averageConfidence: 0,
      typeDistribution: {} as Record<string, number>,
      priorityDistribution: {} as Record<string, number>
    };

    let totalConfidence = 0;

    for (const recommendations of this.recommendationHistory.values()) {
      for (const rec of recommendations) {
        stats.totalRecommendations++;
        stats.typeDistribution[rec.type] = (stats.typeDistribution[rec.type] || 0) + 1;
        stats.priorityDistribution[rec.priority] = (stats.priorityDistribution[rec.priority] || 0) + 1;
        totalConfidence += rec.confidence;
      }
    }

    stats.averageConfidence = stats.totalRecommendations > 0 ? totalConfidence / stats.totalRecommendations : 0;

    return stats;
  }
}

interface ConversationPatterns {
  documentGenerationPattern: boolean;
  legalQuestionPattern: boolean;
  followUpNeeded: boolean;
  incompleteInformation: boolean;
  complexityEscalation: boolean;
  timeUrgency: boolean;
  domainExpertiseGap: boolean;
}

// Export singleton instance
export const proactiveAssistant = new ProactiveAssistant();