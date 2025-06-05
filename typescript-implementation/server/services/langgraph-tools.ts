/**
 * LangGraph Tools Registry
 * Unified tool definitions for the LangGraph workflow
 */

import { Tool } from '@langchain/core/tools';
import { z } from 'zod';
import { chatBetaRAGService } from './chat-beta-rag-service';
import { storage } from '../storage';
import { ConversationState, RAGResult, LegalResearchResult } from '../types/conversation-state';

/**
 * Legal Research Tool - Enhanced for LangGraph
 */
export class LegalResearchTool extends Tool {
  name = 'legal_research';
  description = `Search UK legal knowledge base for statutes, regulations, and legal principles. 
    Use this when the user asks questions about law, legal rights, procedures, or needs factual legal information.
    Returns comprehensive legal research with confidence scores and source attribution.`;

  schema = z.object({
    query: z.string().describe('The legal question or topic to research'),
    domain: z.enum(['employment', 'contract', 'business', 'data_protection', 'general']).optional()
      .describe('Specific legal domain if known'),
    depth: z.enum(['basic', 'comprehensive', 'expert']).default('basic')
      .describe('Depth of research required'),
    conversationMemory: z.object({
      previousQueries: z.array(z.string()),
      domainHistory: z.array(z.string()),
      userPreferences: z.any().optional(),
      matterContext: z.any().optional()
    }).optional().describe('Conversation context for enhanced search')
  });

  async _call(args: { 
    query: string; 
    domain?: string; 
    depth?: string; 
    conversationMemory?: {
      previousQueries: string[];
      domainHistory: string[];
      userPreferences?: any;
      matterContext?: any;
    }
  }): Promise<string> {
    try {
      console.log('🔍 [LEGAL-RESEARCH-TOOL] Starting research:', {
        query: args.query,
        domain: args.domain,
        depth: args.depth,
        memoryEnhanced: !!args.conversationMemory
      });

      const searchResults = await chatBetaRAGService.searchRelevantLegal(
        args.query,
        args.domain,
        args.depth === 'expert' ? 8 : args.depth === 'comprehensive' ? 5 : 3,
        args.conversationMemory
      );

      if (searchResults.items.length === 0) {
        return JSON.stringify({
          success: false,
          message: 'No specific legal information found in the knowledge base for this query.',
          confidence: 0.1
        });
      }

      const research: LegalResearchResult = {
        query: args.query,
        primarySources: searchResults.items.map(item => ({
          id: item.id,
          title: item.title,
          content: item.content,
          source: item.source,
          domain: item.domain as any,
          confidence: item.confidence,
          relevanceScore: item.confidence,
          metadata: item.metadata
        })),
        relatedCases: [], // TODO: Implement case law search
        relevantStatutes: [], // TODO: Implement statute search
        practicalGuidance: [],
        riskAssessment: {
          overallRisk: 'medium',
          identifiedRisks: [],
          mitigationStrategies: [],
          immediateActions: [],
          recommendsLegalAdvice: searchResults.avgConfidence < 0.8
        },
        confidence: searchResults.avgConfidence
      };

      // Generate practical guidance based on research
      if (searchResults.items.length > 0) {
        research.practicalGuidance = [
          'Review the specific legal requirements identified',
          'Consider time limits and procedural requirements',
          'Gather relevant documentation and evidence',
          searchResults.avgConfidence < 0.7 ? 'Seek professional legal advice' : 'Consider professional consultation for complex matters'
        ];
      }

      console.log('✅ [LEGAL-RESEARCH-TOOL] Research completed:', {
        sourceCount: research.primarySources.length,
        confidence: research.confidence
      });

      return JSON.stringify({
        success: true,
        research,
        confidence: research.confidence,
        sourceCount: research.primarySources.length
      });

    } catch (error) {
      console.error('❌ [LEGAL-RESEARCH-TOOL] Error:', error);
      return JSON.stringify({
        success: false,
        error: 'Legal research tool encountered an error',
        confidence: 0.1
      });
    }
  }
}

