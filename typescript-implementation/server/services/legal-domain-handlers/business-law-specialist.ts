/**
 * Business Law Specialist Agent
 * Phase 3: Collaboration & Specialization - Domain expertise for business law matters
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { chatBetaRAGService } from '../chat-beta-rag-service';

export interface BusinessLegalAnalysis {
  businessIssue: string;
  legalStructure: {
    currentStructure?: string;
    recommendedStructure?: string;
    rationale?: string;
    complianceRequirements: string[];
  };
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    identifiedRisks: Array<{
      risk: string;
      likelihood: 'low' | 'medium' | 'high';
      impact: 'low' | 'medium' | 'high' | 'critical';
      mitigation: string;
    }>;
    recommendedInsurance: string[];
    legalProtections: string[];
  };
  governance: {
    boardRequirements?: string[];
    shareholderRights?: string[];
    decisionMaking?: string[];
    reportingObligations?: string[];
  };
  financialCompliance: {
    accountingRequirements: string[];
    taxObligations: string[];
    auditRequirements: string[];
    filingDeadlines: Array<{
      document: string;
      deadline: string;
      penalty: string;
    }>;
  };
  recommendations: Array<{
    area: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    action: string;
    timeline: string;
    cost: 'low' | 'medium' | 'high';
    legalBasis: string;
  }>;
  confidence: number;
}

export interface BusinessFormationRequest {
  businessType: 'limited_company' | 'partnership' | 'llp' | 'sole_trader' | 'community_interest_company';
  businessName: string;
  businessActivity: string;
  numberOfOwners: number;
  expectedTurnover: string;
  fundingSource: string;
  specificRequirements: string;
  riskTolerance: 'low' | 'medium' | 'high';
}

/**
 * Business Law Specialist Agent
 * Expert in UK business law, corporate governance, and commercial structures
 */
export class BusinessLawSpecialist {
  private model: ChatOpenAI;
  private expertise = {
    domain: 'business_law',
    specializations: [
      'company_formation',
      'corporate_governance',
      'shareholders_agreements',
      'partnership_agreements',
      'business_acquisitions',
      'commercial_property',
      'intellectual_property',
      'business_contracts',
      'regulatory_compliance',
      'insolvency_restructuring'
    ],
    knowledgeBase: [
      'Companies Act 2006',
      'Partnership Act 1890',
      'Limited Liability Partnerships Act 2000',
      'Insolvency Act 1986',
      'Corporate Governance Code',
      'Competition Act 1998',
      'Consumer Rights Act 2015',
      'Commercial property law',
      'Tax legislation (Corporation Tax, VAT)',
      'Financial Services regulations'
    ]
  };

