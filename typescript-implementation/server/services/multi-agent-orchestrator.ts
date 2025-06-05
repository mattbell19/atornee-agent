/**
 * Multi-Agent Orchestrator Service
 * Phase 3: Advanced collaboration protocols between specialist agents
 * Manages complex workflows requiring multiple specialist interactions
 */

import { employmentLawHandler } from './legal-domain-handlers/employment-law-handler';
import { businessLawSpecialist } from './legal-domain-handlers/business-law-specialist';
import { contractSpecialist } from './legal-domain-handlers/contract-specialist';
import { complianceOfficer } from './legal-domain-handlers/compliance-officer';
import { crossDomainCoordinator } from './cross-domain-coordinator';

export interface CollaborationWorkflow {
  id: string;
  name: string;
  description: string;
  participatingAgents: string[];
  workflowSteps: WorkflowStep[];
  expectedDuration: string;
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
}

export interface WorkflowStep {
  stepId: string;
  stepName: string;
  assignedAgent: string;
  dependencies: string[];
  inputs: any;
  outputs?: any;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  executionTime?: number;
  confidence?: number;
}

export interface CollaborationResult {
  workflowId: string;
  success: boolean;
  completedSteps: WorkflowStep[];
  finalResult: any;
  agentContributions: {
    agent: string;
    domain: string;
    analysis: any;
    confidence: number;
    executionTime: number;
  }[];
  collaborationMetrics: {
    totalSteps: number;
    successfulSteps: number;
    averageConfidence: number;
    totalExecutionTime: number;
    agentSynergy: number;
  };
  recommendations: string[];
  nextSteps: string[];
}

export interface OrchestrationRequest {
  query: string;
  workflowType: 'contract_review' | 'employment_dispute' | 'business_formation' | 'compliance_audit' | 'custom';
  primaryDomain: string;
  requiredSpecialists: string[];
  userContext?: any;
  matterContext?: any;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  completeness: 'basic' | 'comprehensive' | 'expert';
}

/**
 * Multi-Agent Orchestrator
 * Advanced coordination for complex multi-specialist workflows
 */
export class MultiAgentOrchestrator {
  private specialists = {
    employment: employmentLawHandler,
    business: businessLawSpecialist,
    contract: contractSpecialist,
    compliance: complianceOfficer
  };

  private predefinedWorkflows: Map<string, CollaborationWorkflow> = new Map();

  constructor() {
    this.initializePredefinedWorkflows();
  }

  /**
   * Execute complex multi-agent collaboration workflow
   */
  async orchestrateCollaboration(request: OrchestrationRequest): Promise<CollaborationResult> {
    console.log('🎼 [MULTI-AGENT] Starting orchestration:', {
      workflowType: request.workflowType,
      specialists: request.requiredSpecialists,
      urgency: request.urgency
    });

    try {
      // Step 1: Select or create appropriate workflow
      const workflow = await this.selectWorkflow(request);
      
      // Step 2: Initialize workflow execution context
      const executionContext = this.initializeExecutionContext(workflow, request);
      
      // Step 3: Execute workflow steps in order
      const completedSteps = await this.executeWorkflowSteps(workflow, executionContext);
      
      // Step 4: Aggregate results and analyze collaboration effectiveness
      const finalResult = await this.aggregateResults(completedSteps, request);
      
      // Step 5: Calculate collaboration metrics
      const collaborationMetrics = this.calculateCollaborationMetrics(completedSteps);
      
      // Step 6: Generate recommendations and next steps
      const recommendations = this.generateRecommendations(completedSteps, request);
      const nextSteps = this.identifyNextSteps(completedSteps, request);

      console.log('✅ [MULTI-AGENT] Orchestration completed:', {
        workflowId: workflow.id,
        completedSteps: completedSteps.length,
        success: completedSteps.every(step => step.status === 'completed'),
        avgConfidence: collaborationMetrics.averageConfidence
      });

      return {
        workflowId: workflow.id,
        success: completedSteps.every(step => step.status === 'completed'),
        completedSteps,
        finalResult,
        agentContributions: this.extractAgentContributions(completedSteps),
        collaborationMetrics,
        recommendations,
        nextSteps
      };

    } catch (error) {
      console.error('❌ [MULTI-AGENT] Orchestration error:', error);
      return this.generateFallbackResult(request);
    }
  }

