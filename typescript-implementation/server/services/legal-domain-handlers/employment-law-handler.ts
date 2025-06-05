import { ConversationMemory } from '../advanced-memory-service';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { chatBetaRAGService } from '../chat-beta-rag-service';

// Employment law specific interfaces
export interface EmploymentIssue {
  type: 'dismissal' | 'discrimination' | 'contract_dispute' | 'wage_dispute' | 'harassment' | 'redundancy' | 'grievance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  urgency: 'low' | 'medium' | 'high' | 'immediate';
  description: string;
  legalBasis: string[];
  requiredEvidence: string[];
  timeConstraints?: string;
}

export interface EmploymentAnalysisResult {
  issues: EmploymentIssue[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
  requiredInfo: InformationRequirement[];
  suggestedActions: ActionRecommendation[];
  legalReferences: LegalReference[];
  documentNeeds: DocumentRequirement[];
}

export interface InformationRequirement {
  id: string;
  category: 'employment_details' | 'incident_details' | 'evidence' | 'timeline' | 'personal_details';
  question: string;
  type: 'text' | 'date' | 'select' | 'multiselect' | 'number' | 'file';
  options?: string[];
  required: boolean;
  priority: 'critical' | 'important' | 'optional';
  legalBasis: string;
  helpText?: string;
}

export interface ActionRecommendation {
  action: string;
  priority: 'immediate' | 'urgent' | 'important' | 'optional';
  timeframe: string;
  description: string;
  legalBasis: string;
  consequences?: string;
}

export interface LegalReference {
  statute: string;
  section: string;
  description: string;
  relevance: string;
  url?: string;
}

export interface DocumentRequirement {
  type: string;
  title: string;
  description: string;
  urgency: 'immediate' | 'urgent' | 'normal';
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedTime: string;
}

/**
 * Employment Law Handler - Specialized handler for UK employment law matters
 * Phase 3: Enhanced specialist agent with AI-powered analysis
 */
export class EmploymentLawHandler {
  domain = 'employment';
  private model: ChatAnthropic;
  private expertise = {
    specializations: [
      'unfair_dismissal',
      'employment_contracts', 
      'workplace_discrimination',
      'wage_hour_compliance',
      'disciplinary_procedures',
      'redundancy_processes',
      'workplace_harassment',
      'employee_rights',
      'employer_obligations',
      'tribunal_procedures'
    ],
    knowledgeBase: [
      'Employment Rights Act 1996',
      'Equality Act 2010', 
      'Working Time Regulations 1998',
      'ACAS Codes of Practice',
      'Health and Safety at Work Act 1974',
      'Data Protection Act 2018 (employment)',
      'National Minimum Wage Regulations'
    ]
  };

  constructor() {
    // Use Claude Sonnet for employment law expertise
    this.model = new ChatAnthropic({
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      modelName: 'claude-3-5-sonnet-20241022',
      temperature: 0.1,
      maxTokens: 8192
    });
  }

  /**
   * Analyze employment-related request
   */
  async analyzeRequest(message: string, context: ConversationMemory): Promise<EmploymentAnalysisResult> {
    const employmentIssues = await this.identifyEmploymentIssues(message);
    const urgency = this.assessOverallUrgency(employmentIssues);
    const requiredInfo = await this.getRequiredInformation(employmentIssues, context);
    const suggestedActions = await this.getSuggestedActions(employmentIssues);
    const legalReferences = await this.getLegalReferences(employmentIssues);
    const documentNeeds = await this.getDocumentRequirements(employmentIssues);

    return {
      issues: employmentIssues,
      urgency,
      requiredInfo,
      suggestedActions,
      legalReferences,
      documentNeeds
    };
  }

  /**
   * Generate consultation questions for employment matters
   */
  async generateQuestions(issues: EmploymentIssue[], context: ConversationMemory): Promise<InformationRequirement[]> {
    const questions: InformationRequirement[] = [];

    for (const issue of issues) {
      switch (issue.type) {
        case 'dismissal':
          questions.push(...this.getDismissalQuestions(issue));
          break;
        case 'discrimination':
          questions.push(...this.getDiscriminationQuestions(issue));
          break;
        case 'contract_dispute':
          questions.push(...this.getContractDisputeQuestions(issue));
          break;
        case 'wage_dispute':
          questions.push(...this.getWageDisputeQuestions(issue));
          break;
        case 'harassment':
          questions.push(...this.getHarassmentQuestions(issue));
          break;
        case 'redundancy':
          questions.push(...this.getRedundancyQuestions(issue));
          break;
        case 'grievance':
          questions.push(...this.getGrievanceQuestions(issue));
          break;
      }
    }

    return this.prioritizeQuestions(questions);
  }

