/**
 * Contextual Memory System
 * Phase 2: Enhanced Intelligence - Long-term conversation context and learning
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { chatBetaRAGService } from './chat-beta-rag-service';

export interface ConversationMemory {
  conversationId: string;
  userId: string;
  summary: string;
  keyTopics: string[];
  importantFacts: Record<string, any>;
  userPreferences: UserPreferences;
  legalContext: LegalContextMemory;
  createdAt: Date;
  lastUpdated: Date;
  messageCount: number;
  documents: DocumentMemory[];
  patterns: ConversationPatterns;
}

export interface UserPreferences {
  communicationStyle: 'formal' | 'casual' | 'technical';
  responseLength: 'brief' | 'detailed' | 'comprehensive';
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  expertiseLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  preferredDocumentTypes: string[];
  timePreferences: {
    urgencyBias: boolean;
    thoroughnessOverSpeed: boolean;
  };
}

export interface LegalContextMemory {
  primaryDomains: string[];
  previousCases: string[];
  documentsCreated: string[];
  legalConcerns: string[];
  complianceRequirements: string[];
  deadlines: Array<{
    description: string;
    date: Date;
    importance: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

export interface DocumentMemory {
  id: string;
  type: string;
  title: string;
  createdAt: Date;
  lastModified: Date;
  versions: number;
  importance: 'low' | 'medium' | 'high';
  associatedTopics: string[];
}

export interface ConversationPatterns {
  frequentRequestTypes: string[];
  timeOfDayPatterns: Record<string, number>;
  sessionLengthPreference: 'short' | 'medium' | 'long';
  followUpBehavior: 'frequent' | 'occasional' | 'rare';
  complexityProgression: 'increasing' | 'stable' | 'decreasing';
}

export interface MemorySearchResult {
  relevantMemories: ConversationMemory[];
  userContext: UserPreferences;
  suggestedTopics: string[];
  potentialReferences: string[];
  confidence: number;
}

/**
 * Contextual Memory System
 */
export class ContextualMemorySystem {
  private memoryModel: ChatOpenAI;
  private conversationMemories: Map<string, ConversationMemory> = new Map();
  private userProfiles: Map<string, UserPreferences> = new Map();
  private globalPatterns: Map<string, any> = new Map();
  private isInitialized = false;