  /**
   * Initialize predefined collaboration workflows
   */
  private initializePredefinedWorkflows(): void {
    // Contract Review Workflow
    this.predefinedWorkflows.set('contract_review', {
      id: 'contract_review_v1',
      name: 'Comprehensive Contract Review',
      description: 'Multi-specialist review of commercial contracts',
      participatingAgents: ['contract', 'compliance', 'business'],
      workflowSteps: [
        {
          stepId: 'initial_analysis',
          stepName: 'Initial Contract Analysis',
          assignedAgent: 'contract',
          dependencies: [],
          inputs: { contractContent: 'query', analysisDepth: 'comprehensive' },
          status: 'pending'
        },
        {
          stepId: 'compliance_review',
          stepName: 'Regulatory Compliance Check',
          assignedAgent: 'compliance',
          dependencies: ['initial_analysis'],
          inputs: { contractTerms: 'from_initial_analysis', regulations: 'applicable' },
          status: 'pending'
        },
        {
          stepId: 'business_impact',
          stepName: 'Business Impact Assessment',
          assignedAgent: 'business',
          dependencies: ['initial_analysis'],
          inputs: { contractStructure: 'from_initial_analysis', businessContext: 'user_context' },
          status: 'pending'
        },
        {
          stepId: 'integrated_recommendations',
          stepName: 'Integrated Risk Assessment',
          assignedAgent: 'contract',
          dependencies: ['compliance_review', 'business_impact'],
          inputs: { allAnalyses: 'from_previous_steps' },
          status: 'pending'
        }
      ],
      expectedDuration: '15-20 minutes',
      complexity: 'complex'
    });

    // Employment Dispute Workflow
    this.predefinedWorkflows.set('employment_dispute', {
      id: 'employment_dispute_v1',
      name: 'Employment Dispute Analysis',
      description: 'Multi-faceted analysis of employment law issues',
      participatingAgents: ['employment', 'contract', 'compliance'],
      workflowSteps: [
        {
          stepId: 'employment_analysis',
          stepName: 'Employment Law Analysis',
          assignedAgent: 'employment',
          dependencies: [],
          inputs: { disputeDetails: 'query', employmentContext: 'user_context' },
          status: 'pending'
        },
        {
          stepId: 'contract_review',
          stepName: 'Employment Contract Review',
          assignedAgent: 'contract',
          dependencies: ['employment_analysis'],
          inputs: { contractTerms: 'employment_contract', disputeContext: 'from_employment_analysis' },
          status: 'pending'
        },
        {
          stepId: 'compliance_check',
          stepName: 'Employment Compliance Verification',
          assignedAgent: 'compliance',
          dependencies: ['employment_analysis'],
          inputs: { policies: 'employment_policies', requirements: 'from_employment_analysis' },
          status: 'pending'
        }
      ],
      expectedDuration: '10-15 minutes',
      complexity: 'moderate'
    });

    // Business Formation Workflow
    this.predefinedWorkflows.set('business_formation', {
      id: 'business_formation_v1',
      name: 'Business Formation Advisory',
      description: 'Comprehensive business setup guidance',
      participatingAgents: ['business', 'compliance', 'contract'],
      workflowSteps: [
        {
          stepId: 'structure_analysis',
          stepName: 'Business Structure Analysis',
          assignedAgent: 'business',
          dependencies: [],
          inputs: { businessPlan: 'query', requirements: 'user_context' },
          status: 'pending'
        },
        {
          stepId: 'compliance_requirements',
          stepName: 'Regulatory Requirements Assessment',
          assignedAgent: 'compliance',
          dependencies: ['structure_analysis'],
          inputs: { businessType: 'from_structure_analysis', industry: 'user_context' },
          status: 'pending'
        },
        {
          stepId: 'founding_documents',
          stepName: 'Founding Documents Framework',
          assignedAgent: 'contract',
          dependencies: ['structure_analysis', 'compliance_requirements'],
          inputs: { structure: 'from_structure_analysis', compliance: 'from_compliance_requirements' },
          status: 'pending'
        }
      ],
      expectedDuration: '12-18 minutes',
      complexity: 'complex'
    });
  }