/**
 * Document Generation Tool - Enhanced for LangGraph
 */
export class DocumentGenerationTool extends Tool {
  name = 'document_generation';
  description = `Generate legal documents like contracts, letters, policies, or templates.
    Use this when the user wants to create, draft, or generate any legal document.
    Returns complete document content with proper legal structure.`;

  private userId: number;

  constructor(userId: number = 1) {
    super();
    this.userId = userId;
  }

  schema = z.object({
    documentType: z.string().describe('Type of document to generate (e.g., employment contract, NDA, privacy policy)'),
    requirements: z.string().describe('Specific requirements, clauses, or details for the document'),
    jurisdiction: z.string().default('UK').describe('Legal jurisdiction (defaults to UK)'),
    parties: z.array(z.string()).optional().describe('Parties involved in the document'),
    complexity: z.enum(['basic', 'standard', 'comprehensive']).default('standard')
      .describe('Document complexity level')
  });

  async _call(args: { 
    documentType: string; 
    requirements: string; 
    jurisdiction: string;
    parties?: string[];
    complexity?: string;
  }): Promise<string> {
    try {
      console.log('📄 [DOCUMENT-GENERATION-TOOL] Starting generation:', {
        documentType: args.documentType,
        jurisdiction: args.jurisdiction,
        complexity: args.complexity
      });

      // Research relevant legal requirements first
      const legalContext = await chatBetaRAGService.getContextualLegalInfo(
        `${args.documentType} legal requirements ${args.requirements}`,
        this.inferDomain(args.documentType)
      );

      // Generate document structure based on type
      const documentContent = this.generateDocumentStructure(
        args.documentType, 
        args.requirements, 
        args.jurisdiction,
        args.parties || [],
        legalContext
      );

      // Generate professional document title
      const documentTitle = this.generateDocumentTitle(args.documentType, args.parties || []);

      // Save document to database
      let savedDocument = null;
      try {
        const documentSchemaType = this.mapToSchemaType(args.documentType);
        
        savedDocument = await storage.createDraftDocument({
          title: documentTitle,
          content: documentContent,
          type: documentSchemaType,
          status: 'draft',
          userId: this.userId
        });

        console.log('✅ [DOCUMENT-GENERATION-TOOL] Document saved:', {
          id: savedDocument.id,
          title: savedDocument.title
        });
      } catch (saveError) {
        console.error('⚠️ [DOCUMENT-GENERATION-TOOL] Save failed:', saveError);
      }

      return JSON.stringify({
        success: true,
        document: {
          id: savedDocument?.id,
          title: documentTitle,
          content: documentContent,
          type: args.documentType,
          jurisdiction: args.jurisdiction,
          saved: !!savedDocument
        },
        confidence: 0.85
      });

    } catch (error) {
      console.error('❌ [DOCUMENT-GENERATION-TOOL] Error:', error);
      return JSON.stringify({
        success: false,
        error: 'Document generation failed',
        confidence: 0.1
      });
    }
  }

  private inferDomain(documentType: string): string | undefined {
    const type = documentType.toLowerCase();
    if (type.includes('employment') || type.includes('job')) return 'employment';
    if (type.includes('privacy') || type.includes('data') || type.includes('gdpr')) return 'data_protection';
    if (type.includes('company') || type.includes('business')) return 'business';
    if (type.includes('contract') || type.includes('agreement')) return 'contract';
    return undefined;
  }

  private mapToSchemaType(documentType: string): 'contract' | 'agreement' | 'letter' | 'other' {
    const type = documentType.toLowerCase();
    if (type.includes('contract') || type.includes('employment')) return 'contract';
    if (type.includes('agreement') || type.includes('nda')) return 'agreement';
    if (type.includes('letter')) return 'letter';
    return 'other';
  }

