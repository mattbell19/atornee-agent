/**
 * Compliance Officer Agent
 * Phase 3: Collaboration & Specialization - Domain expertise for compliance matters
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { chatBetaRAGService } from '../chat-beta-rag-service';

export interface ComplianceAssessment {
  complianceArea: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  requirements: Array<{
    regulation: string;
    requirement: string;
    status: 'compliant' | 'partial' | 'non_compliant' | 'unclear';
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    actionRequired: string;
    deadline?: Date;
  }>;
  gaps: Array<{
    area: string;
    description: string;
    impact: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    remediation: string;
  }>;
  recommendations: Array<{
    type: 'immediate' | 'short_term' | 'long_term';
    action: string;
    rationale: string;
    cost: 'low' | 'medium' | 'high';
    timeline: string;
  }>;
  monitoring: Array<{
    metric: string;
    frequency: string;
    responsibleParty: string;
    escalationTrigger: string;
  }>;
  confidence: number;
}

export interface ComplianceAuditRequest {
  businessType: string;
  industry: string;
  complianceAreas: Array<'data_protection' | 'employment' | 'health_safety' | 'financial' | 'environmental' | 'consumer_protection' | 'anti_discrimination'>;
  businessSize: 'micro' | 'small' | 'medium' | 'large';
  businessDescription: string;
  specificConcerns?: string;
  jurisdiction: string;
}

/**
 * Compliance Officer Agent
 * Expert in UK regulatory compliance across multiple domains
 */
export class ComplianceOfficer {
  private model: ChatOpenAI;
  private expertise = {
    domain: 'regulatory_compliance',
    specializations: [
      'data_protection_gdpr',
      'employment_compliance',
      'health_safety_compliance',
      'consumer_protection',
      'anti_discrimination',
      'financial_regulations',
      'environmental_compliance',
      'accessibility_compliance',
      'corporate_governance',
      'regulatory_reporting'
    ],
    knowledgeBase: [
      'UK GDPR and Data Protection Act 2018',
      'Employment Rights Act 1996',
      'Equality Act 2010',
      'Health and Safety at Work Act 1974',
      'Consumer Rights Act 2015',
      'Companies Act 2006',
      'Environmental Protection Act 1990',
      'Accessibility Regulations 2018',
      'Financial Services Regulations',
      'Competition Act 1998'
    ]
  };

