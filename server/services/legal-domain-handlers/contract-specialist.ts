/**
 * Contract Specialist Agent
 * Phase 3: Collaboration & Specialization - Domain expertise for contract matters
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { chatBetaRAGService } from '../chat-beta-rag-service';

export interface ContractAnalysis {
  contractType: string;
  keyTerms: Array<{
    term: string;
    importance: 'critical' | 'high' | 'medium' | 'low';
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation: string;
  }>;
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    identifiedRisks: string[];
    mitigationStrategies: string[];
    mustHaveClauses: string[];
    redFlags: string[];
  };
  complianceCheck: {
    missingClauses: string[];
    problematicClauses: string[];
    improvementSuggestions: string[];
  };
  negotiationAdvice: {
    strengthenTerms: string[];
    removeTerms: string[];
    addClauses: string[];
    negotiationPriorities: string[];
  };
  confidence: number;
}

export interface ContractDraftRequest {
  contractType: 'service_agreement' | 'supply_agreement' | 'partnership_agreement' | 'licensing_agreement' | 'nda' | 'employment_contract' | 'consultancy_agreement';
  parties: Array<{
    name: string;
    role: 'provider' | 'recipient' | 'party_a' | 'party_b';
    businessType?: string;
  }>;
  scope: string;
  specificRequirements: string;
  jurisdiction: string;
  complexity: 'simple' | 'standard' | 'complex';
  industry?: string;
}

/**
 * Contract Specialist Agent
 * Expert in UK contract law, drafting, and negotiation
 */
export class ContractSpecialist {
  private model: ChatAnthropic;
  private expertise = {
    domain: 'contract_law',
    specializations: [
      'contract_drafting',
      'contract_analysis',
      'risk_assessment',
      'commercial_agreements',
      'service_contracts',
      'supply_agreements',
      'licensing_deals',
      'partnership_agreements',
      'breach_of_contract',
      'contract_negotiation'
    ],
    knowledgeBase: [
      'Contract Law Principles',
      'Supply of Goods and Services Act 1982',
      'Unfair Contract Terms Act 1977',
      'Consumer Rights Act 2015',
      'Late Payment of Commercial Debts Act 1998',
      'Electronic Commerce Regulations 2002',
      'Commercial law best practices'
    ]
  };

  constructor() {
    this.model = new ChatAnthropic({
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      modelName: 'claude-3-5-sonnet-20241022',
      temperature: 0.1,
      maxTokens: 8192
    });
  }

  /**
   * Analyze contract content for risks and opportunities
   */
  async analyzeContract(
    contractContent: string,
    contractType?: string,
    userRole?: 'buyer' | 'seller' | 'service_provider' | 'client'
  ): Promise<ContractAnalysis> {
    console.log('📄 [CONTRACT-SPECIALIST] Analyzing contract...');

    try {
      // Get relevant legal context
      const legalContext = await chatBetaRAGService.searchRelevantLegal(
        `contract analysis ${contractType || 'general'}`,
        'contract',
        5
      );

      const systemPrompt = this.buildContractAnalysisPrompt(userRole);
      
      const analysisPrompt = `
CONTRACT TO ANALYZE:
${contractContent}

CONTRACT TYPE: ${contractType || 'General commercial contract'}
USER ROLE: ${userRole || 'General review'}

RELEVANT LEGAL CONTEXT:
${legalContext.items.map(item => `${item.title}: ${item.content.substring(0, 400)}...`).join('\n\n')}

Please provide a comprehensive contract analysis in JSON format:
{
  "contractType": "identified contract type",
  "keyTerms": [
    {
      "term": "specific clause or term",
      "importance": "critical|high|medium|low",
      "riskLevel": "low|medium|high|critical", 
      "description": "what this term means",
      "recommendation": "advice for this term"
    }
  ],
  "riskAssessment": {
    "overallRisk": "low|medium|high|critical",
    "identifiedRisks": ["specific risks identified"],
    "mitigationStrategies": ["ways to reduce risks"],
    "mustHaveClauses": ["essential clauses missing or needed"],
    "redFlags": ["immediate concerns requiring attention"]
  },
  "complianceCheck": {
    "missingClauses": ["important clauses that should be added"],
    "problematicClauses": ["clauses that may cause issues"],
    "improvementSuggestions": ["ways to improve the contract"]
  },
  "negotiationAdvice": {
    "strengthenTerms": ["terms to negotiate for better protection"],
    "removeTerms": ["terms to try to remove or modify"],
    "addClauses": ["new clauses to propose"],
    "negotiationPriorities": ["most important items to focus on"]
  },
  "confidence": 0.85
}`;

      const response = await this.model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(analysisPrompt)
      ]);