  /**
   * Identify employment issues from message
   */
  private async identifyEmploymentIssues(message: string): Promise<EmploymentIssue[]> {
    const issues: EmploymentIssue[] = [];
    const lowerMessage = message.toLowerCase();

    // Dismissal/Termination issues
    if (lowerMessage.includes('fired') || lowerMessage.includes('dismissed') || lowerMessage.includes('terminated') || lowerMessage.includes('sacked')) {
      issues.push({
        type: 'dismissal',
        severity: 'high',
        urgency: 'high',
        description: 'Potential unfair dismissal claim',
        legalBasis: ['Employment Rights Act 1996, Section 94-98'],
        requiredEvidence: ['Dismissal letter', 'Employment contract', 'Witness statements'],
        timeConstraints: '3 months from dismissal date'
      });
    }

    // Discrimination issues
    if (lowerMessage.includes('discrimination') || lowerMessage.includes('discriminated') || 
        lowerMessage.includes('race') || lowerMessage.includes('gender') || lowerMessage.includes('age') ||
        lowerMessage.includes('disability') || lowerMessage.includes('religion') || lowerMessage.includes('sexual orientation')) {
      issues.push({
        type: 'discrimination',
        severity: 'high',
        urgency: 'high',
        description: 'Potential discrimination claim',
        legalBasis: ['Equality Act 2010'],
        requiredEvidence: ['Incident records', 'Witness statements', 'Email communications'],
        timeConstraints: '3 months from incident date'
      });
    }

    // Contract disputes
    if (lowerMessage.includes('contract') || lowerMessage.includes('terms') || lowerMessage.includes('conditions')) {
      issues.push({
        type: 'contract_dispute',
        severity: 'medium',
        urgency: 'medium',
        description: 'Employment contract dispute',
        legalBasis: ['Employment Rights Act 1996', 'Contract law principles'],
        requiredEvidence: ['Employment contract', 'Job description', 'Communications']
      });
    }

    // Wage/Payment issues
    if (lowerMessage.includes('pay') || lowerMessage.includes('wage') || lowerMessage.includes('salary') || 
        lowerMessage.includes('overtime') || lowerMessage.includes('holiday pay')) {
      issues.push({
        type: 'wage_dispute',
        severity: 'medium',
        urgency: 'medium',
        description: 'Wage or payment dispute',
        legalBasis: ['Employment Rights Act 1996, Part II', 'National Minimum Wage Act 1998'],
        requiredEvidence: ['Pay slips', 'Employment contract', 'Time records']
      });
    }

    // Harassment issues
    if (lowerMessage.includes('harassment') || lowerMessage.includes('bullying') || lowerMessage.includes('hostile')) {
      issues.push({
        type: 'harassment',
        severity: 'high',
        urgency: 'high',
        description: 'Workplace harassment',
        legalBasis: ['Equality Act 2010', 'Health and Safety at Work Act 1974'],
        requiredEvidence: ['Incident logs', 'Witness statements', 'Medical records if applicable'],
        timeConstraints: '3 months from last incident'
      });
    }

    // Redundancy issues
    if (lowerMessage.includes('redundancy') || lowerMessage.includes('redundant') || lowerMessage.includes('layoff')) {
      issues.push({
        type: 'redundancy',
        severity: 'medium',
        urgency: 'medium',
        description: 'Redundancy process concerns',
        legalBasis: ['Employment Rights Act 1996, Part XI'],
        requiredEvidence: ['Redundancy notice', 'Consultation records', 'Selection criteria']
      });
    }

    return issues;
  }

  /**
   * Get dismissal-specific questions
   */
  private getDismissalQuestions(issue: EmploymentIssue): InformationRequirement[] {
    return [
      {
        id: 'dismissal_date',
        category: 'incident_details',
        question: 'When were you dismissed? (Please provide the exact date)',
        type: 'date',
        required: true,
        priority: 'critical',
        legalBasis: 'Employment Rights Act 1996, Section 111 - 3 month time limit',
        helpText: 'This is crucial for determining if you can still bring a claim'
      },
      {
        id: 'dismissal_reason',
        category: 'incident_details',
        question: 'What reason was given for your dismissal?',
        type: 'select',
        options: [
          'Redundancy',
          'Misconduct',
          'Poor performance/capability',
          'Some other substantial reason',
          'No reason given',
          'Breach of contract',
          'End of fixed-term contract'
        ],
        required: true,
        priority: 'critical',
        legalBasis: 'Employment Rights Act 1996, Section 98'
      },
      {
        id: 'notice_period',
        category: 'employment_details',
        question: 'How much notice were you given?',
        type: 'select',
        options: [
          'No notice',
          'Less than statutory minimum',
          'Statutory minimum notice',
          'Contractual notice period',
          'Payment in lieu of notice'
        ],
        required: true,
        priority: 'critical',
        legalBasis: 'Employment Rights Act 1996, Section 86'
      },
      {
        id: 'employment_length',
        category: 'employment_details',
        question: 'How long had you been employed?',
        type: 'select',
        options: [
          'Less than 2 years',
          '2 years or more',
          'Not sure'
        ],
        required: true,
        priority: 'critical',
        legalBasis: 'Employment Rights Act 1996, Section 108 - Qualifying period for unfair dismissal',
        helpText: '2 years continuous service is usually required for unfair dismissal claims'
      },
      {
        id: 'disciplinary_process',
        category: 'incident_details',
        question: 'Was there a disciplinary process before dismissal?',
        type: 'select',
        options: [
          'Yes, full process followed',
          'Yes, but process was flawed',
          'No process at all',
          'Summary dismissal for gross misconduct'
        ],
        required: true,
        priority: 'important',
        legalBasis: 'ACAS Code of Practice on Disciplinary and Grievance Procedures'
      }
    ];
  }