  private generateDocumentTitle(documentType: string, parties: string[]): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const partiesText = parties.length > 0 ? `_${parties.join('_')}` : '';
    return `${documentType.replace(/\s+/g, '_')}${partiesText}_${timestamp}`;
  }

  private generateDocumentStructure(
    type: string, 
    requirements: string, 
    jurisdiction: string, 
    parties: string[],
    legalContext: string
  ): string {
    // Simplified document generation - in production this would be much more sophisticated
    const documentType = type.toLowerCase();
    
    if (documentType.includes('employment contract')) {
      return this.generateEmploymentContract(requirements, parties);
    } else if (documentType.includes('nda') || documentType.includes('non-disclosure')) {
      return this.generateNDA(requirements, parties);
    } else if (documentType.includes('privacy policy')) {
      return this.generatePrivacyPolicy(requirements);
    } else {
      return this.generateGenericDocument(type, requirements, jurisdiction, parties);
    }
  }

  private generateEmploymentContract(requirements: string, parties: string[]): string {
    const employer = parties[0] || '[EMPLOYER NAME]';
    const employee = parties[1] || '[EMPLOYEE NAME]';
    
    return `# EMPLOYMENT CONTRACT

## 1. PARTIES
**Employer:** ${employer}
**Employee:** ${employee}

## 2. POSITION AND DUTIES
Position: [JOB TITLE]
Department: [DEPARTMENT]
Reports to: [SUPERVISOR]

## 3. COMMENCEMENT
Start Date: [START DATE]
Probation Period: [PROBATION PERIOD]

## 4. COMPENSATION
Salary: £[AMOUNT] per annum
Payment: Monthly in arrears
Benefits: [BENEFITS PACKAGE]

## 5. WORKING HOURS
Standard Hours: [HOURS] per week
Days: Monday to Friday
Breaks: [BREAK ENTITLEMENT]

## 6. HOLIDAY ENTITLEMENT
Annual Leave: [DAYS] days per year
Bank Holidays: As per UK calendar

## 7. NOTICE PERIOD
Employee Notice: [PERIOD]
Employer Notice: [PERIOD]

## 8. CONFIDENTIALITY
The Employee shall maintain strict confidentiality regarding all company information.

## 9. GOVERNING LAW
This contract is governed by the laws of England and Wales.

## 10. SIGNATURES
[SIGNATURE BLOCKS]

---
*Generated on ${new Date().toLocaleDateString('en-GB')}*`;
  }

  private generateNDA(requirements: string, parties: string[]): string {
    const party1 = parties[0] || '[DISCLOSING PARTY]';
    const party2 = parties[1] || '[RECEIVING PARTY]';
    
    return `# NON-DISCLOSURE AGREEMENT

## 1. PARTIES
**Disclosing Party:** ${party1}
**Receiving Party:** ${party2}

## 2. CONFIDENTIAL INFORMATION
For the purposes of this Agreement, "Confidential Information" includes:
- Trade secrets and proprietary information
- Business plans and strategies
- Technical specifications
- Customer data and client lists
- Financial information

## 3. OBLIGATIONS
The Receiving Party agrees to:
- Maintain strict confidentiality
- Use information only for evaluation purposes
- Return all materials upon request
- Not disclose to third parties

## 4. EXCEPTIONS
Obligations do not apply to information that:
- Is publicly available
- Was known prior to disclosure
- Is independently developed
- Is required by law to be disclosed

## 5. TERM
This Agreement remains in effect for [DURATION] years.

## 6. GOVERNING LAW
Governed by the laws of England and Wales.

## 7. SIGNATURES
[SIGNATURE BLOCKS]

---
*Generated on ${new Date().toLocaleDateString('en-GB')}*`;
  }

  private generatePrivacyPolicy(requirements: string): string {
    return `# PRIVACY POLICY

## 1. INTRODUCTION
Last Updated: ${new Date().toLocaleDateString('en-GB')}

## 2. INFORMATION WE COLLECT
- Personal identification information
- Usage data and analytics
- Communication preferences

## 3. HOW WE USE INFORMATION
- Provide and maintain services
- Communicate with users
- Comply with legal obligations

## 4. DATA SHARING
- Service providers (data processors)
- Legal requirements
- Business transfers

## 5. DATA SECURITY
We implement appropriate security measures to protect personal data.

## 6. YOUR RIGHTS (UK GDPR)
- Right of access
- Right to rectification
- Right to erasure
- Right to data portability

## 7. CONTACT INFORMATION
[CONTACT DETAILS]

## 8. UPDATES
We may update this policy periodically.

---
*Generated on ${new Date().toLocaleDateString('en-GB')}*`;
  }

  private generateGenericDocument(type: string, requirements: string, jurisdiction: string, parties: string[]): string {
    return `# ${type.toUpperCase()}

## 1. INTRODUCTION
This ${type} is made on ${new Date().toLocaleDateString('en-GB')}.

## 2. PARTIES
${parties.map((party, i) => `**Party ${i + 1}:** ${party}`).join('\n')}

## 3. PURPOSE
${requirements}

## 4. TERMS AND CONDITIONS
[MAIN TERMS TO BE SPECIFIED]

## 5. GOVERNING LAW
This document is governed by the laws of ${jurisdiction}.

## 6. SIGNATURES
[SIGNATURE BLOCKS]

---
*Generated on ${new Date().toLocaleDateString('en-GB')}*`;
  }
}