  constructor() {
    this.memoryModel = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o-mini',
      temperature: 0.2,
      maxTokens: 2000
    });
  }

  /**
   * Initialize the contextual memory system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🧠 [CONTEXTUAL-MEMORY] Initializing contextual memory system...');
      
      // Initialize with any stored memories (in production, this would load from database)
      await this.loadStoredMemories();
      
      this.isInitialized = true;
      console.log('✅ [CONTEXTUAL-MEMORY] Contextual memory system initialized');
    } catch (error) {
      console.error('❌ [CONTEXTUAL-MEMORY] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Store or update conversation memory
   */
  async storeConversationMemory(
    conversationId: string,
    userId: string,
    messageHistory: Array<{ role: string; content: string; timestamp?: Date }>,
    currentResponse?: string
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log('💾 [CONTEXTUAL-MEMORY] Storing conversation memory for:', conversationId);

    try {
      const existingMemory = this.conversationMemories.get(conversationId);
      
      // Generate memory using AI analysis
      const memoryData = await this.generateConversationMemory(
        conversationId,
        userId,
        messageHistory,
        currentResponse,
        existingMemory
      );

      // Store the updated memory
      this.conversationMemories.set(conversationId, memoryData);
      
      // Update user profile
      await this.updateUserProfile(userId, memoryData);
      
      console.log('✅ [CONTEXTUAL-MEMORY] Memory stored successfully');
    } catch (error) {
      console.error('❌ [CONTEXTUAL-MEMORY] Error storing memory:', error);
    }
  }

  /**
   * Retrieve relevant context for a new query
   */
  async retrieveRelevantContext(
    userId: string,
    currentQuery: string,
    conversationId?: string
  ): Promise<MemorySearchResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log('🔍 [CONTEXTUAL-MEMORY] Retrieving relevant context for user:', userId);

    try {
      // Get user profile
      const userContext = this.userProfiles.get(userId) || this.createDefaultUserProfile();
      
      // Find relevant memories
      const relevantMemories = await this.searchRelevantMemories(userId, currentQuery);
      
      // Generate contextual suggestions
      const suggestions = await this.generateContextualSuggestions(
        userContext,
        relevantMemories,
        currentQuery
      );

      return {
        relevantMemories,
        userContext,
        suggestedTopics: suggestions.topics,
        potentialReferences: suggestions.references,
        confidence: suggestions.confidence
      };

    } catch (error) {
      console.error('❌ [CONTEXTUAL-MEMORY] Error retrieving context:', error);
      return {
        relevantMemories: [],
        userContext: this.createDefaultUserProfile(),
        suggestedTopics: [],
        potentialReferences: [],
        confidence: 0.1
      };
    }
  }

  /**
   * Generate conversation memory using AI analysis
   */
  private async generateConversationMemory(
    conversationId: string,
    userId: string,
    messageHistory: Array<{ role: string; content: string; timestamp?: Date }>,
    currentResponse?: string,
    existingMemory?: ConversationMemory
  ): Promise<ConversationMemory> {
    const systemPrompt = `You are a contextual memory system for a legal AI assistant. Analyze this conversation and extract important information for future reference.

CONVERSATION HISTORY:
${messageHistory.slice(-10).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

${currentResponse ? `CURRENT RESPONSE:\n${currentResponse}` : ''}

${existingMemory ? `EXISTING MEMORY:\n${JSON.stringify(existingMemory, null, 2)}` : ''}

Extract and organize:
1. Key topics discussed
2. Important facts mentioned by the user
3. User preferences (communication style, needs, etc.)
4. Legal domains involved
5. Documents created or discussed
6. Any deadlines or time-sensitive matters
7. User's apparent expertise level
8. Conversation patterns

Format as JSON:
{
  "summary": "Brief conversation summary",
  "keyTopics": ["topic1", "topic2"],
  "importantFacts": {"key": "value"},
  "userPreferences": {
    "communicationStyle": "formal|casual|technical",
    "responseLength": "brief|detailed|comprehensive",
    "riskTolerance": "conservative|moderate|aggressive",
    "expertiseLevel": "beginner|intermediate|advanced|expert"
  },
  "legalContext": {
    "primaryDomains": ["domain1"],
    "documentsCreated": ["doc1"],
    "legalConcerns": ["concern1"],
    "deadlines": []
  },
  "patterns": {
    "frequentRequestTypes": ["type1"],
    "complexityProgression": "increasing|stable|decreasing"
  }
}`;

    try {
      const response = await this.memoryModel.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage('Please analyze this conversation and extract memory information.')
      ]);

      const content = response.content as string;
      const memoryData = this.parseMemoryResponse(content);

      // Combine with existing memory if available
      const finalMemory: ConversationMemory = {
        conversationId,
        userId,
        summary: memoryData.summary || 'Legal conversation',
        keyTopics: this.mergeArrays(existingMemory?.keyTopics || [], memoryData.keyTopics || []),
        importantFacts: { ...existingMemory?.importantFacts, ...memoryData.importantFacts },
        userPreferences: { ...this.createDefaultUserProfile(), ...memoryData.userPreferences },
        legalContext: {
          primaryDomains: this.mergeArrays(existingMemory?.legalContext?.primaryDomains || [], memoryData.legalContext?.primaryDomains || []),
          previousCases: existingMemory?.legalContext?.previousCases || [],
          documentsCreated: this.mergeArrays(existingMemory?.legalContext?.documentsCreated || [], memoryData.legalContext?.documentsCreated || []),
          legalConcerns: this.mergeArrays(existingMemory?.legalContext?.legalConcerns || [], memoryData.legalContext?.legalConcerns || []),
          complianceRequirements: existingMemory?.legalContext?.complianceRequirements || [],
          deadlines: existingMemory?.legalContext?.deadlines || []
        },
        createdAt: existingMemory?.createdAt || new Date(),
        lastUpdated: new Date(),
        messageCount: (existingMemory?.messageCount || 0) + messageHistory.length,
        documents: existingMemory?.documents || [],
        patterns: {
          frequentRequestTypes: this.mergeArrays(existingMemory?.patterns?.frequentRequestTypes || [], memoryData.patterns?.frequentRequestTypes || []),
          timeOfDayPatterns: existingMemory?.patterns?.timeOfDayPatterns || {},
          sessionLengthPreference: memoryData.patterns?.sessionLengthPreference || 'medium',
          followUpBehavior: existingMemory?.patterns?.followUpBehavior || 'occasional',
          complexityProgression: memoryData.patterns?.complexityProgression || 'stable'
        }
      };

      return finalMemory;

    } catch (error) {
      console.error('❌ [CONTEXTUAL-MEMORY] Error generating memory:', error);
      
      // Fallback to basic memory structure
      return this.createBasicMemory(conversationId, userId, messageHistory, existingMemory);
    }
  }

  /**
   * Parse AI memory response
   */
  private parseMemoryResponse(content: string): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch (error) {
      console.warn('⚠️ [CONTEXTUAL-MEMORY] Failed to parse memory response');
      return {};
    }
  }

  /**
   * Search for relevant memories
   */
  private async searchRelevantMemories(userId: string, query: string): Promise<ConversationMemory[]> {
    const userMemories = Array.from(this.conversationMemories.values())
      .filter(memory => memory.userId === userId);

    if (userMemories.length === 0) {
      return [];
    }

    // Simple relevance scoring based on topic overlap
    const queryLower = query.toLowerCase();
    const scoredMemories = userMemories.map(memory => {
      let score = 0;
      
      // Check topic relevance
      memory.keyTopics.forEach(topic => {
        if (queryLower.includes(topic.toLowerCase())) {
          score += 2;
        }
      });
      
      // Check domain relevance
      memory.legalContext.primaryDomains.forEach(domain => {
        if (queryLower.includes(domain.toLowerCase())) {
          score += 1.5;
        }
      });
      
      // Check document relevance
      memory.legalContext.documentsCreated.forEach(doc => {
        if (queryLower.includes(doc.toLowerCase())) {
          score += 1;
        }
      });
      
      return { memory, score };
    });

    // Return top 3 most relevant memories
    return scoredMemories
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.memory);
  }

  /**
   * Generate contextual suggestions
   */
  private async generateContextualSuggestions(
    userContext: UserPreferences,
    relevantMemories: ConversationMemory[],
    currentQuery: string
  ): Promise<{ topics: string[]; references: string[]; confidence: number }> {
    const topics = new Set<string>();
    const references = new Set<string>();
    
    // Extract suggestions from memories
    relevantMemories.forEach(memory => {
      memory.keyTopics.forEach(topic => topics.add(topic));
      memory.legalContext.documentsCreated.forEach(doc => references.add(doc));
    });

    // Add domain-based suggestions
    if (currentQuery.toLowerCase().includes('contract')) {
      topics.add('Contract law');
      topics.add('Agreement terms');
    }
    if (currentQuery.toLowerCase().includes('employment')) {
      topics.add('Employment law');
      topics.add('Workplace rights');
    }

    const confidence = relevantMemories.length > 0 ? 0.8 : 0.3;

    return {
      topics: Array.from(topics).slice(0, 5),
      references: Array.from(references).slice(0, 3),
      confidence
    };
  }

  /**
   * Update user profile based on conversation
   */
  private async updateUserProfile(userId: string, memory: ConversationMemory): Promise<void> {
    const existingProfile = this.userProfiles.get(userId) || this.createDefaultUserProfile();
    
    // Merge preferences with existing profile
    const updatedProfile: UserPreferences = {
      ...existingProfile,
      ...memory.userPreferences,
      preferredDocumentTypes: this.mergeArrays(
        existingProfile.preferredDocumentTypes,
        memory.legalContext.documentsCreated
      )
    };

    this.userProfiles.set(userId, updatedProfile);
  }

  /**
   * Create default user profile
   */
  private createDefaultUserProfile(): UserPreferences {
    return {
      communicationStyle: 'formal',
      responseLength: 'detailed',
      riskTolerance: 'moderate',
      expertiseLevel: 'intermediate',
      preferredDocumentTypes: [],
      timePreferences: {
        urgencyBias: false,
        thoroughnessOverSpeed: true
      }
    };
  }

  /**
   * Create basic memory fallback
   */
  private createBasicMemory(
    conversationId: string,
    userId: string,
    messageHistory: Array<{ role: string; content: string; timestamp?: Date }>,
    existingMemory?: ConversationMemory
  ): ConversationMemory {
    const userMessages = messageHistory.filter(msg => msg.role === 'user');
    const content = userMessages.map(msg => msg.content).join(' ').toLowerCase();
    
    // Extract basic topics
    const topics: string[] = [];
    if (content.includes('contract')) topics.push('Contract law');
    if (content.includes('employment')) topics.push('Employment law');
    if (content.includes('nda')) topics.push('Non-disclosure agreements');
    
    return {
      conversationId,
      userId,
      summary: `Legal conversation about ${topics.join(', ') || 'general topics'}`,
      keyTopics: topics,
      importantFacts: {},
      userPreferences: this.createDefaultUserProfile(),
      legalContext: {
        primaryDomains: topics,
        previousCases: [],
        documentsCreated: [],
        legalConcerns: [],
        complianceRequirements: [],
        deadlines: []
      },
      createdAt: existingMemory?.createdAt || new Date(),
      lastUpdated: new Date(),
      messageCount: messageHistory.length,
      documents: [],
      patterns: {
        frequentRequestTypes: [],
        timeOfDayPatterns: {},
        sessionLengthPreference: 'medium',
        followUpBehavior: 'occasional',
        complexityProgression: 'stable'
      }
    };
  }

  /**
   * Load stored memories (placeholder for database integration)
   */
  private async loadStoredMemories(): Promise<void> {
    // In production, this would load from database
    console.log('📂 [CONTEXTUAL-MEMORY] Loading stored memories...');
  }

  /**
   * Helper: Merge arrays without duplicates
   */
  private mergeArrays<T>(arr1: T[], arr2: T[]): T[] {
    return Array.from(new Set([...arr1, ...arr2]));
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(): {
    totalConversations: number;
    totalUsers: number;
    averageTopicsPerConversation: number;
    topLegalDomains: Array<{ domain: string; count: number }>;
  } {
    const stats = {
      totalConversations: this.conversationMemories.size,
      totalUsers: this.userProfiles.size,
      averageTopicsPerConversation: 0,
      topLegalDomains: [] as Array<{ domain: string; count: number }>
    };

    if (this.conversationMemories.size === 0) {
      return stats;
    }

    // Calculate average topics
    const totalTopics = Array.from(this.conversationMemories.values())
      .reduce((sum, memory) => sum + memory.keyTopics.length, 0);
    stats.averageTopicsPerConversation = totalTopics / this.conversationMemories.size;

    // Calculate top domains
    const domainCounts = new Map<string, number>();
    Array.from(this.conversationMemories.values()).forEach(memory => {
      memory.legalContext.primaryDomains.forEach(domain => {
        domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
      });
    });

    stats.topLegalDomains = Array.from(domainCounts.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return stats;
  }

  /**
   * Export conversation memory for user
   */
  exportUserMemory(userId: string): ConversationMemory[] {
    return Array.from(this.conversationMemories.values())
      .filter(memory => memory.userId === userId);
  }

  /**
   * Clear user memory (GDPR compliance)
   */
  clearUserMemory(userId: string): void {
    console.log('🗑️ [CONTEXTUAL-MEMORY] Clearing memory for user:', userId);
    
    // Remove conversation memories
    const conversationsToRemove = Array.from(this.conversationMemories.entries())
      .filter(([_, memory]) => memory.userId === userId)
      .map(([id, _]) => id);
    
    conversationsToRemove.forEach(id => {
      this.conversationMemories.delete(id);
    });
    
    // Remove user profile
    this.userProfiles.delete(userId);
    
    console.log('✅ [CONTEXTUAL-MEMORY] User memory cleared');
  }
}

// Export singleton instance
export const contextualMemory = new ContextualMemorySystem();