  /**
   * Get discrimination-specific questions
   */
  private getDiscriminationQuestions(issue: EmploymentIssue): InformationRequirement[] {
    return [
      {
        id: 'discrimination_type',
        category: 'incident_details',
        question: 'What type of discrimination do you believe occurred?',
        type: 'multiselect',
        options: [
          'Age discrimination',
          'Disability discrimination',
          'Gender discrimination',
          'Race discrimination',
          'Religion/belief discrimination',
          'Sexual orientation discrimination',
          'Pregnancy/maternity discrimination',
          'Gender reassignment discrimination',
          'Marriage/civil partnership discrimination'
        ],
        required: true,
        priority: 'critical',
        legalBasis: 'Equality Act 2010, Section 4 - Protected characteristics'
      },
      {
        id: 'discrimination_incidents',
        category: 'incident_details',
        question: 'Please describe the discriminatory incidents (dates, witnesses, what happened)',
        type: 'text',
        required: true,
        priority: 'critical',
        legalBasis: 'Equality Act 2010 - Evidence requirements'
      },
      {
        id: 'comparator',
        category: 'incident_details',
        question: 'Can you identify someone who was treated more favorably in similar circumstances?',
        type: 'text',
        required: false,
        priority: 'important',
        legalBasis: 'Equality Act 2010, Section 23 - Comparison by reference to circumstances',
        helpText: 'This helps establish less favorable treatment'
      }
    ];
  }

  /**
   * Get contract dispute questions
   */
  private getContractDisputeQuestions(issue: EmploymentIssue): InformationRequirement[] {
    return [
      {
        id: 'contract_issue',
        category: 'employment_details',
        question: 'What specific contract issue are you facing?',
        type: 'select',
        options: [
          'Changes to terms and conditions',
          'Breach of contract by employer',
          'Unclear contract terms',
          'Missing written contract',
          'Dispute over job role/duties',
          'Working time issues'
        ],
        required: true,
        priority: 'critical',
        legalBasis: 'Employment Rights Act 1996, Section 1 - Statement of terms'
      },
      {
        id: 'contract_changes',
        category: 'incident_details',
        question: 'Have there been any recent changes to your contract or working conditions?',
        type: 'text',
        required: false,
        priority: 'important',
        legalBasis: 'Contract law - Variation of terms'
      }
    ];
  }

  /**
   * Get wage dispute questions
   */
  private getWageDisputeQuestions(issue: EmploymentIssue): InformationRequirement[] {
    return [
      {
        id: 'wage_issue_type',
        category: 'employment_details',
        question: 'What type of payment issue are you experiencing?',
        type: 'multiselect',
        options: [
          'Unpaid wages',
          'Below minimum wage',
          'Unpaid overtime',
          'Holiday pay not paid',
          'Sick pay issues',
          'Commission/bonus disputes',
          'Deductions from pay'
        ],
        required: true,
        priority: 'critical',
        legalBasis: 'Employment Rights Act 1996, Part II'
      }
    ];
  }

  /**
   * Get harassment questions
   */
  private getHarassmentQuestions(issue: EmploymentIssue): InformationRequirement[] {
    return [
      {
        id: 'harassment_type',
        category: 'incident_details',
        question: 'What type of harassment are you experiencing?',
        type: 'multiselect',
        options: [
          'Sexual harassment',
          'Bullying by manager',
          'Bullying by colleagues',
          'Harassment related to protected characteristic',
          'Verbal abuse',
          'Physical intimidation',
          'Exclusion/isolation'
        ],
        required: true,
        priority: 'critical',
        legalBasis: 'Equality Act 2010, Section 26'
      }
    ];
  }