/**
 * Legal Analysis Tool - Enhanced for LangGraph
 */
export class LegalAnalysisTool extends Tool {
  name = 'legal_analysis';
  description = `Analyze legal situations, assess rights and obligations, and provide structured legal advice.
    Use this when the user describes a legal problem or wants analysis of their legal position.
    Returns comprehensive legal analysis with risk assessment.`;

  schema = z.object({
    situation: z.string().describe('Description of the legal situation or problem to analyze'),
    domain: z.enum(['employment', 'contract', 'business', 'data_protection', 'general']).optional()
      .describe('Legal domain if known'),
    urgency: z.enum(['low', 'medium', 'high', 'critical']).default('medium')
      .describe('Urgency level of the situation')
  });

  async _call(args: { situation: string; domain?: string; urgency?: string }): Promise<string> {
    try {
      console.log('⚖️ [LEGAL-ANALYSIS-TOOL] Starting analysis:', {
        situation: args.situation.substring(0, 100),
        domain: args.domain,
        urgency: args.urgency
      });

      // Research relevant legal context
      const legalContext = await chatBetaRAGService.getContextualLegalInfo(
        args.situation,
        args.domain
      );

      // Perform structured analysis
      const analysis = {
        situation: args.situation,
        domain: args.domain || 'general',
        urgency: args.urgency || 'medium',
        keyIssues: this.identifyKeyIssues(args.situation),
        legalPrinciples: this.extractLegalPrinciples(legalContext),
        riskAssessment: this.assessRisks(args.situation, args.urgency || 'medium'),
        recommendations: this.generateRecommendations(args.situation, args.urgency || 'medium'),
        nextSteps: this.defineNextSteps(args.situation, args.urgency || 'medium'),
        confidence: this.calculateConfidence(legalContext)
      };

      console.log('✅ [LEGAL-ANALYSIS-TOOL] Analysis completed:', {
        keyIssuesCount: analysis.keyIssues.length,
        confidence: analysis.confidence
      });

      return JSON.stringify({
        success: true,
        analysis,
        confidence: analysis.confidence
      });

    } catch (error) {
      console.error('❌ [LEGAL-ANALYSIS-TOOL] Error:', error);
      return JSON.stringify({
        success: false,
        error: 'Legal analysis failed',
        confidence: 0.1
      });
    }
  }