      const analysis = this.parseAnalysisResponse(response.content as string, contractContent);
      
      console.log('✅ [CONTRACT-SPECIALIST] Analysis completed:', {
        contractType: analysis.contractType,
        overallRisk: analysis.riskAssessment.overallRisk,
        keyTermsCount: analysis.keyTerms.length,
        confidence: analysis.confidence
      });

      return analysis;

    } catch (error) {
      console.error('❌ [CONTRACT-SPECIALIST] Analysis error:', error);
      return this.generateFallbackAnalysis(contractContent);
    }
  }

  /**
   * Draft a new contract based on requirements
   */
  async draftContract(request: ContractDraftRequest): Promise<{
    content: string;
    title: string;
    keyProvisions: string[];
    reviewNotes: string[];
    complianceChecks: string[];
    confidence: number;
  }> {
    console.log('✍️ [CONTRACT-SPECIALIST] Drafting contract:', request.contractType);

    try {
      // Get contract-specific templates and requirements
      const templateRequirements = await this.getContractTemplate(request.contractType);
      
      const systemPrompt = this.buildContractDraftingPrompt(request.contractType);
      
      const draftPrompt = `
CONTRACT DRAFTING REQUEST:
Type: ${request.contractType}
Parties: ${request.parties.map(p => `${p.name} (${p.role})`).join(', ')}
Scope: ${request.scope}
Requirements: ${request.specificRequirements}
Jurisdiction: ${request.jurisdiction}
Complexity: ${request.complexity}
Industry: ${request.industry || 'General'}

TEMPLATE REQUIREMENTS:
${templateRequirements}

Draft a comprehensive ${request.contractType} that:
1. Includes all essential clauses for UK jurisdiction
2. Protects all parties' interests appropriately
3. Uses clear, enforceable language
4. Addresses the specific scope and requirements
5. Includes appropriate risk allocation
6. Follows commercial best practices

Format the response as:
{
  "content": "complete contract text",
  "title": "professional contract title",
  "keyProvisions": ["summary of main contract provisions"],
  "reviewNotes": ["important points for review"],
  "complianceChecks": ["compliance considerations"],
  "confidence": 0.85
}`;

      const response = await this.model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(draftPrompt)
      ]);

      const contract = this.parseContractResponse(response.content as string, request);
      
      console.log('✅ [CONTRACT-SPECIALIST] Contract drafted:', {
        type: request.contractType,
        length: contract.content.length,
        provisions: contract.keyProvisions.length
      });

      return contract;

    } catch (error) {
      console.error('❌ [CONTRACT-SPECIALIST] Drafting error:', error);
      return this.generateFallbackContract(request);
    }
  }

  /**
   * Get contract negotiation advice
   */
  async getNegotiationAdvice(
    contractContent: string,
    userPosition: string,
    negotiationGoals: string[]
  ): Promise<{
    strategy: string;
    tacticalAdvice: Array<{
      clause: string;
      approach: string;
      alternatives: string[];
      rationale: string;
    }>;
    dealBreakers: string[];
    fallbackPositions: string[];
    confidence: number;
  }> {
    console.log('🤝 [CONTRACT-SPECIALIST] Generating negotiation advice...');

    try {
      const systemPrompt = `You are a commercial contract negotiation expert. Provide strategic advice for contract negotiations from a UK legal perspective.

Focus on:
- Practical negotiation tactics for business people
- Risk-based prioritization of terms
- Alternative language and approaches
- Deal structure optimization
- Relationship preservation during negotiation`;

      const negotiationPrompt = `
CONTRACT CONTENT:
${contractContent}

USER POSITION: ${userPosition}
NEGOTIATION GOALS: ${negotiationGoals.join(', ')}

Provide strategic negotiation advice in JSON format:
{
  "strategy": "overall negotiation approach",
  "tacticalAdvice": [
    {
      "clause": "specific clause to negotiate",
      "approach": "how to approach this negotiation",
      "alternatives": ["alternative formulations"],
      "rationale": "why this approach works"
    }
  ],
  "dealBreakers": ["terms that are non-negotiable"],
  "fallbackPositions": ["compromise positions"],
  "confidence": 0.85
}`;

      const response = await this.model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(negotiationPrompt)
      ]);

      return this.parseNegotiationResponse(response.content as string);

    } catch (error) {
      console.error('❌ [CONTRACT-SPECIALIST] Negotiation advice error:', error);
      return {
        strategy: 'Focus on mutual benefit and clear communication',
        tacticalAdvice: [],
        dealBreakers: ['Seek professional legal advice for complex negotiations'],
        fallbackPositions: ['Consider mediation if negotiations stall'],
        confidence: 0.5
      };
    }
  }

  /**
   * Build contract analysis system prompt
   */
  private buildContractAnalysisPrompt(userRole?: string): string {
    return `You are a specialist UK contract law expert. You analyze commercial contracts to identify risks, opportunities, and compliance issues for business owners and commercial teams.

EXPERTISE AREAS:
- UK Contract Law principles
- Commercial agreement structures
- Risk assessment and mitigation
- Unfair terms legislation
- Consumer protection law
- Commercial best practices

ANALYSIS APPROACH:
1. Identify contract type and key commercial terms
2. Assess legal and commercial risks
3. Check compliance with UK legislation
4. Evaluate enforceability of terms
5. Suggest improvements and protections
6. Provide practical negotiation advice

USER PERSPECTIVE: ${userRole || 'General commercial review'}

IMPORTANT CONTEXT:
- Users are business owners/commercial teams, not lawyers
- Focus on practical, actionable advice
- Emphasize risk mitigation and commercial protection
- Consider both legal compliance and business practicality
- Recommend professional legal review for high-risk or complex contracts

Provide thorough, practical contract analysis with clear risk identification and improvement recommendations.`;
  }

  /**
   * Build contract drafting system prompt
   */
  private buildContractDraftingPrompt(contractType: string): string {
    return `You are a specialist UK commercial contract drafting expert. You create professional contracts that protect business interests and comply with UK commercial law.

CONTRACT TYPE: ${contractType}

DRAFTING PRINCIPLES:
- Clear, unambiguous language
- Balanced risk allocation
- Enforceable terms under UK law
- Commercial practicality
- Comprehensive protection
- Industry best practices

KEY REQUIREMENTS:
- Full compliance with UK contract law
- Protection for all parties
- Clear payment and delivery terms
- Appropriate termination clauses
- Dispute resolution mechanisms
- Intellectual property protection
- Data protection compliance (where relevant)

IMPORTANT NOTES:
- Contracts are for business use, not legal professionals
- Include practical guidance for implementation
- Flag terms requiring professional review
- Ensure commercial viability and enforceability
- Consider SME business contexts

Generate professional, enforceable contracts with clear commercial terms and appropriate legal protections.`;
  }

  /**
   * Get contract template requirements
   */
  private async getContractTemplate(contractType: string): Promise<string> {
    const templates = {
      service_agreement: `
ESSENTIAL CLAUSES:
- Service description and scope
- Performance standards and KPIs
- Payment terms and schedules
- Intellectual property ownership
- Confidentiality provisions
- Limitation of liability
- Termination rights and procedures
- Dispute resolution
- Data protection (UK GDPR)
- Force majeure provisions`,

      supply_agreement: `
ESSENTIAL CLAUSES:
- Product specifications and quality standards
- Delivery terms and schedules
- Price and payment terms
- Risk of loss allocation
- Warranty and remedies
- Intellectual property rights
- Termination provisions
- Liability limitations
- Compliance with regulations
- Force majeure and excuses`,

      nda: `
ESSENTIAL CLAUSES:
- Definition of confidential information
- Permitted uses and restrictions
- Duration of confidentiality
- Return of materials
- Exceptions to confidentiality
- Remedies for breach
- Governing law and jurisdiction
- Survival of obligations`,

      partnership_agreement: `
ESSENTIAL CLAUSES:
- Partnership structure and governance
- Capital contributions and profit sharing
- Management responsibilities
- Decision-making processes
- Transfer restrictions
- Exit mechanisms
- Dispute resolution
- Dissolution procedures
- Intellectual property ownership
- Non-compete provisions`
    };

    return templates[contractType as keyof typeof templates] || 'Standard commercial contract provisions required';
  }

  /**
   * Parse analysis response
   */
  private parseAnalysisResponse(content: string, contractContent: string): ContractAnalysis {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          contractType: parsed.contractType || 'Commercial Contract',
          keyTerms: parsed.keyTerms || [],
          riskAssessment: {
            overallRisk: parsed.riskAssessment?.overallRisk || 'medium',
            identifiedRisks: parsed.riskAssessment?.identifiedRisks || [],
            mitigationStrategies: parsed.riskAssessment?.mitigationStrategies || [],
            mustHaveClauses: parsed.riskAssessment?.mustHaveClauses || [],
            redFlags: parsed.riskAssessment?.redFlags || []
          },
          complianceCheck: {
            missingClauses: parsed.complianceCheck?.missingClauses || [],
            problematicClauses: parsed.complianceCheck?.problematicClauses || [],
            improvementSuggestions: parsed.complianceCheck?.improvementSuggestions || []
          },
          negotiationAdvice: {
            strengthenTerms: parsed.negotiationAdvice?.strengthenTerms || [],
            removeTerms: parsed.negotiationAdvice?.removeTerms || [],
            addClauses: parsed.negotiationAdvice?.addClauses || [],
            negotiationPriorities: parsed.negotiationAdvice?.negotiationPriorities || []
          },
          confidence: parsed.confidence || 0.7
        };
      }
    } catch (error) {
      console.warn('⚠️ [CONTRACT-SPECIALIST] Failed to parse analysis response');
    }

    return this.generateFallbackAnalysis(contractContent);
  }

  /**
   * Parse contract response
   */
  private parseContractResponse(content: string, request: ContractDraftRequest): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.warn('⚠️ [CONTRACT-SPECIALIST] Failed to parse contract response');
    }

    return this.generateFallbackContract(request);
  }

  /**
   * Parse negotiation response
   */
  private parseNegotiationResponse(content: string): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.warn('⚠️ [CONTRACT-SPECIALIST] Failed to parse negotiation response');
    }

    return {
      strategy: 'Seek professional legal advice for complex negotiations',
      tacticalAdvice: [],
      dealBreakers: ['Consult with commercial lawyer'],
      fallbackPositions: ['Consider mediation'],
      confidence: 0.5
    };
  }

  /**
   * Generate fallback analysis
   */
  private generateFallbackAnalysis(contractContent: string): ContractAnalysis {
    return {
      contractType: 'Commercial Contract',
      keyTerms: [
        {
          term: 'Payment Terms',
          importance: 'critical',
          riskLevel: 'medium',
          description: 'Terms governing payment obligations',
          recommendation: 'Review payment terms and ensure they protect your cash flow'
        }
      ],
      riskAssessment: {
        overallRisk: 'medium',
        identifiedRisks: ['Contract requires professional legal review'],
        mitigationStrategies: ['Seek specialist commercial law advice'],
        mustHaveClauses: ['Limitation of liability', 'Termination rights'],
        redFlags: ['Professional review recommended before signing']
      },
      complianceCheck: {
        missingClauses: ['Standard protective clauses may be missing'],
        problematicClauses: ['Requires detailed review'],
        improvementSuggestions: ['Consult with commercial law specialist']
      },
      negotiationAdvice: {
        strengthenTerms: ['Seek professional negotiation advice'],
        removeTerms: ['Identify unfavorable terms with legal counsel'],
        addClauses: ['Add standard protective provisions'],
        negotiationPriorities: ['Focus on key commercial terms']
      },
      confidence: 0.6
    };
  }

  /**
   * Generate fallback contract
   */
  private generateFallbackContract(request: ContractDraftRequest): any {
    return {
      content: `# ${request.contractType.replace(/_/g, ' ').toUpperCase()}

**IMPORTANT NOTICE:** This is a basic template that requires professional legal review and customization before use.

## Parties
${request.parties.map(p => `**${p.role}:** ${p.name}`).join('\n')}

## Scope of Work
${request.scope}

## Key Terms
[Specific terms to be added based on negotiations]

## Payment Terms
[Payment schedule and terms to be specified]

## Termination
[Termination conditions and procedures]

## Governing Law
This agreement shall be governed by the laws of England and Wales.

**LEGAL REVIEW REQUIRED:** This template must be reviewed and customized by a qualified commercial law solicitor before use.`,
      title: `${request.contractType}_template_${Date.now()}`,
      keyProvisions: ['Professional legal review required'],
      reviewNotes: ['Must be customized for specific business needs', 'Requires commercial law specialist review'],
      complianceChecks: ['Ensure compliance with current UK commercial law'],
      confidence: 0.5
    };
  }

  /**
   * Get specialist capabilities
   */
  getCapabilities(): {
    domain: string;
    specializations: string[];
    knowledgeBase: string[];
    supportedContracts: string[];
  } {
    return {
      domain: this.expertise.domain,
      specializations: this.expertise.specializations,
      knowledgeBase: this.expertise.knowledgeBase,
      supportedContracts: [
        'service_agreement',
        'supply_agreement', 
        'partnership_agreement',
        'licensing_agreement',
        'nda',
        'consultancy_agreement'
      ]
    };
  }
}

// Export singleton instance
export const contractSpecialist = new ContractSpecialist();