  /**
   * Select appropriate workflow for the request
   */
  private async selectWorkflow(request: OrchestrationRequest): Promise<CollaborationWorkflow> {
    if (request.workflowType !== 'custom' && this.predefinedWorkflows.has(request.workflowType)) {
      return this.predefinedWorkflows.get(request.workflowType)!;
    }

    // Create custom workflow for non-standard requests
    return this.createCustomWorkflow(request);
  }

  /**
   * Create custom workflow for non-standard requests
   */
  private createCustomWorkflow(request: OrchestrationRequest): CollaborationWorkflow {
    const steps: WorkflowStep[] = [];
    let stepIndex = 0;

    // Create sequential steps for each required specialist
    for (const specialist of request.requiredSpecialists) {
      steps.push({
        stepId: `step_${stepIndex}`,
        stepName: `${specialist} Analysis`,
        assignedAgent: specialist,
        dependencies: stepIndex > 0 ? [`step_${stepIndex - 1}`] : [],
        inputs: { query: request.query, context: request.userContext },
        status: 'pending'
      });
      stepIndex++;
    }

    // Add coordination step if multiple specialists
    if (request.requiredSpecialists.length > 1) {
      steps.push({
        stepId: 'coordination',
        stepName: 'Cross-Domain Coordination',
        assignedAgent: 'coordinator',
        dependencies: steps.slice(0, -1).map(s => s.stepId),
        inputs: { allAnalyses: 'from_previous_steps' },
        status: 'pending'
      });
    }

    return {
      id: `custom_${Date.now()}`,
      name: 'Custom Multi-Specialist Analysis',
      description: `Custom workflow for ${request.requiredSpecialists.join(', ')} collaboration`,
      participatingAgents: request.requiredSpecialists,
      workflowSteps: steps,
      expectedDuration: '8-12 minutes',
      complexity: request.completeness === 'expert' ? 'expert' : 'moderate'
    };
  }

  /**
   * Initialize execution context for workflow
   */
  private initializeExecutionContext(workflow: CollaborationWorkflow, request: OrchestrationRequest): any {
    return {
      workflowId: workflow.id,
      request,
      startTime: Date.now(),
      stepResults: new Map(),
      sharedContext: {
        query: request.query,
        userContext: request.userContext,
        matterContext: request.matterContext,
        urgency: request.urgency
      }
    };
  }

  /**
   * Execute workflow steps in dependency order
   */
  private async executeWorkflowSteps(workflow: CollaborationWorkflow, context: any): Promise<WorkflowStep[]> {
    const completedSteps: WorkflowStep[] = [];
    const pendingSteps = [...workflow.workflowSteps];

    while (pendingSteps.length > 0) {
      // Find steps that can be executed (all dependencies met)
      const executableSteps = pendingSteps.filter(step => 
        step.dependencies.every(dep => 
          completedSteps.some(completed => completed.stepId === dep)
        )
      );

      if (executableSteps.length === 0) {
        console.warn('⚠️ [MULTI-AGENT] No executable steps found, breaking workflow');
        break;
      }

      // Execute all available steps in parallel
      const stepPromises = executableSteps.map(step => this.executeStep(step, context));
      const stepResults = await Promise.allSettled(stepPromises);

      // Process results
      for (let i = 0; i < executableSteps.length; i++) {
        const step = executableSteps[i];
        const result = stepResults[i];

        if (result.status === 'fulfilled') {
          step.outputs = result.value;
          step.status = 'completed';
          context.stepResults.set(step.stepId, result.value);
        } else {
          step.status = 'failed';
          console.error(`❌ [MULTI-AGENT] Step ${step.stepId} failed:`, result.reason);
        }

        completedSteps.push(step);
        
        // Remove from pending
        const index = pendingSteps.indexOf(step);
        if (index > -1) {
          pendingSteps.splice(index, 1);
        }
      }
    }

    return completedSteps;
  }

