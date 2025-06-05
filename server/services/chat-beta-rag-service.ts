/**
 * Chat Beta RAG Vector Store Service
 * Clean slate implementation following LANGCHAIN_RAG_IMPLEMENTATION.md plan
 * Provides semantic search through verified UK legal documents with confidence scoring
 */

import { OpenAIEmbeddings } from '@langchain/openai';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import fs from 'fs/promises';
import path from 'path';

export interface LegalKnowledgeItem {
  id: string;
  title: string;
  content: string;
  source: string;
  domain: 'employment' | 'contract' | 'business' | 'data_protection' | 'general';
  confidence: number;
  lastUpdated: string;
  metadata: Record<string, any>;
}

export interface RAGSearchResult {
  items: LegalKnowledgeItem[];
  query: string;
  totalResults: number;
  avgConfidence: number;
  memoryEnhanced?: boolean;
  contextualRelevance?: number;
  domainFiltered?: boolean;
}

/**
 * Chat Beta RAG Vector Store Service
 * Provides semantic search through UK legal knowledge base
 */
export class ChatBetaRAGService {
  private vectorStore: FaissStore | null = null;
  private embeddings: OpenAIEmbeddings;
  private textSplitter: RecursiveCharacterTextSplitter;
  private isInitialized = false;
  private readonly vectorStorePath = './data/chat_beta_vector_store';

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-small',
      batchSize: 512,
    });

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });
  }

  /**
   * Initialize the vector store with legal knowledge
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.loadVectorStore();
      console.log('✅ Chat Beta RAG: Loaded existing vector store');
    } catch (error) {
      console.log('🔄 Chat Beta RAG: Creating new vector store...');
      await this.createVectorStore();
      console.log('✅ Chat Beta RAG: Created new vector store');
    }

    this.isInitialized = true;
  }

  /**
   * Load existing vector store from disk
   */
  private async loadVectorStore(): Promise<void> {
    this.vectorStore = await FaissStore.load(this.vectorStorePath, this.embeddings);
  }

  /**
   * Create new vector store with UK legal knowledge
   */
  private async createVectorStore(): Promise<void> {
    const legalKnowledge = this.getUKLegalKnowledgeBase();
    const documents = await this.processLegalKnowledge(legalKnowledge);

    if (documents.length === 0) {
      throw new Error('No legal knowledge found to create vector store');
    }

    this.vectorStore = await FaissStore.fromDocuments(documents, this.embeddings);
    await this.saveVectorStore();
  }

  /**
   * Save vector store to disk
   */
  private async saveVectorStore(): Promise<void> {
    if (!this.vectorStore) return;
    await fs.mkdir(path.dirname(this.vectorStorePath), { recursive: true });
    await this.vectorStore.save(this.vectorStorePath);
  }

  /**
   * UK Legal Knowledge Base as defined in the original plan
   * Covers Employment, Contract, Business, and Data Protection law
   */
  private getUKLegalKnowledgeBase(): LegalKnowledgeItem[] {
    return [
      // Employment Law
      {
        id: 'emp_001',
        title: 'Unfair Dismissal Time Limits',
        content: `Under the Employment Rights Act 1996, claims for unfair dismissal must generally be brought within 3 months of the effective date of termination. This time limit is strict and extensions are rarely granted. However, the time limit may be extended where there is ongoing ACAS early conciliation. Employees need 2+ years continuous service to claim unfair dismissal, except for automatically unfair reasons such as discrimination, whistleblowing, health and safety complaints, pregnancy, or asserting statutory rights.`,
        source: 'Employment Rights Act 1996',
        domain: 'employment',
        confidence: 0.95,
        lastUpdated: '2024-01-01',
        metadata: { section: 'unfair_dismissal', priority: 'high' }
      },
      {
        id: 'emp_002',
        title: 'Notice Periods and Termination',
        content: `Statutory minimum notice periods are: 1 week for employees with 1 month to 2 years service, then 1 additional week for each complete year of service up to a maximum of 12 weeks. Contractual notice may be longer. During notice period, employees retain all contractual benefits unless contract provides otherwise. Payment in lieu of notice (PILON) is only valid if contract allows it. Garden leave involves employee remaining employed but not working during notice period.`,
        source: 'Employment Rights Act 1996 s86-91',
        domain: 'employment',
        confidence: 0.93,
        lastUpdated: '2024-01-01',
        metadata: { section: 'termination', priority: 'high' }
      },
      {
        id: 'emp_003',
        title: 'Discrimination and Protected Characteristics',
        content: `The Equality Act 2010 protects against discrimination based on 9 protected characteristics: age, disability, gender reassignment, marriage/civil partnership, pregnancy/maternity, race, religion/belief, sex, and sexual orientation. Types of discrimination include direct, indirect, harassment, and victimisation. Employers must make reasonable adjustments for disabled employees. Discrimination claims must be brought within 3 months but time may be extended for continuing acts.`,
        source: 'Equality Act 2010',
        domain: 'employment',
        confidence: 0.97,
        lastUpdated: '2024-01-01',
        metadata: { section: 'discrimination', priority: 'high' }
      },

      // Contract Law
      {
        id: 'contract_001',
        title: 'Essential Contract Elements',
        content: `A valid contract requires: (1) Offer - clear proposal to enter contract; (2) Acceptance - unqualified agreement to all terms; (3) Consideration - something of value exchanged; (4) Intention to create legal relations; (5) Certainty of terms; (6) Capacity of parties. All elements must be present for a binding contract. Commercial agreements are presumed to intend legal relations, social agreements presumed not to unless clearly indicated otherwise.`,
        source: 'Common Law Principles',
        domain: 'contract',
        confidence: 0.95,
        lastUpdated: '2024-01-01',
        metadata: { section: 'formation', priority: 'high' }
      },
      {
        id: 'contract_002',
        title: 'Unfair Contract Terms',
        content: `Unfair Contract Terms Act 1977 and Consumer Rights Act 2015 protect against unfair terms. Terms excluding liability for death/personal injury due to negligence are void. Terms excluding liability for other negligence/breach must pass reasonableness test. In consumer contracts, terms must be fair, transparent and not cause significant imbalance. Unfair terms are not binding on consumers. Entire contract may be enforceable without unfair terms if possible.`,
        source: 'UCTA 1977, CRA 2015',
        domain: 'contract',
        confidence: 0.92,
        lastUpdated: '2024-01-01',
        metadata: { section: 'unfair_terms', priority: 'medium' }
      },

      // Business Law
      {
        id: 'business_001',
        title: 'Company Formation Requirements',
        content: `To incorporate a company under Companies Act 2006: (1) Submit application form IN01; (2) Memorandum of association; (3) Articles of association; (4) Pay incorporation fee; (5) Registered office address in UK. Private companies need minimum 1 director and 1 shareholder (can be same person). No minimum share capital for private companies. Public companies need minimum £50,000 authorized share capital, 25% paid up. Must have company secretary if public company.`,
        source: 'Companies Act 2006',
        domain: 'business',
        confidence: 0.96,
        lastUpdated: '2024-01-01',
        metadata: { section: 'incorporation', priority: 'high' }
      },
      {
        id: 'business_002',
        title: 'Director Duties and Responsibilities',
        content: `Companies Act 2006 s170-177 sets out 7 director duties: (1) Act within powers; (2) Promote success of company; (3) Exercise independent judgment; (4) Exercise reasonable care, skill and diligence; (5) Avoid conflicts of interest; (6) Not accept benefits from third parties; (7) Declare interest in proposed transactions. Duties are owed to company, not shareholders directly. Breach may result in personal liability to compensate company for losses.`,
        source: 'Companies Act 2006 s170-177',
        domain: 'business',
        confidence: 0.94,
        lastUpdated: '2024-01-01',
        metadata: { section: 'directors', priority: 'high' }
      },

      // Data Protection
      {
        id: 'data_001',
        title: 'UK GDPR Compliance Requirements',
        content: `UK GDPR requires lawful basis for processing personal data: consent, contract, legal obligation, vital interests, public task, or legitimate interests. Must comply with 6 principles: lawfulness/fairness/transparency, purpose limitation, data minimisation, accuracy, storage limitation, integrity/confidentiality. Data subjects have rights: access, rectification, erasure, restriction, portability, objection. Controllers must demonstrate compliance (accountability principle).`,
        source: 'UK GDPR',
        domain: 'data_protection',
        confidence: 0.95,
        lastUpdated: '2024-01-01',
        metadata: { section: 'compliance', priority: 'high' }
      },
      {
        id: 'data_002',
        title: 'Data Breach Notification',
        content: `Personal data breaches must be reported to ICO within 72 hours if likely to result in risk to rights and freedoms. If high risk, must also notify affected individuals without undue delay. Breach means accidental or unlawful destruction, loss, alteration, unauthorised disclosure or access. Must document all breaches. Failure to report can result in fines up to £8.7m or 2% of annual worldwide turnover. Consider cyber insurance to cover costs.`,
        source: 'UK GDPR Article 33-34',
        domain: 'data_protection',
        confidence: 0.93,
        lastUpdated: '2024-01-01',
        metadata: { section: 'breach', priority: 'high' }
      }
    ];
  }

  /**
   * Process legal knowledge into LangChain Documents
   */
  private async processLegalKnowledge(knowledge: LegalKnowledgeItem[]): Promise<Document[]> {
    const documents: Document[] = [];

    for (const item of knowledge) {
      const chunks = await this.textSplitter.splitText(item.content);

      for (let i = 0; i < chunks.length; i++) {
        documents.push(new Document({
          pageContent: chunks[i],
          metadata: {
            id: `${item.id}_chunk_${i}`,
            title: item.title,
            source: item.source,
            domain: item.domain,
            confidence: item.confidence,
            lastUpdated: item.lastUpdated,
            chunkIndex: i,
            totalChunks: chunks.length,
            ...item.metadata
          }
        }));
      }
    }

    return documents;
  }

  /**
   * Search relevant legal information with confidence scoring
   * Core method for RAG retrieval in chat-beta
   */
  async searchRelevantLegal(
    query: string,
    domain?: string,
    limit: number = 5,
    conversationMemory?: {
      previousQueries: string[];
      domainHistory: string[];
      userPreferences?: any;
      matterContext?: any;
    }
  ): Promise<RAGSearchResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    // Enhanced query processing with conversation memory
    let enhancedQuery = query;
    let memoryEnhanced = false;
    
    // Add domain context
    if (domain) {
      enhancedQuery = `UK ${domain} law: ${query}`;
    }
    
    // Enhance with conversation memory context
    if (conversationMemory) {
      memoryEnhanced = true;
      
      // Add context from previous queries for continuity
      if (conversationMemory.previousQueries.length > 0) {
        const recentContext = conversationMemory.previousQueries.slice(-2).join(' ');
        enhancedQuery += ` Context: ${recentContext}`;
      }
      
      // Add matter context for case-specific relevance
      if (conversationMemory.matterContext?.title) {
        enhancedQuery += ` Matter: ${conversationMemory.matterContext.title}`;
      }
      
      // Boost domain relevance based on conversation history
      if (conversationMemory.domainHistory.length > 0) {
        const dominantDomain = this.findDominantDomain(conversationMemory.domainHistory);
        if (dominantDomain && !domain) {
          enhancedQuery = `UK ${dominantDomain} law: ${enhancedQuery}`;
        }
      }
    }

    // Perform similarity search with scores
    const results = await this.vectorStore.similaritySearchWithScore(enhancedQuery, limit * 2);

    // Enhanced filtering with domain and memory context
    let filteredResults = results;
    let domainFiltered = false;
    
    if (domain) {
      domainFiltered = true;
      filteredResults = results.filter(([doc, score]) => 
        doc.metadata.domain === domain || doc.metadata.domain === 'general'
      );
    }

    // Apply memory-based relevance boosting
    if (conversationMemory) {
      filteredResults = this.applyMemoryRelevanceBoost(filteredResults, conversationMemory);
    }

    // Take top results and convert to our format
    const topResults = filteredResults.slice(0, limit);
    const items: LegalKnowledgeItem[] = topResults.map(([doc, score]) => ({
      id: doc.metadata.id,
      title: doc.metadata.title,
      content: doc.pageContent,
      source: doc.metadata.source,
      domain: doc.metadata.domain,
      confidence: doc.metadata.confidence * score, // Combine stored confidence with search score
      lastUpdated: doc.metadata.lastUpdated,
      metadata: doc.metadata
    }));

    const avgConfidence = items.reduce((sum, item) => sum + item.confidence, 0) / items.length;
    const contextualRelevance = conversationMemory ? this.calculateContextualRelevance(items, conversationMemory) : 1.0;

    return {
      items,
      query: enhancedQuery,
      totalResults: filteredResults.length,
      avgConfidence: avgConfidence || 0,
      memoryEnhanced,
      contextualRelevance,
      domainFiltered
    };
  }

  /**
   * Get contextual legal information for agent responses
   * Returns formatted context string for LangChain agent
   */
  async getContextualLegalInfo(query: string, domain?: string): Promise<string> {
    try {
      const searchResults = await this.searchRelevantLegal(query, domain, 3);

      if (searchResults.items.length === 0) {
        return '';
      }

      let context = '\n=== LEGAL KNOWLEDGE BASE (RAG Retrieved) ===\n';
      
      for (const item of searchResults.items) {
        // Only include high-confidence results
        if (item.confidence > 0.7) {
          context += `\n📚 ${item.title}\n`;
          context += `Source: ${item.source} | Domain: ${item.domain} | Confidence: ${(item.confidence * 100).toFixed(1)}%\n`;
          context += `${item.content}\n`;
          context += '---\n';
        }
      }

      context += '\n⚖️ Use this retrieved UK legal information to ground your response in verified legal principles.\n';
      context += '🎯 Only reference information you are confident about and cite sources appropriately.\n\n';

      return context;
    } catch (error) {
      console.error('❌ Chat Beta RAG: Error retrieving contextual legal info:', error);
      return '';
    }
  }

  /**
   * Add new legal knowledge to the vector store
   */
  async addLegalKnowledge(item: LegalKnowledgeItem): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    const documents = await this.processLegalKnowledge([item]);
    await this.vectorStore.addDocuments(documents);
    await this.saveVectorStore();
    
    console.log(`✅ Chat Beta RAG: Added legal knowledge item: ${item.title}`);
  }

  /**
   * Get vector store status and statistics
   */
  async getStatus(): Promise<{
    initialized: boolean;
    vectorStoreExists: boolean;
    totalDocuments?: number;
    domains: string[];
  }> {
    const vectorStoreExists = await fs.access(this.vectorStorePath)
      .then(() => true)
      .catch(() => false);

    // Count documents by domain if initialized
    let domains: string[] = [];
    if (this.isInitialized && this.vectorStore) {
      // Get unique domains from knowledge base
      const knowledge = this.getUKLegalKnowledgeBase();
      domains = Array.from(new Set(knowledge.map(item => item.domain)));
    }

    return {
      initialized: this.isInitialized,
      vectorStoreExists,
      totalDocuments: this.isInitialized ? this.getUKLegalKnowledgeBase().length : undefined,
      domains
    };
  }

  // Phase 3: Memory Enhancement Helper Methods

  /**
   * Find the dominant domain from conversation history
   */
  private findDominantDomain(domainHistory: string[]): string | null {
    if (domainHistory.length === 0) return null;
    
    const domainCounts = domainHistory.reduce((acc, domain) => {
      acc[domain] = (acc[domain] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const sortedDomains = Object.entries(domainCounts)
      .sort(([, a], [, b]) => b - a);
    
    return sortedDomains[0] ? sortedDomains[0][0] : null;
  }

  /**
   * Apply memory-based relevance boosting to search results
   */
  private applyMemoryRelevanceBoost(
    results: [any, number][],
    conversationMemory: { previousQueries: string[]; domainHistory: string[]; userPreferences?: any; matterContext?: any; }
  ): [any, number][] {
    return results.map(([doc, score]) => {
      let boostedScore = score;
      
      // Boost scores for results matching conversation domain history
      if (conversationMemory.domainHistory.includes(doc.metadata.domain)) {
        boostedScore *= 1.2;
      }
      
      // Boost scores for results matching matter context
      if (conversationMemory.matterContext?.title) {
        const matterTerms = conversationMemory.matterContext.title.toLowerCase().split(' ');
        const docContent = doc.pageContent.toLowerCase();
        const matchingTerms = matterTerms.filter(term => docContent.includes(term));
        if (matchingTerms.length > 0) {
          boostedScore *= (1 + (matchingTerms.length * 0.1));
        }
      }
      
      // Boost based on user preferences if available
      if (conversationMemory.userPreferences?.preferredDomains) {
        if (conversationMemory.userPreferences.preferredDomains.includes(doc.metadata.domain)) {
          boostedScore *= 1.15;
        }
      }
      
      return [doc, Math.min(boostedScore, 1.0)]; // Cap at 1.0
    }).sort(([, a], [, b]) => b - a); // Re-sort by boosted scores
  }

  /**
   * Calculate contextual relevance score based on conversation memory
   */
  private calculateContextualRelevance(
    items: LegalKnowledgeItem[],
    conversationMemory: { previousQueries: string[]; domainHistory: string[]; userPreferences?: any; matterContext?: any; }
  ): number {
    if (items.length === 0) return 0;
    
    let relevanceScore = 0;
    let factors = 0;
    
    // Factor 1: Domain consistency with conversation history
    const domainMatches = items.filter(item => 
      conversationMemory.domainHistory.includes(item.domain)
    ).length;
    if (domainMatches > 0) {
      relevanceScore += (domainMatches / items.length) * 0.4;
      factors++;
    }
    
    // Factor 2: Matter context relevance
    if (conversationMemory.matterContext?.title) {
      const matterTerms = conversationMemory.matterContext.title.toLowerCase().split(' ');
      const contentMatches = items.filter(item => {
        const content = item.content.toLowerCase();
        return matterTerms.some(term => content.includes(term));
      }).length;
      
      if (contentMatches > 0) {
        relevanceScore += (contentMatches / items.length) * 0.3;
        factors++;
      }
    }
    
    // Factor 3: User preference alignment
    if (conversationMemory.userPreferences?.preferredDomains) {
      const preferenceMatches = items.filter(item =>
        conversationMemory.userPreferences.preferredDomains.includes(item.domain)
      ).length;
      
      if (preferenceMatches > 0) {
        relevanceScore += (preferenceMatches / items.length) * 0.3;
        factors++;
      }
    }
    
    // If no memory factors applied, return baseline relevance
    if (factors === 0) return 0.7;
    
    return Math.min(relevanceScore, 1.0);
  }
}

// Export singleton instance for chat-beta
export const chatBetaRAGService = new ChatBetaRAGService(); 