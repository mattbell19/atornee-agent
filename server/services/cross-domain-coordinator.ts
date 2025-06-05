/**
 * Cross-Domain Coordinator Service
 * Phase 3: Handles coordination between multiple legal domain specialists
 * Enables cross-domain knowledge linking and multi-specialist collaboration
 */

import { employmentLawHandler } from './legal-domain-handlers/employment-law-handler';
import { businessLawSpecialist } from './legal-domain-handlers/business-law-specialist';
import { contractSpecialist } from './legal-domain-handlers/contract-specialist';
import { complianceOfficer } from './legal-domain-handlers/compliance-officer';
import { chatBetaRAGService } from './chat-beta-rag-service';

export interface CrossDomainAnalysis {
  primaryDomain: string;
  secondaryDomains: string[];
  domainOverlap: {
    domain: string;
    relevanceScore: number;
    keyAreas: string[];
    recommendations: string[];
  }[];
  crossDomainRisks: string[];
  coordinatedAdvice: string;
  specialistInputs: {
    domain: string;
    agent: string;
    analysis: any;
    confidence: number;
  }[];
  integrationPoints: string[];
  overallConfidence: number;
}

export interface DomainCoordinationRequest {
  query: string;
  primaryDomain: string;
  crossDomainRequirements: string[];
  conversationMemory?: {
    previousQueries: string[];
    domainHistory: string[];
    userPreferences?: any;
    matterContext?: any;
  };
  userContext?: any;
}

/**
 * Cross-Domain Coordinator
 * Orchestrates multiple specialist agents for complex multi-domain queries
 */
export class CrossDomainCoordinator {
  private domainSpecialists = {
    employment: employmentLawHandler,
    business: businessLawSpecialist,
    contract: contractSpecialist,
    compliance: complianceOfficer
  };

  /**
   * Analyze cross-domain requirements and coordinate specialist responses
   */
  async coordinateAnalysis(request: DomainCoordinationRequest): Promise<CrossDomainAnalysis> {
    console.log('🔗 [CROSS-DOMAIN] Starting cross-domain coordination...', {
      primaryDomain: request.primaryDomain,
      crossDomains: request.crossDomainRequirements
    });

    try {
      // Step 1: Identify domain overlaps and integration points
      const domainOverlap = await this.analyzeDomainOverlaps(
        request.primaryDomain,
        request.crossDomainRequirements,
        request.query
      );

      // Step 2: Gather specialist inputs from relevant domains
      const specialistInputs = await this.gatherSpecialistInputs(
        request.query,
        [request.primaryDomain, ...request.crossDomainRequirements],
        request.conversationMemory
      );

      // Step 3: Identify cross-domain risks and integration points
      const crossDomainRisks = this.identifyCrossDomainRisks(
        request.primaryDomain,
        request.crossDomainRequirements,
        specialistInputs
      );

      const integrationPoints = this.findIntegrationPoints(specialistInputs);

      // Step 4: Generate coordinated advice
      const coordinatedAdvice = await this.generateCoordinatedAdvice(
        request.query,
        specialistInputs,
        domainOverlap,
        crossDomainRisks
      );

      // Step 5: Calculate overall confidence
      const overallConfidence = this.calculateOverallConfidence(specialistInputs, domainOverlap);

      console.log('✅ [CROSS-DOMAIN] Coordination completed:', {
        specialistsConsulted: specialistInputs.length,
        integrationPoints: integrationPoints.length,
        overallConfidence
      });

      return {
        primaryDomain: request.primaryDomain,
        secondaryDomains: request.crossDomainRequirements,
        domainOverlap,
        crossDomainRisks,
        coordinatedAdvice,
        specialistInputs,
        integrationPoints,
        overallConfidence
      };

    } catch (error) {
      console.error('❌ [CROSS-DOMAIN] Coordination error:', error);
      return this.generateFallbackAnalysis(request);
    }
  }