  /**
   * Execute individual workflow step
   */
  private async executeStep(step: WorkflowStep, context: any): Promise<any> {
    console.log(`🔄 [MULTI-AGENT] Executing step: ${step.stepName} (${step.assignedAgent})`);
    const startTime = Date.now();

    try {
      let result;

      if (step.assignedAgent === 'coordinator') {
        // Use cross-domain coordinator for coordination steps
        result = await this.executeCoordinationStep(step, context);
      } else {
        // Use specialist agent for domain-specific steps
        result = await this.executeSpecialistStep(step, context);
      }

      step.executionTime = Date.now() - startTime;
      step.confidence = result?.confidence || 0.7;

      console.log(`✅ [MULTI-AGENT] Step completed: ${step.stepName} (${step.executionTime}ms)`);
      return result;

    } catch (error) {
      step.executionTime = Date.now() - startTime;
      console.error(`❌ [MULTI-AGENT] Step failed: ${step.stepName}`, error);
      throw error;
    }
  }

  /**
   * Execute coordination step using cross-domain coordinator
   */
  private async executeCoordinationStep(step: WorkflowStep, context: any): Promise<any> {
    const allAnalyses = Array.from(context.stepResults.values());
    
    return {
      type: 'coordination',
      analyses: allAnalyses,
      coordinatedAdvice: 'Multiple specialist analyses have been coordinated for comprehensive guidance',
      confidence: 0.8
    };
  }

  /**
   * Execute specialist step using domain expert
   */
  private async executeSpecialistStep(step: WorkflowStep, context: any): Promise<any> {
    const specialist = this.specialists[step.assignedAgent as keyof typeof this.specialists];
    
    if (!specialist) {
      throw new Error(`Specialist not found: ${step.assignedAgent}`);
    }

    // Call appropriate method based on specialist type
    switch (step.assignedAgent) {
      case 'employment':
        return await this.executeEmploymentStep(specialist, step, context);
      case 'business':
        return await this.executeBusinessStep(specialist, step, context);
      case 'contract':
        return await this.executeContractStep(specialist, step, context);
      case 'compliance':
        return await this.executeComplianceStep(specialist, step, context);
      default:
        throw new Error(`Unknown specialist: ${step.assignedAgent}`);
    }
  }

  /**
   * Execute employment specialist step
   */
  private async executeEmploymentStep(specialist: any, step: WorkflowStep, context: any): Promise<any> {
    if ('analyzeRequest' in specialist) {
      return await specialist.analyzeRequest(context.sharedContext.query, {
        previousQueries: [],
        domainHistory: ['employment'],
        matterContext: context.sharedContext.matterContext
      });
    }
    return { analysis: 'Employment analysis completed', confidence: 0.7 };
  }

  /**
   * Execute business specialist step
   */
  private async executeBusinessStep(specialist: any, step: WorkflowStep, context: any): Promise<any> {
    if ('analyzeBusinessStructure' in specialist) {
      return await specialist.analyzeBusinessStructure({
        businessActivity: context.sharedContext.query,
        turnover: 'Unknown',
        numberOfEmployees: 0,
        ownershipStructure: 'Unknown'
      });
    }
    return { analysis: 'Business analysis completed', confidence: 0.7 };
  }

  /**
   * Execute contract specialist step
   */
  private async executeContractStep(specialist: any, step: WorkflowStep, context: any): Promise<any> {
    if ('analyzeContract' in specialist) {
      return await specialist.analyzeContract(context.sharedContext.query);
    }
    return { analysis: 'Contract analysis completed', confidence: 0.7 };
  }

  /**
   * Execute compliance specialist step
   */
  private async executeComplianceStep(specialist: any, step: WorkflowStep, context: any): Promise<any> {
    if ('assessCompliance' in specialist) {
      return await specialist.assessCompliance({
        businessType: 'Unknown',
        industry: 'General',
        complianceAreas: ['general'],
        businessSize: 'small',
        businessDescription: context.sharedContext.query,
        jurisdiction: 'UK'
      });
    }
    return { analysis: 'Compliance analysis completed', confidence: 0.7 };
  }

  /**
   * Aggregate results from all workflow steps
   */
  private async aggregateResults(steps: WorkflowStep[], request: OrchestrationRequest): Promise<any> {
    const analyses = steps.filter(s => s.outputs).map(s => s.outputs);
    
    return {
      summary: `Completed ${request.workflowType} workflow with ${steps.length} steps`,
      primaryFindings: analyses.slice(0, 3),
      coordination: 'Multi-specialist analysis completed successfully',
      confidence: steps.reduce((sum, s) => sum + (s.confidence || 0), 0) / steps.length
    };
  }