  /**
   * Get redundancy questions
   */
  private getRedundancyQuestions(issue: EmploymentIssue): InformationRequirement[] {
    return [
      {
        id: 'redundancy_consultation',
        category: 'incident_details',
        question: 'Has there been proper consultation about the redundancy?',
        type: 'select',
        options: [
          'Yes, individual consultation',
          'Yes, collective consultation',
          'No consultation',
          'Inadequate consultation'
        ],
        required: true,
        priority: 'critical',
        legalBasis: 'Employment Rights Act 1996, Section 188'
      }
    ];
  }

  /**
   * Get grievance questions
   */
  private getGrievanceQuestions(issue: EmploymentIssue): InformationRequirement[] {
    return [
      {
        id: 'grievance_raised',
        category: 'incident_details',
        question: 'Have you raised a formal grievance with your employer?',
        type: 'select',
        options: [
          'Yes, grievance submitted',
          'Yes, grievance meeting held',
          'Yes, grievance appeal submitted',
          'No, not yet raised',
          'Informal complaint only'
        ],
        required: true,
        priority: 'critical',
        legalBasis: 'ACAS Code of Practice on Disciplinary and Grievance Procedures'
      }
    ];
  }

  /**
   * Assess overall urgency
   */
  private assessOverallUrgency(issues: EmploymentIssue[]): 'low' | 'medium' | 'high' | 'critical' {
    if (issues.some(issue => issue.urgency === 'immediate')) return 'critical';
    if (issues.some(issue => issue.urgency === 'high')) return 'high';
    if (issues.some(issue => issue.urgency === 'medium')) return 'medium';
    return 'low';
  }

  /**
   * Get required information based on issues
   */
  private async getRequiredInformation(issues: EmploymentIssue[], context: ConversationMemory): Promise<InformationRequirement[]> {
    const allQuestions: InformationRequirement[] = [];
    
    for (const issue of issues) {
      const questions = await this.generateQuestions([issue], context);
      allQuestions.push(...questions);
    }
    
    return this.prioritizeQuestions(allQuestions);
  }

  /**
   * Get suggested actions
   */
  private async getSuggestedActions(issues: EmploymentIssue[]): Promise<ActionRecommendation[]> {
    const actions: ActionRecommendation[] = [];
    
    for (const issue of issues) {
      if (issue.type === 'dismissal') {
        actions.push({
          action: 'File ACAS Early Conciliation',
          priority: 'immediate',
          timeframe: 'Within 3 months of dismissal',
          description: 'Start ACAS early conciliation process before tribunal claim',
          legalBasis: 'Employment Tribunals Act 1996, Section 18A'
        });
      }
      
      if (issue.type === 'discrimination') {
        actions.push({
          action: 'Document all incidents',
          priority: 'urgent',
          timeframe: 'Immediately',
          description: 'Keep detailed records of all discriminatory incidents',
          legalBasis: 'Evidence requirements for tribunal claims'
        });
      }
    }
    
    return actions;
  }

  /**
   * Get legal references
   */
  private async getLegalReferences(issues: EmploymentIssue[]): Promise<LegalReference[]> {
    const references: LegalReference[] = [];
    
    for (const issue of issues) {
      references.push(...issue.legalBasis.map(basis => ({
        statute: basis.split(',')[0],
        section: basis.includes(',') ? basis.split(',')[1].trim() : '',
        description: `Relevant to ${issue.type} claims`,
        relevance: issue.description
      })));
    }
    
    return references;
  }

  /**
   * Get document requirements
   */
  private async getDocumentRequirements(issues: EmploymentIssue[]): Promise<DocumentRequirement[]> {
    const documents: DocumentRequirement[] = [];
    
    if (issues.some(i => i.type === 'dismissal')) {
      documents.push({
        type: 'et1_form',
        title: 'Employment Tribunal Claim (ET1)',
        description: 'Formal tribunal claim form for unfair dismissal',
        urgency: 'urgent',
        complexity: 'complex',
        estimatedTime: '2-3 hours'
      });
    }
    
    if (issues.some(i => i.type === 'grievance')) {
      documents.push({
        type: 'grievance_letter',
        title: 'Formal Grievance Letter',
        description: 'Letter to raise formal grievance with employer',
        urgency: 'urgent',
        complexity: 'moderate',
        estimatedTime: '30-45 minutes'
      });
    }
    
    return documents;
  }

  /**
   * Prioritize questions by importance
   */
  private prioritizeQuestions(questions: InformationRequirement[]): InformationRequirement[] {
    return questions.sort((a, b) => {
      const priorityOrder = { critical: 0, important: 1, optional: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
}

export const employmentLawHandler = new EmploymentLawHandler();