  /**
   * Analyze overlaps between different legal domains
   */
  private async analyzeDomainOverlaps(
    primaryDomain: string,
    crossDomains: string[],
    query: string
  ): Promise<Array<{
    domain: string;
    relevanceScore: number;
    keyAreas: string[];
    recommendations: string[];
  }>> {
    const overlaps = [];

    for (const domain of crossDomains) {
      const relevanceScore = await this.calculateDomainRelevance(primaryDomain, domain, query);
      const keyAreas = this.identifyKeyOverlapAreas(primaryDomain, domain);
      const recommendations = this.generateCrossDomainRecommendations(primaryDomain, domain);

      overlaps.push({
        domain,
        relevanceScore,
        keyAreas,
        recommendations
      });
    }

    return overlaps.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Calculate relevance score between two domains for a specific query
   */
  private async calculateDomainRelevance(
    primaryDomain: string,
    secondaryDomain: string,
    query: string
  ): Promise<number> {
    // Define domain intersection mappings
    const domainIntersections = {
      employment_business: 0.8, // High overlap (directors, company policies)
      employment_contract: 0.7, // Employment contracts
      employment_compliance: 0.9, // Very high (employment law compliance)
      business_contract: 0.8, // Commercial agreements
      business_compliance: 0.9, // Corporate compliance
      contract_compliance: 0.7, // Contract compliance requirements
    };

    const key = `${primaryDomain}_${secondaryDomain}`;
    const reverseKey = `${secondaryDomain}_${primaryDomain}`;
    
    const baseScore = domainIntersections[key as keyof typeof domainIntersections] || 
                     domainIntersections[reverseKey as keyof typeof domainIntersections] || 
                     0.5;

    // Adjust based on query content
    const queryLower = query.toLowerCase();
    let queryBoost = 0;

    // Check for cross-domain keywords in query
    const crossDomainKeywords = {
      employment_business: ['director', 'company policy', 'workplace', 'employee'],
      employment_contract: ['employment contract', 'terms', 'termination'],
      employment_compliance: ['gdpr', 'data protection', 'health safety'],
      business_contract: ['commercial', 'service agreement', 'partnership'],
      business_compliance: ['corporate governance', 'reporting', 'audit'],
      contract_compliance: ['regulatory', 'terms compliance', 'legal requirements']
    };

    const keywords = crossDomainKeywords[key as keyof typeof crossDomainKeywords] || 
                    crossDomainKeywords[reverseKey as keyof typeof crossDomainKeywords] || [];

    for (const keyword of keywords) {
      if (queryLower.includes(keyword)) {
        queryBoost += 0.1;
      }
    }

    return Math.min(1.0, baseScore + queryBoost);
  }

  /**
   * Identify key areas where domains overlap
   */
  private identifyKeyOverlapAreas(primaryDomain: string, secondaryDomain: string): string[] {
    const overlapAreas = {
      employment_business: [
        'Director duties and responsibilities',
        'Company employment policies',
        'Corporate governance and HR',
        'Business structure impact on employment'
      ],
      employment_contract: [
        'Employment contract terms',
        'Termination procedures',
        'Non-compete clauses',
        'Service agreements vs employment'
      ],
      employment_compliance: [
        'Employment law compliance',
        'Data protection in workplace',
        'Health and safety requirements',
        'Anti-discrimination policies'
      ],
      business_contract: [
        'Commercial service agreements',
        'Partnership and joint venture agreements',
        'Supply chain contracts',
        'Intellectual property licensing'
      ],
      business_compliance: [
        'Corporate governance requirements',
        'Financial reporting obligations',
        'Regulatory compliance frameworks',
        'Board and shareholder responsibilities'
      ],
      contract_compliance: [
        'Contract compliance monitoring',
        'Regulatory approval requirements',
        'Data protection in contracts',
        'Industry-specific contract terms'
      ]
    };

    const key = `${primaryDomain}_${secondaryDomain}`;
    const reverseKey = `${secondaryDomain}_${primaryDomain}`;
    
    return overlapAreas[key as keyof typeof overlapAreas] || 
           overlapAreas[reverseKey as keyof typeof overlapAreas] || 
           ['General legal principles', 'Risk assessment', 'Legal documentation'];
  }

  /**
   * Generate cross-domain recommendations
   */
  private generateCrossDomainRecommendations(primaryDomain: string, secondaryDomain: string): string[] {
    const recommendations = {
      employment_business: [
        'Ensure employment policies align with corporate governance',
        'Consider director employment status implications',
        'Review company structure impact on employment law'
      ],
      employment_contract: [
        'Align employment contracts with business agreements',
        'Ensure consistent termination procedures',
        'Review cross-referencing between contracts'
      ],
      employment_compliance: [
        'Implement integrated compliance monitoring',
        'Ensure data protection compliance in HR processes',
        'Coordinate health & safety with employment policies'
      ],
      business_contract: [
        'Align commercial terms with business structure',
        'Consider corporate governance in contract approval',
        'Ensure contract terms support business objectives'
      ],
      business_compliance: [
        'Integrate corporate and regulatory compliance',
        'Ensure board oversight of compliance programs',
        'Align reporting with business strategy'
      ],
      contract_compliance: [
        'Build compliance requirements into contract terms',
        'Establish contract compliance monitoring',
        'Ensure regulatory alignment in agreements'
      ]
    };

    const key = `${primaryDomain}_${secondaryDomain}`;
    const reverseKey = `${secondaryDomain}_${primaryDomain}`;
    
    return recommendations[key as keyof typeof recommendations] || 
           recommendations[reverseKey as keyof typeof recommendations] || 
           ['Seek specialist advice for cross-domain implications'];
  }

  /**
   * Gather inputs from relevant specialist agents
   */
  private async gatherSpecialistInputs(
    query: string,
    domains: string[],
    conversationMemory?: any
  ): Promise<Array<{
    domain: string;
    agent: string;
    analysis: any;
    confidence: number;
  }>> {
    const inputs = [];

    for (const domain of domains) {
      const specialist = this.domainSpecialists[domain as keyof typeof this.domainSpecialists];
      if (specialist) {
        try {
          let analysis;
          let confidence = 0.5;

          // Call appropriate specialist method based on domain
          switch (domain) {
            case 'employment':
              if ('analyzeRequest' in specialist) {
                analysis = await specialist.analyzeRequest(query, conversationMemory || {});
                confidence = 0.8;
              }
              break;
            case 'business':
              if ('analyzeBusinessStructure' in specialist) {
                analysis = await specialist.analyzeBusinessStructure({
                  businessActivity: query,
                  turnover: 'Unknown',
                  numberOfEmployees: 0,
                  ownershipStructure: 'Unknown'
                });
                confidence = analysis.confidence || 0.7;
              }
              break;
            case 'contract':
              if ('analyzeContract' in specialist) {
                analysis = await specialist.analyzeContract(query);
                confidence = analysis.confidence || 0.7;
              }
              break;
            case 'compliance':
              if ('assessCompliance' in specialist) {
                analysis = await specialist.assessCompliance({
                  businessType: 'Unknown',
                  industry: 'General',
                  complianceAreas: ['general'],
                  businessSize: 'small',
                  businessDescription: query,
                  jurisdiction: 'UK'
                });
                confidence = analysis.confidence || 0.7;
              }
              break;
          }

          if (analysis) {
            inputs.push({
              domain,
              agent: specialist.constructor.name,
              analysis,
              confidence
            });
          }

        } catch (error) {
          console.warn(`⚠️ [CROSS-DOMAIN] Failed to get ${domain} specialist input:`, error);
        }
      }
    }

    return inputs;
  }

  /**
   * Identify cross-domain risks
   */
  private identifyCrossDomainRisks(
    primaryDomain: string,
    crossDomains: string[],
    specialistInputs: any[]
  ): string[] {
    const risks = [];

    // Common cross-domain risks
    if (crossDomains.length > 1) {
      risks.push('Complex multi-domain legal requirements may require specialist coordination');
    }

    // Domain-specific risks
    if (crossDomains.includes('employment') && crossDomains.includes('business')) {
      risks.push('Director employment status may create dual legal obligations');
    }

    if (crossDomains.includes('contract') && crossDomains.includes('compliance')) {
      risks.push('Contract terms must align with regulatory compliance requirements');
    }

    if (crossDomains.includes('employment') && crossDomains.includes('compliance')) {
      risks.push('Employment practices must comply with data protection and equality laws');
    }

    // Extract risks from specialist analyses
    for (const input of specialistInputs) {
      if (input.analysis?.riskAssessment?.identifiedRisks) {
        risks.push(...input.analysis.riskAssessment.identifiedRisks.slice(0, 2));
      }
    }

    return [...new Set(risks)]; // Remove duplicates
  }

  /**
   * Find integration points between specialist analyses
   */
  private findIntegrationPoints(specialistInputs: any[]): string[] {
    const integrationPoints = [];

    if (specialistInputs.length < 2) return integrationPoints;

    // Look for common themes across specialist analyses
    const commonThemes = new Set();
    
    for (const input of specialistInputs) {
      if (input.analysis?.recommendations) {
        input.analysis.recommendations.forEach((rec: any) => {
          const theme = typeof rec === 'string' ? rec : rec.action || rec.area;
          if (theme) commonThemes.add(theme);
        });
      }
    }

    integrationPoints.push(...Array.from(commonThemes).slice(0, 3));

    return integrationPoints;
  }

  /**
   * Generate coordinated advice from multiple specialist inputs
   */
  private async generateCoordinatedAdvice(
    query: string,
    specialistInputs: any[],
    domainOverlap: any[],
    crossDomainRisks: string[]
  ): Promise<string> {
    if (specialistInputs.length === 0) {
      return 'Unable to provide coordinated analysis. Please seek specialist legal advice.';
    }

    let advice = `Based on cross-domain analysis involving ${specialistInputs.map(s => s.domain).join(', ')} law:\n\n`;

    // Primary domain guidance
    const primaryInput = specialistInputs[0];
    if (primaryInput?.analysis) {
      advice += `**Primary ${primaryInput.domain} considerations:**\n`;
      if (primaryInput.analysis.recommendations) {
        const recs = Array.isArray(primaryInput.analysis.recommendations) 
          ? primaryInput.analysis.recommendations.slice(0, 3)
          : [primaryInput.analysis.recommendations];
        recs.forEach((rec: any) => {
          const text = typeof rec === 'string' ? rec : rec.action || rec.area || 'See specialist analysis';
          advice += `• ${text}\n`;
        });
      }
      advice += '\n';
    }

    // Cross-domain coordination
    if (domainOverlap.length > 0) {
      advice += '**Cross-domain coordination required:**\n';
      domainOverlap.slice(0, 2).forEach(overlap => {
        advice += `• ${overlap.domain}: ${overlap.recommendations[0] || 'Specialist consultation recommended'}\n`;
      });
      advice += '\n';
    }

    // Risk warnings
    if (crossDomainRisks.length > 0) {
      advice += '**Important considerations:**\n';
      crossDomainRisks.slice(0, 3).forEach(risk => {
        advice += `⚠️ ${risk}\n`;
      });
      advice += '\n';
    }

    advice += '**Recommended next steps:**\n';
    advice += '• Engage specialists from each relevant domain for detailed advice\n';
    advice += '• Ensure coordination between different legal areas\n';
    advice += '• Consider prioritizing the most critical domain requirements first\n';

    return advice;
  }

  /**
   * Calculate overall confidence across multiple specialist inputs
   */
  private calculateOverallConfidence(specialistInputs: any[], domainOverlap: any[]): number {
    if (specialistInputs.length === 0) return 0.3;

    const avgSpecialistConfidence = specialistInputs.reduce((sum, input) => sum + input.confidence, 0) / specialistInputs.length;
    const overlapBonus = domainOverlap.reduce((sum, overlap) => sum + overlap.relevanceScore, 0) / domainOverlap.length * 0.2;
    const complexityPenalty = Math.min(0.2, specialistInputs.length * 0.05); // Reduce confidence for complexity

    return Math.max(0.3, Math.min(1.0, avgSpecialistConfidence + overlapBonus - complexityPenalty));
  }

  /**
   * Generate fallback analysis when coordination fails
   */
  private generateFallbackAnalysis(request: DomainCoordinationRequest): CrossDomainAnalysis {
    return {
      primaryDomain: request.primaryDomain,
      secondaryDomains: request.crossDomainRequirements,
      domainOverlap: [],
      crossDomainRisks: ['Professional cross-domain legal review required'],
      coordinatedAdvice: 'This query involves multiple legal domains. Please consult with legal specialists from each relevant area to ensure comprehensive coverage.',
      specialistInputs: [],
      integrationPoints: ['Professional legal coordination required'],
      overallConfidence: 0.4
    };
  }

  /**
   * Get capabilities of the cross-domain coordinator
   */
  getCapabilities(): {
    supportedDomains: string[];
    maxDomains: number;
    coordinationTypes: string[];
  } {
    return {
      supportedDomains: Object.keys(this.domainSpecialists),
      maxDomains: 4,
      coordinationTypes: [
        'domain_overlap_analysis',
        'specialist_coordination',
        'risk_assessment',
        'integrated_recommendations'
      ]
    };
  }
}

// Export singleton instance
export const crossDomainCoordinator = new CrossDomainCoordinator();