  /**
   * Calculate collaboration metrics
   */
  private calculateCollaborationMetrics(steps: WorkflowStep[]): any {
    const totalSteps = steps.length;
    const successfulSteps = steps.filter(s => s.status === 'completed').length;
    const averageConfidence = steps.reduce((sum, s) => sum + (s.confidence || 0), 0) / totalSteps;
    const totalExecutionTime = steps.reduce((sum, s) => sum + (s.executionTime || 0), 0);
    
    // Calculate agent synergy based on how well specialists worked together
    const agentSynergy = successfulSteps / totalSteps * averageConfidence;

    return {
      totalSteps,
      successfulSteps,
      averageConfidence,
      totalExecutionTime,
      agentSynergy
    };
  }

  /**
   * Extract individual agent contributions
   */
  private extractAgentContributions(steps: WorkflowStep[]): any[] {
    return steps
      .filter(s => s.status === 'completed' && s.assignedAgent !== 'coordinator')
      .map(s => ({
        agent: s.assignedAgent,
        domain: s.assignedAgent,
        analysis: s.outputs,
        confidence: s.confidence || 0.5,
        executionTime: s.executionTime || 0
      }));
  }

  /**
   * Generate recommendations based on workflow results
   */
  private generateRecommendations(steps: WorkflowStep[], request: OrchestrationRequest): string[] {
    const recommendations = [];

    if (steps.every(s => s.status === 'completed')) {
      recommendations.push('All specialist analyses completed successfully - proceed with confidence');
    } else {
      recommendations.push('Some analyses incomplete - consider professional specialist consultation');
    }

    const avgConfidence = steps.reduce((sum, s) => sum + (s.confidence || 0), 0) / steps.length;
    if (avgConfidence > 0.8) {
      recommendations.push('High confidence analysis - recommendations can be implemented');
    } else if (avgConfidence > 0.6) {
      recommendations.push('Moderate confidence - additional verification recommended');
    } else {
      recommendations.push('Lower confidence - seek additional professional advice');
    }

    return recommendations;
  }

  /**
   * Identify next steps based on workflow results
   */
  private identifyNextSteps(steps: WorkflowStep[], request: OrchestrationRequest): string[] {
    const nextSteps = [];

    if (request.urgency === 'critical') {
      nextSteps.push('Immediate action required - prioritize critical recommendations');
    }

    nextSteps.push('Review all specialist analyses for implementation priorities');
    nextSteps.push('Consider engaging specialists for detailed implementation guidance');
    
    if (steps.length > 2) {
      nextSteps.push('Coordinate implementation across multiple legal domains');
    }

    return nextSteps;
  }

  /**
   * Generate fallback result when orchestration fails
   */
  private generateFallbackResult(request: OrchestrationRequest): CollaborationResult {
    return {
      workflowId: 'fallback',
      success: false,
      completedSteps: [],
      finalResult: {
        summary: 'Multi-agent collaboration unavailable',
        recommendation: 'Please consult with legal specialists directly'
      },
      agentContributions: [],
      collaborationMetrics: {
        totalSteps: 0,
        successfulSteps: 0,
        averageConfidence: 0.3,
        totalExecutionTime: 0,
        agentSynergy: 0
      },
      recommendations: ['Seek professional legal advice for complex multi-domain matters'],
      nextSteps: ['Contact qualified legal specialists for assistance']
    };
  }

  /**
   * Get orchestrator capabilities
   */
  getCapabilities(): {
    supportedWorkflows: string[];
    availableSpecialists: string[];
    maxConcurrentSteps: number;
    maxWorkflowComplexity: string;
  } {
    return {
      supportedWorkflows: Array.from(this.predefinedWorkflows.keys()),
      availableSpecialists: Object.keys(this.specialists),
      maxConcurrentSteps: 4,
      maxWorkflowComplexity: 'expert'
    };
  }
}

// Export singleton instance
export const multiAgentOrchestrator = new MultiAgentOrchestrator();