  private identifyKeyIssues(situation: string): string[] {
    const issues: string[] = [];
    const situationLower = situation.toLowerCase();

    // Pattern matching for common legal issues
    if (situationLower.includes('dismiss') || situationLower.includes('fired')) {
      issues.push('Potential unfair dismissal');
    }
    if (situationLower.includes('discrimination')) {
      issues.push('Discrimination claim');
    }
    if (situationLower.includes('contract') && situationLower.includes('breach')) {
      issues.push('Contract breach');
    }
    if (situationLower.includes('deadline') || situationLower.includes('time limit')) {
      issues.push('Statutory time limits');
    }
    if (situationLower.includes('payment') || situationLower.includes('money')) {
      issues.push('Financial obligations');
    }

    return issues.length > 0 ? issues : ['General legal matter requiring assessment'];
  }

  private extractLegalPrinciples(legalContext: string): string[] {
    // Extract key legal principles from RAG context
    const principles: string[] = [];
    
    if (legalContext.includes('Employment Rights Act')) {
      principles.push('Employment protection under ERA 1996');
    }
    if (legalContext.includes('Equality Act')) {
      principles.push('Anti-discrimination protection under Equality Act 2010');
    }
    if (legalContext.includes('contract')) {
      principles.push('General contract law principles');
    }
    if (legalContext.includes('GDPR')) {
      principles.push('Data protection under UK GDPR');
    }

    return principles.length > 0 ? principles : ['General legal principles apply'];
  }

  private assessRisks(situation: string, urgency: string): any {
    const riskLevel = urgency === 'critical' ? 'high' : urgency === 'high' ? 'medium' : 'low';
    
    return {
      overallRisk: riskLevel,
      identifiedRisks: [
        'Statutory time limits may apply',
        'Evidence preservation important',
        'Early action may be beneficial'
      ],
      mitigationStrategies: [
        'Gather all relevant documentation',
        'Avoid taking actions that could prejudice position',
        'Consider early legal advice'
      ],
      immediateActions: urgency === 'critical' || urgency === 'high' ? 
        ['Seek immediate legal advice', 'Preserve all evidence'] :
        ['Document the situation', 'Research relevant deadlines']
    };
  }

  private generateRecommendations(situation: string, urgency: string): string[] {
    const recommendations = [
      'Document all relevant facts and evidence',
      'Review applicable legal requirements',
      'Consider potential outcomes and remedies'
    ];

    if (urgency === 'critical' || urgency === 'high') {
      recommendations.unshift('Seek immediate professional legal advice');
    } else {
      recommendations.push('Consider consulting with a qualified solicitor');
    }

    return recommendations;
  }

  private defineNextSteps(situation: string, urgency: string): string[] {
    const steps = ['Review the analysis provided', 'Gather supporting documentation'];
    
    if (urgency === 'critical') {
      steps.unshift('Contact solicitor immediately');
    } else if (urgency === 'high') {
      steps.push('Arrange consultation with legal professional');
    } else {
      steps.push('Research further or seek legal advice if needed');
    }

    return steps;
  }

  private calculateConfidence(legalContext: string): number {
    let confidence = 0.6; // Base confidence
    
    if (legalContext.length > 500) confidence += 0.2; // Good context available
    if (legalContext.includes('Act') || legalContext.includes('Regulation')) confidence += 0.1; // Statutory backing
    
    return Math.min(confidence, 0.9); // Cap at 90%
  }
}

/**
 * Tool registry for easy access
 */
export class LangGraphToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor(userId: number = 1) {
    this.tools.set('legal_research', new LegalResearchTool());
    this.tools.set('document_generation', new DocumentGenerationTool(userId));
    this.tools.set('legal_analysis', new LegalAnalysisTool());
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  addTool(name: string, tool: Tool): void {
    this.tools.set(name, tool);
  }

  removeTool(name: string): boolean {
    return this.tools.delete(name);
  }
}

// Export tool instances for backward compatibility
export const legalResearchTool = new LegalResearchTool();
export const documentGenerationTool = new DocumentGenerationTool();
export const legalAnalysisTool = new LegalAnalysisTool();