  constructor() {
    // Use GPT-4o for compliance - good for systematic analysis and regulation tracking
    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o',
      temperature: 0.1,
      maxTokens: 4096
    });
  }

  /**
   * Conduct comprehensive compliance assessment
   */
  async assessCompliance(request: ComplianceAuditRequest): Promise<ComplianceAssessment> {
    console.log('🔍 [COMPLIANCE-OFFICER] Conducting compliance assessment...');

    try {
      // Get relevant regulatory context
      const regulatoryContext = await chatBetaRAGService.searchRelevantLegal(
        `${request.industry} ${request.complianceAreas.join(' ')} compliance regulations`,
        'business',
        8
      );

      const systemPrompt = this.buildComplianceAssessmentPrompt(request);
      
      const assessmentPrompt = `
BUSINESS ASSESSMENT REQUEST:
Business Type: ${request.businessType}
Industry: ${request.industry}
Size: ${request.businessSize}
Description: ${request.businessDescription}
Compliance Areas: ${request.complianceAreas.join(', ')}
Specific Concerns: ${request.specificConcerns || 'General compliance review'}
Jurisdiction: ${request.jurisdiction}

RELEVANT REGULATORY CONTEXT:
${regulatoryContext.items.map(item => `${item.title}: ${item.content.substring(0, 400)}...`).join('\n\n')}

Please provide a comprehensive compliance assessment in JSON format:
{
  "complianceArea": "primary compliance focus",
  "overallRisk": "low|medium|high|critical",
  "requirements": [
    {
      "regulation": "specific regulation",
      "requirement": "what is required",
      "status": "compliant|partial|non_compliant|unclear",
      "riskLevel": "low|medium|high|critical",
      "actionRequired": "specific action needed",
      "deadline": "2024-12-31" or null
    }
  ],
  "gaps": [
    {
      "area": "compliance area with gap",
      "description": "what is missing",
      "impact": "potential consequences",
      "priority": "low|medium|high|urgent",
      "remediation": "how to fix"
    }
  ],
  "recommendations": [
    {
      "type": "immediate|short_term|long_term",
      "action": "specific recommendation",
      "rationale": "why this is important",
      "cost": "low|medium|high",
      "timeline": "timeframe for implementation"
    }
  ],
  "monitoring": [
    {
      "metric": "what to monitor",
      "frequency": "how often",
      "responsibleParty": "who is responsible",
      "escalationTrigger": "when to escalate"
    }
  ],
  "confidence": 0.85
}`;

      const response = await this.model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(assessmentPrompt)
      ]);

      const assessment = this.parseAssessmentResponse(response.content as string, request);
      
      console.log('✅ [COMPLIANCE-OFFICER] Assessment completed:', {
        overallRisk: assessment.overallRisk,
        requirementsCount: assessment.requirements.length,
        gapsIdentified: assessment.gaps.length,
        confidence: assessment.confidence
      });

      return assessment;

    } catch (error) {
      console.error('❌ [COMPLIANCE-OFFICER] Assessment error:', error);
      return this.generateFallbackAssessment(request);
    }
  }

  /**
   * Generate compliance policy templates
   */
  async generateCompliancePolicy(
    policyType: 'data_protection' | 'health_safety' | 'equality_diversity' | 'anti_harassment' | 'code_of_conduct',
    businessDetails: {
      name: string;
      industry: string;
      size: string;
      specificRequirements?: string;
    }
  ): Promise<{
    content: string;
    title: string;
    implementationSteps: string[];
    trainingRequirements: string[];
    reviewSchedule: string;
    confidence: number;
  }> {
    console.log('📋 [COMPLIANCE-OFFICER] Generating policy:', policyType);

    try {
      const policyRequirements = await this.getPolicyRequirements(policyType);
      
      const systemPrompt = this.buildPolicyGenerationPrompt(policyType);
      
      const policyPrompt = `
POLICY GENERATION REQUEST:
Policy Type: ${policyType}
Business Name: ${businessDetails.name}
Industry: ${businessDetails.industry}
Business Size: ${businessDetails.size}
Specific Requirements: ${businessDetails.specificRequirements || 'Standard requirements'}

REGULATORY REQUIREMENTS:
${policyRequirements}

Generate a comprehensive ${policyType} policy that:
1. Complies with all relevant UK regulations
2. Is appropriate for the business size and industry
3. Uses clear, implementable language
4. Includes practical procedures and processes
5. Addresses enforcement and monitoring

Format the response as:
{
  "content": "complete policy document",
  "title": "policy title",
  "implementationSteps": ["step-by-step implementation guidance"],
  "trainingRequirements": ["training needed for staff"],
  "reviewSchedule": "how often to review and update",
  "confidence": 0.85
}`;

      const response = await this.model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(policyPrompt)
      ]);

      const policy = this.parsePolicyResponse(response.content as string, policyType, businessDetails);
      
      console.log('✅ [COMPLIANCE-OFFICER] Policy generated:', {
        type: policyType,
        length: policy.content.length,
        implementationSteps: policy.implementationSteps.length
      });

      return policy;

    } catch (error) {
      console.error('❌ [COMPLIANCE-OFFICER] Policy generation error:', error);
      return this.generateFallbackPolicy(policyType, businessDetails);
    }
  }

  /**
   * Get regulatory deadline alerts
   */
  async getComplianceDeadlines(
    businessType: string,
    industry: string,
    complianceAreas: string[]
  ): Promise<Array<{
    regulation: string;
    deadline: Date;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    actionRequired: string;
    penalties: string;
  }>> {
    console.log('📅 [COMPLIANCE-OFFICER] Checking compliance deadlines...');

    const currentDate = new Date();
    const deadlines = [];

    // Common UK compliance deadlines
    const commonDeadlines = [
      {
        regulation: 'Companies House Annual Return',
        deadline: new Date(currentDate.getFullYear(), 11, 31), // Dec 31
        description: 'Annual confirmation statement filing deadline',
        priority: 'high' as const,
        actionRequired: 'File confirmation statement with Companies House',
        penalties: 'Late filing penalties up to £1,500'
      },
      {
        regulation: 'VAT Return',
        deadline: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 7), // Next month 7th
        description: 'Quarterly VAT return submission',
        priority: 'high' as const,
        actionRequired: 'Submit VAT return and payment',
        penalties: 'Default surcharge and interest on late payments'
      },
      {
        regulation: 'PAYE/CIS Monthly Return',
        deadline: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 19), // 19th of next month
        description: 'Monthly PAYE and CIS return submission',
        priority: 'high' as const,
        actionRequired: 'Submit RTI Full Payment Submission',
        penalties: 'Penalties from £100 per month for late submission'
      }
    ];

    // Add GDPR-specific deadlines if data protection is included
    if (complianceAreas.includes('data_protection')) {
      deadlines.push({
        regulation: 'GDPR Data Protection Impact Assessment',
        deadline: new Date(currentDate.getFullYear() + 1, 4, 25), // May 25 (GDPR anniversary)
        description: 'Annual review of data protection practices',
        priority: 'medium' as const,
        actionRequired: 'Review and update DPIA documentation',
        penalties: 'Fines up to 4% of annual turnover or £17.5m'
      });
    }

    return [...deadlines, ...commonDeadlines];
  }

  /**
   * Build compliance assessment system prompt
   */
  private buildComplianceAssessmentPrompt(request: ComplianceAuditRequest): string {
    return `You are a specialist UK regulatory compliance expert. You conduct comprehensive compliance assessments for businesses across multiple regulatory domains.

EXPERTISE AREAS:
- UK GDPR and Data Protection Act 2018
- Employment law compliance
- Health and Safety at Work Act 1974
- Equality Act 2010
- Consumer protection legislation
- Financial services regulations
- Environmental compliance
- Corporate governance requirements

ASSESSMENT APPROACH:
1. Identify all applicable regulations for the business
2. Assess current compliance status and gaps
3. Evaluate risk levels and potential consequences
4. Provide actionable recommendations with timelines
5. Establish ongoing monitoring requirements
6. Consider business size and industry context

BUSINESS CONTEXT:
Type: ${request.businessType}
Industry: ${request.industry}
Size: ${request.businessSize}
Focus Areas: ${request.complianceAreas.join(', ')}

IMPORTANT CONTEXT:
- Users are business owners/managers, not compliance professionals
- Focus on practical, implementable recommendations
- Prioritize by risk level and regulatory impact
- Consider cost and resource constraints for SMEs
- Recommend professional compliance advice where appropriate

Provide thorough, risk-based compliance assessment with clear action plans and monitoring requirements.`;
  }

  /**
   * Build policy generation system prompt
   */
  private buildPolicyGenerationPrompt(policyType: string): string {
    return `You are a specialist UK compliance policy expert. You create comprehensive, implementable policies that ensure regulatory compliance for businesses.

POLICY TYPE: ${policyType}

POLICY REQUIREMENTS:
- Full compliance with relevant UK regulations
- Clear, practical procedures and processes
- Appropriate for business size and industry
- Enforceable and implementable language
- Regular review and update mechanisms
- Training and awareness components

COMPLIANCE STANDARDS:
- Meet all legal minimum requirements
- Follow regulatory best practices
- Include monitoring and enforcement procedures
- Address risk mitigation and incident response
- Ensure accessibility and understanding by all staff

IMPORTANT NOTES:
- Policies are for business implementation, not legal professionals
- Include practical guidance for policy rollout
- Consider SME resource constraints
- Ensure policies are proportionate to business size
- Flag areas requiring professional compliance review

Generate professional, compliant policies with clear implementation guidance and enforcement mechanisms.`;
  }

  /**
   * Get policy requirements for specific types
   */
  private async getPolicyRequirements(policyType: string): Promise<string> {
    const requirements = {
      data_protection: `
UK GDPR AND DATA PROTECTION ACT 2018 REQUIREMENTS:
- Lawful basis for processing personal data
- Data subject rights and procedures
- Data retention and deletion policies
- Security measures and breach procedures
- Privacy by design principles
- International transfer safeguards
- Data Protection Officer requirements (if applicable)
- Record of processing activities
- Privacy impact assessments
- Staff training and awareness`,

      health_safety: `
HEALTH AND SAFETY AT WORK ACT 1974 REQUIREMENTS:
- General duty of care to employees and visitors
- Risk assessment procedures and documentation
- Safe systems of work and procedures
- Training and competency requirements
- Incident reporting and investigation
- Emergency procedures and first aid
- Personal protective equipment provision
- Workplace safety monitoring
- Consultation with employees
- Management responsibilities and accountability`,

      equality_diversity: `
EQUALITY ACT 2010 REQUIREMENTS:
- Protection of all protected characteristics
- Reasonable adjustments for disability
- Prevention of discrimination and harassment
- Equal opportunities in recruitment and promotion
- Pay equality and transparency
- Positive action provisions
- Complaint and grievance procedures
- Training and awareness programs
- Monitoring and reporting
- Management accountability`,

      code_of_conduct: `
GENERAL BUSINESS CONDUCT REQUIREMENTS:
- Ethical business practices
- Conflicts of interest management
- Anti-bribery and corruption measures
- Whistleblowing procedures
- Customer and supplier relations
- Information security and confidentiality
- Social media and communications
- Compliance monitoring and enforcement
- Disciplinary procedures
- Regular review and updates`
    };

    return requirements[policyType as keyof typeof requirements] || 'Standard business policy requirements';
  }

  /**
   * Parse assessment response
   */
  private parseAssessmentResponse(content: string, request: ComplianceAuditRequest): ComplianceAssessment {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          complianceArea: parsed.complianceArea || request.complianceAreas[0],
          overallRisk: parsed.overallRisk || 'medium',
          requirements: parsed.requirements || [],
          gaps: parsed.gaps || [],
          recommendations: parsed.recommendations || [],
          monitoring: parsed.monitoring || [],
          confidence: parsed.confidence || 0.7
        };
      }
    } catch (error) {
      console.warn('⚠️ [COMPLIANCE-OFFICER] Failed to parse assessment response');
    }

    return this.generateFallbackAssessment(request);
  }

  /**
   * Parse policy response
   */
  private parsePolicyResponse(content: string, policyType: string, businessDetails: any): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.warn('⚠️ [COMPLIANCE-OFFICER] Failed to parse policy response');
    }

    return this.generateFallbackPolicy(policyType, businessDetails);
  }

  /**
   * Generate fallback assessment
   */
  private generateFallbackAssessment(request: ComplianceAuditRequest): ComplianceAssessment {
    return {
      complianceArea: request.complianceAreas[0] || 'general_compliance',
      overallRisk: 'medium',
      requirements: [
        {
          regulation: 'General Business Compliance',
          requirement: 'Comprehensive compliance review required',
          status: 'unclear',
          riskLevel: 'medium',
          actionRequired: 'Conduct professional compliance audit'
        }
      ],
      gaps: [
        {
          area: 'Compliance Assessment',
          description: 'Professional compliance review needed',
          impact: 'Potential regulatory breaches',
          priority: 'high',
          remediation: 'Engage qualified compliance consultant'
        }
      ],
      recommendations: [
        {
          type: 'immediate',
          action: 'Seek professional compliance advice',
          rationale: 'Ensure all regulatory requirements are met',
          cost: 'medium',
          timeline: 'Within 30 days'
        }
      ],
      monitoring: [
        {
          metric: 'Compliance review completion',
          frequency: 'Annually',
          responsibleParty: 'Business owner/manager',
          escalationTrigger: 'Any regulatory changes or incidents'
        }
      ],
      confidence: 0.6
    };
  }

  /**
   * Generate fallback policy
   */
  private generateFallbackPolicy(policyType: string, businessDetails: any): any {
    return {
      content: `# ${policyType.replace(/_/g, ' ').toUpperCase()} POLICY

**IMPORTANT NOTICE:** This is a basic template that requires professional compliance review and customization.

## Purpose
This policy ensures compliance with relevant UK regulations for ${businessDetails.name}.

## Scope
This policy applies to all employees, contractors, and stakeholders.

## Responsibilities
[To be defined based on organizational structure]

## Procedures
[Specific procedures to be developed with compliance specialist]

## Monitoring and Review
This policy will be reviewed annually or when regulations change.

**COMPLIANCE REVIEW REQUIRED:** This template must be reviewed and customized by a qualified compliance specialist before implementation.`,
      title: `${policyType}_policy_${businessDetails.name}`,
      implementationSteps: [
        'Engage compliance specialist for review',
        'Customize policy for specific business needs',
        'Conduct staff training on policy requirements',
        'Implement monitoring and review procedures'
      ],
      trainingRequirements: [
        'Professional compliance training required',
        'Policy awareness training for all staff',
        'Regular compliance updates and refreshers'
      ],
      reviewSchedule: 'Annually or when regulations change',
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
    supportedAssessments: string[];
  } {
    return {
      domain: this.expertise.domain,
      specializations: this.expertise.specializations,
      knowledgeBase: this.expertise.knowledgeBase,
      supportedAssessments: [
        'data_protection',
        'employment_compliance',
        'health_safety',
        'consumer_protection',
        'anti_discrimination',
        'financial_regulations'
      ]
    };
  }
}

// Export singleton instance
export const complianceOfficer = new ComplianceOfficer();