  constructor() {
    // Use GPT-4o for business law - good for complex commercial analysis
    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o',
      temperature: 0.1,
      maxTokens: 4096
    });
  }

  /**
   * Analyze business legal structure and compliance
   */
  async analyzeBusinessStructure(
    businessDetails: {
      currentStructure?: string;
      businessActivity: string;
      turnover: string;
      numberOfEmployees: number;
      ownershipStructure: string;
      specificConcerns?: string;
    }
  ): Promise<BusinessLegalAnalysis> {
    console.log('🏢 [BUSINESS-LAW-SPECIALIST] Analyzing business structure...');

    try {
      // Get relevant business law context
      const legalContext = await chatBetaRAGService.searchRelevantLegal(
        `business law ${businessDetails.currentStructure} ${businessDetails.businessActivity}`,
        'business',
        6
      );

      const systemPrompt = this.buildBusinessAnalysisPrompt();
      
      const analysisPrompt = `
BUSINESS ANALYSIS REQUEST:
Current Structure: ${businessDetails.currentStructure || 'Not specified'}
Business Activity: ${businessDetails.businessActivity}
Annual Turnover: ${businessDetails.turnover}
Number of Employees: ${businessDetails.numberOfEmployees}
Ownership Structure: ${businessDetails.ownershipStructure}
Specific Concerns: ${businessDetails.specificConcerns || 'General business law review'}

RELEVANT LEGAL CONTEXT:
${legalContext.items.map(item => `${item.title}: ${item.content.substring(0, 400)}...`).join('\n\n')}

Please provide a comprehensive business legal analysis in JSON format:
{
  "businessIssue": "primary business law focus",
  "legalStructure": {
    "currentStructure": "current business structure",
    "recommendedStructure": "optimal structure if different",
    "rationale": "reasons for recommendation",
    "complianceRequirements": ["legal requirements for structure"]
  },
  "riskAssessment": {
    "overallRisk": "low|medium|high|critical",
    "identifiedRisks": [
      {
        "risk": "specific business risk",
        "likelihood": "low|medium|high",
        "impact": "low|medium|high|critical",
        "mitigation": "how to address the risk"
      }
    ],
    "recommendedInsurance": ["types of insurance needed"],
    "legalProtections": ["legal protections to implement"]
  },
  "governance": {
    "boardRequirements": ["board and governance requirements"],
    "shareholderRights": ["shareholder rights and protections"],
    "decisionMaking": ["decision-making processes"],
    "reportingObligations": ["reporting and disclosure requirements"]
  },
  "financialCompliance": {
    "accountingRequirements": ["accounting and bookkeeping obligations"],
    "taxObligations": ["tax compliance requirements"],
    "auditRequirements": ["audit requirements if applicable"],
    "filingDeadlines": [
      {
        "document": "document type",
        "deadline": "when due",
        "penalty": "consequences of late filing"
      }
    ]
  },
  "recommendations": [
    {
      "area": "business area to address",
      "priority": "low|medium|high|urgent",
      "action": "specific action to take",
      "timeline": "when to implement",
      "cost": "low|medium|high",
      "legalBasis": "legal reason for recommendation"
    }
  ],
  "confidence": 0.85
}`;

      const response = await this.model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(analysisPrompt)
      ]);

      const analysis = this.parseAnalysisResponse(response.content as string, businessDetails);
      
      console.log('✅ [BUSINESS-LAW-SPECIALIST] Analysis completed:', {
        structure: analysis.legalStructure.currentStructure,
        overallRisk: analysis.riskAssessment.overallRisk,
        recommendationsCount: analysis.recommendations.length,
        confidence: analysis.confidence
      });

      return analysis;

    } catch (error) {
      console.error('❌ [BUSINESS-LAW-SPECIALIST] Analysis error:', error);
      return this.generateFallbackAnalysis(businessDetails);
    }
  }

  /**
   * Provide business formation guidance
   */
  async provideFormationGuidance(request: BusinessFormationRequest): Promise<{
    recommendedStructure: string;
    formationSteps: Array<{
      step: string;
      description: string;
      timeframe: string;
      cost: string;
      requirements: string[];
    }>;
    ongoingObligations: Array<{
      obligation: string;
      frequency: string;
      cost: string;
      consequences: string;
    }>;
    pros: string[];
    cons: string[];
    alternatives: Array<{
      structure: string;
      suitability: string;
      keyDifferences: string[];
    }>;
    confidence: number;
  }> {
    console.log('🏗️ [BUSINESS-LAW-SPECIALIST] Providing formation guidance...');

    try {
      const formationRequirements = await this.getFormationRequirements(request.businessType);
      
      const systemPrompt = this.buildFormationGuidancePrompt();
      
      const guidancePrompt = `
BUSINESS FORMATION REQUEST:
Desired Structure: ${request.businessType}
Business Name: ${request.businessName}
Business Activity: ${request.businessActivity}
Number of Owners: ${request.numberOfOwners}
Expected Turnover: ${request.expectedTurnover}
Funding Source: ${request.fundingSource}
Specific Requirements: ${request.specificRequirements}
Risk Tolerance: ${request.riskTolerance}

FORMATION REQUIREMENTS:
${formationRequirements}

Provide comprehensive formation guidance in JSON format:
{
  "recommendedStructure": "optimal business structure",
  "formationSteps": [
    {
      "step": "step name",
      "description": "what needs to be done",
      "timeframe": "how long it takes",
      "cost": "estimated cost",
      "requirements": ["what is needed for this step"]
    }
  ],
  "ongoingObligations": [
    {
      "obligation": "ongoing requirement",
      "frequency": "how often",
      "cost": "annual cost",
      "consequences": "what happens if not met"
    }
  ],
  "pros": ["advantages of this structure"],
  "cons": ["disadvantages to consider"],
  "alternatives": [
    {
      "structure": "alternative business structure",
      "suitability": "how suitable for this business",
      "keyDifferences": ["main differences from recommended"]
    }
  ],
  "confidence": 0.85
}`;

      const response = await this.model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(guidancePrompt)
      ]);

      const guidance = this.parseGuidanceResponse(response.content as string, request);
      
      console.log('✅ [BUSINESS-LAW-SPECIALIST] Guidance provided:', {
        recommendedStructure: guidance.recommendedStructure,
        formationSteps: guidance.formationSteps.length,
        alternatives: guidance.alternatives.length
      });

      return guidance;

    } catch (error) {
      console.error('❌ [BUSINESS-LAW-SPECIALIST] Formation guidance error:', error);
      return this.generateFallbackGuidance(request);
    }
  }

  /**
   * Generate business legal documents
   */
  async generateBusinessDocument(
    documentType: 'shareholders_agreement' | 'partnership_agreement' | 'articles_of_association' | 'service_agreement' | 'supply_agreement',
    businessDetails: {
      businessName: string;
      businessType: string;
      parties: Array<{
        name: string;
        role: string;
        ownership?: string;
      }>;
      specificTerms: string;
    }
  ): Promise<{
    content: string;
    title: string;
    keyTerms: string[];
    implementationNotes: string[];
    legalReview: string[];
    confidence: number;
  }> {
    console.log('📄 [BUSINESS-LAW-SPECIALIST] Generating document:', documentType);

    try {
      const documentRequirements = await this.getDocumentRequirements(documentType);
      
      const systemPrompt = this.buildDocumentGenerationPrompt(documentType);
      
      const documentPrompt = `
DOCUMENT GENERATION REQUEST:
Document Type: ${documentType}
Business Name: ${businessDetails.businessName}
Business Type: ${businessDetails.businessType}
Parties: ${businessDetails.parties.map(p => `${p.name} (${p.role}${p.ownership ? ', ' + p.ownership : ''})`).join(', ')}
Specific Terms: ${businessDetails.specificTerms}

DOCUMENT REQUIREMENTS:
${documentRequirements}

Generate a professional business document in JSON format:
{
  "content": "complete document content",
  "title": "document title",
  "keyTerms": ["summary of key provisions"],
  "implementationNotes": ["guidance for implementation"],
  "legalReview": ["areas requiring professional review"],
  "confidence": 0.85
}`;

      const response = await this.model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(documentPrompt)
      ]);

      const document = this.parseDocumentResponse(response.content as string, documentType, businessDetails);
      
      console.log('✅ [BUSINESS-LAW-SPECIALIST] Document generated:', {
        type: documentType,
        length: document.content.length,
        keyTerms: document.keyTerms.length
      });

      return document;

    } catch (error) {
      console.error('❌ [BUSINESS-LAW-SPECIALIST] Document generation error:', error);
      return this.generateFallbackDocument(documentType, businessDetails);
    }
  }

  /**
   * Build business analysis system prompt
   */
  private buildBusinessAnalysisPrompt(): string {
    return `You are a specialist UK business law expert. You analyze business structures, governance, and compliance for business owners and commercial teams.

EXPERTISE AREAS:
- Companies Act 2006 compliance
- Business structure optimization
- Corporate governance best practices
- Shareholder and partnership agreements
- Commercial risk assessment
- Regulatory compliance across industries
- Tax and financial obligations
- Business acquisition and disposal

ANALYSIS APPROACH:
1. Assess current business structure and compliance
2. Identify legal and commercial risks
3. Evaluate governance and operational efficiency
4. Consider tax and financial implications
5. Recommend structural improvements
6. Provide practical implementation guidance

IMPORTANT CONTEXT:
- Users are business owners/managers, not lawyers
- Focus on practical, cost-effective solutions
- Consider SME resource constraints and priorities
- Balance legal protection with operational efficiency
- Recommend professional legal advice for complex matters

Provide comprehensive business law analysis with practical recommendations for structure optimization and risk mitigation.`;
  }

  /**
   * Build formation guidance system prompt
   */
  private buildFormationGuidancePrompt(): string {
    return `You are a specialist UK business formation expert. You guide business owners through the process of selecting and establishing the optimal business structure.

FORMATION EXPERTISE:
- All UK business structures (Ltd, LLP, Partnership, Sole Trader, CIC)
- Companies House registration processes
- Tax implications of different structures
- Liability protection considerations
- Governance and operational requirements
- Ongoing compliance obligations

GUIDANCE APPROACH:
1. Assess business needs and owner circumstances
2. Compare all suitable business structures
3. Explain formation process step-by-step
4. Outline ongoing obligations and costs
5. Highlight advantages and disadvantages
6. Provide practical implementation timeline

Focus on practical guidance for entrepreneurs and business owners, considering cost, liability, tax efficiency, and operational requirements.`;
  }

  /**
   * Build document generation system prompt
   */
  private buildDocumentGenerationPrompt(documentType: string): string {
    return `You are a specialist UK business law document drafting expert. You create professional business documents that protect commercial interests and comply with UK business law.

DOCUMENT TYPE: ${documentType}

DRAFTING PRINCIPLES:
- Comprehensive legal protection for all parties
- Clear commercial terms and obligations
- Compliance with Companies Act 2006 and relevant legislation
- Practical enforceability and implementation
- Balanced risk allocation
- Industry best practices

DOCUMENT REQUIREMENTS:
- Professional language suitable for business use
- All essential clauses and protections
- Clear governance and decision-making processes
- Appropriate dispute resolution mechanisms
- Exit and termination provisions
- Intellectual property protections

Generate professional business documents with comprehensive legal protections and clear commercial terms.`;
  }

  /**
   * Get formation requirements for business types
   */
  private async getFormationRequirements(businessType: string): Promise<string> {
    const requirements = {
      limited_company: `
COMPANIES ACT 2006 REQUIREMENTS:
- Minimum one director (UK resident or authorization)
- Minimum one shareholder
- Registered office address in UK
- Memorandum and Articles of Association
- Share capital allocation
- Companies House registration
- Corporation Tax registration
- VAT registration (if turnover threshold met)
- PAYE registration (if employees)
- Statutory books and records
- Annual filing obligations (confirmation statement, accounts)`,

      partnership: `
PARTNERSHIP ACT 1890 REQUIREMENTS:
- Partnership agreement (recommended but not mandatory)
- Business name registration (if different from partners' names)
- VAT registration (if turnover threshold met)
- Income Tax Self Assessment for each partner
- Class 2 and Class 4 National Insurance
- PAYE registration (if employees)
- Partnership Tax Return
- Unlimited liability for all partners
- Joint and several liability for debts`,

      llp: `
LIMITED LIABILITY PARTNERSHIPS ACT 2000 REQUIREMENTS:
- Minimum two designated members
- LLP agreement (highly recommended)
- Companies House registration
- Registered office address
- Limited liability protection
- Corporation Tax or Income Tax (depending on circumstances)
- VAT registration (if threshold met)
- Annual confirmation statement
- Filing of accounts
- Designated member responsibilities`,

      sole_trader: `
SOLE TRADER REQUIREMENTS:
- Income Tax Self Assessment registration
- Class 2 and Class 4 National Insurance
- VAT registration (if turnover threshold met)
- PAYE registration (if employees)
- Business bank account (recommended)
- Business insurance
- Record keeping obligations
- Unlimited personal liability
- Annual Self Assessment return`
    };

    return requirements[businessType as keyof typeof requirements] || 'Standard business formation requirements';
  }

  /**
   * Get document requirements
   */
  private async getDocumentRequirements(documentType: string): Promise<string> {
    const requirements = {
      shareholders_agreement: `
ESSENTIAL CLAUSES:
- Share ownership and transfer restrictions
- Board composition and director appointment
- Voting rights and decision-making thresholds
- Dividend policy and profit distribution
- Pre-emption rights on share transfers
- Drag-along and tag-along rights
- Good leaver/bad leaver provisions
- Deadlock resolution mechanisms
- Exit strategies and valuation methods
- Non-compete and confidentiality obligations`,

      partnership_agreement: `
ESSENTIAL CLAUSES:
- Partnership structure and profit sharing
- Capital contributions and drawings
- Management responsibilities and decision-making
- Admission of new partners
- Retirement and expulsion procedures
- Dissolution and winding up
- Restrictive covenants
- Dispute resolution
- Accounting and financial procedures
- Death and incapacity provisions`,

      articles_of_association: `
COMPANIES ACT 2006 REQUIREMENTS:
- Share structure and rights
- Director powers and limitations
- Shareholder voting rights
- Board meeting procedures
- Dividend distribution rules
- Share transfer restrictions
- Company administration
- Amendment procedures
- Liability limitations
- Companies House filing requirements`
    };

    return requirements[documentType as keyof typeof requirements] || 'Standard business document requirements';
  }

  /**
   * Parse analysis response
   */
  private parseAnalysisResponse(content: string, businessDetails: any): BusinessLegalAnalysis {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          businessIssue: parsed.businessIssue || 'Business structure analysis',
          legalStructure: {
            currentStructure: parsed.legalStructure?.currentStructure,
            recommendedStructure: parsed.legalStructure?.recommendedStructure,
            rationale: parsed.legalStructure?.rationale,
            complianceRequirements: parsed.legalStructure?.complianceRequirements || []
          },
          riskAssessment: {
            overallRisk: parsed.riskAssessment?.overallRisk || 'medium',
            identifiedRisks: parsed.riskAssessment?.identifiedRisks || [],
            recommendedInsurance: parsed.riskAssessment?.recommendedInsurance || [],
            legalProtections: parsed.riskAssessment?.legalProtections || []
          },
          governance: {
            boardRequirements: parsed.governance?.boardRequirements,
            shareholderRights: parsed.governance?.shareholderRights,
            decisionMaking: parsed.governance?.decisionMaking,
            reportingObligations: parsed.governance?.reportingObligations
          },
          financialCompliance: {
            accountingRequirements: parsed.financialCompliance?.accountingRequirements || [],
            taxObligations: parsed.financialCompliance?.taxObligations || [],
            auditRequirements: parsed.financialCompliance?.auditRequirements || [],
            filingDeadlines: parsed.financialCompliance?.filingDeadlines || []
          },
          recommendations: parsed.recommendations || [],
          confidence: parsed.confidence || 0.7
        };
      }
    } catch (error) {
      console.warn('⚠️ [BUSINESS-LAW-SPECIALIST] Failed to parse analysis response');
    }

    return this.generateFallbackAnalysis(businessDetails);
  }

  /**
   * Parse guidance response
   */
  private parseGuidanceResponse(content: string, request: BusinessFormationRequest): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.warn('⚠️ [BUSINESS-LAW-SPECIALIST] Failed to parse guidance response');
    }

    return this.generateFallbackGuidance(request);
  }

  /**
   * Parse document response
   */
  private parseDocumentResponse(content: string, documentType: string, businessDetails: any): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.warn('⚠️ [BUSINESS-LAW-SPECIALIST] Failed to parse document response');
    }

    return this.generateFallbackDocument(documentType, businessDetails);
  }

  /**
   * Generate fallback analysis
   */
  private generateFallbackAnalysis(businessDetails: any): BusinessLegalAnalysis {
    return {
      businessIssue: 'Business structure review required',
      legalStructure: {
        currentStructure: businessDetails.currentStructure,
        complianceRequirements: ['Professional business law review required']
      },
      riskAssessment: {
        overallRisk: 'medium',
        identifiedRisks: [
          {
            risk: 'Incomplete legal structure analysis',
            likelihood: 'medium',
            impact: 'medium',
            mitigation: 'Engage qualified business law specialist'
          }
        ],
        recommendedInsurance: ['Professional indemnity insurance', 'Public liability insurance'],
        legalProtections: ['Professional legal advice recommended']
      },
      governance: {},
      financialCompliance: {
        accountingRequirements: ['Statutory accounting requirements'],
        taxObligations: ['Corporation Tax or Income Tax compliance'],
        auditRequirements: ['Audit requirements to be determined'],
        filingDeadlines: []
      },
      recommendations: [
        {
          area: 'Business Structure',
          priority: 'high',
          action: 'Conduct professional business law review',
          timeline: 'Within 30 days',
          cost: 'medium',
          legalBasis: 'Ensure full compliance with UK business law'
        }
      ],
      confidence: 0.6
    };
  }

  /**
   * Generate fallback guidance
   */
  private generateFallbackGuidance(request: BusinessFormationRequest): any {
    return {
      recommendedStructure: request.businessType,
      formationSteps: [
        {
          step: 'Professional Consultation',
          description: 'Consult with business law specialist',
          timeframe: '1-2 weeks',
          cost: '£500-£2000',
          requirements: ['Business plan', 'Ownership structure details']
        }
      ],
      ongoingObligations: [
        {
          obligation: 'Annual compliance review',
          frequency: 'Annually',
          cost: '£500-£1500',
          consequences: 'Potential regulatory penalties'
        }
      ],
      pros: ['Professional guidance ensures compliance'],
      cons: ['Additional professional costs'],
      alternatives: [
        {
          structure: 'Professional consultation required',
          suitability: 'To be determined with specialist advice',
          keyDifferences: ['Requires detailed business analysis']
        }
      ],
      confidence: 0.5
    };
  }

  /**
   * Generate fallback document
   */
  private generateFallbackDocument(documentType: string, businessDetails: any): any {
    return {
      content: `# ${documentType.replace(/_/g, ' ').toUpperCase()}

**IMPORTANT NOTICE:** This document requires professional legal review and customization.

## Parties
${businessDetails.parties.map((p: any) => `**${p.role}:** ${p.name}`).join('\n')}

## Business Details
Business Name: ${businessDetails.businessName}
Business Type: ${businessDetails.businessType}

## Key Terms
[Specific terms to be developed with business law specialist]

## Governance
[Governance provisions to be customized]

## Legal Requirements
[Compliance requirements to be specified]

**PROFESSIONAL REVIEW REQUIRED:** This document must be reviewed and customized by a qualified business law solicitor before use.`,
      title: `${documentType}_${businessDetails.businessName}_template`,
      keyTerms: ['Professional legal review required'],
      implementationNotes: ['Must be customized by business law specialist'],
      legalReview: ['Full document review required before use'],
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
    supportedStructures: string[];
  } {
    return {
      domain: this.expertise.domain,
      specializations: this.expertise.specializations,
      knowledgeBase: this.expertise.knowledgeBase,
      supportedStructures: [
        'limited_company',
        'partnership',
        'llp',
        'sole_trader',
        'community_interest_company'
      ]
    };
  }
}

// Export singleton instance
export const businessLawSpecialist = new BusinessLawSpecialist();