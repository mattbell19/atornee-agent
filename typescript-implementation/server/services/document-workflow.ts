/**
 * Advanced Document Workflow with Version Control
 * Phase 2: Enhanced Intelligence - Document lifecycle management
 */

import { z } from 'zod';
import { storage } from '../storage';

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: string;
  content: string;
  changes: DocumentChange[];
  author: string;
  timestamp: Date;
  metadata: DocumentVersionMetadata;
  status: 'draft' | 'review' | 'approved' | 'published' | 'archived';
  parentVersion?: string;
  branchName?: string;
}

export interface DocumentChange {
  type: 'addition' | 'deletion' | 'modification' | 'formatting' | 'structure';
  section: string;
  description: string;
  oldContent?: string;
  newContent?: string;
  reasoning?: string;
  confidence: number;
}

export interface DocumentVersionMetadata {
  wordCount: number;
  sections: string[];
  legalComplexity: 'simple' | 'moderate' | 'complex' | 'expert';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  completeness: number; // 0-1 scale
  aiGenerated: boolean;
  reviewRequired: boolean;
  complianceChecks: ComplianceCheck[];
}

export interface ComplianceCheck {
  type: 'legal_requirement' | 'best_practice' | 'formatting' | 'content_quality';
  description: string;
  status: 'passed' | 'failed' | 'warning' | 'not_applicable';
  details?: string;
  references?: string[];
}

export interface DocumentWorkflowAction {
  type: 'create' | 'edit' | 'review' | 'approve' | 'publish' | 'archive' | 'restore';
  description: string;
  automated: boolean;
  requiredRole?: string;
  conditions?: WorkflowCondition[];
}

export interface WorkflowCondition {
  type: 'approval_required' | 'review_completed' | 'compliance_passed' | 'time_elapsed';
  value?: any;
  description: string;
}

/**
 * Advanced Document Workflow Service
 */
export class DocumentWorkflowService {
  private documentVersions: Map<string, DocumentVersion[]> = new Map();
  private workflowRules: Map<string, DocumentWorkflowAction[]> = new Map();
  private isInitialized = false;

  constructor() {
    this.initializeWorkflowRules();
  }

  /**
   * Initialize workflow rules
   */
  private initializeWorkflowRules(): void {
    // Standard legal document workflow
    const standardWorkflow: DocumentWorkflowAction[] = [
      {
        type: 'create',
        description: 'Create initial document draft',
        automated: true,
        conditions: []
      },
      {
        type: 'review',
        description: 'AI-powered compliance and quality review',
        automated: true,
        conditions: [
          {
            type: 'compliance_passed',
            description: 'Document must pass automated compliance checks'
          }
        ]
      },
      {
        type: 'approve',
        description: 'Human approval for publication',
        automated: false,
        requiredRole: 'legal_reviewer',
        conditions: [
          {
            type: 'review_completed',
            description: 'All reviews must be completed'
          }
        ]
      },
      {
        type: 'publish',
        description: 'Publish approved document',
        automated: true,
        conditions: [
          {
            type: 'approval_required',
            value: true,
            description: 'Document must be approved before publishing'
          }
        ]
      }
    ];

    this.workflowRules.set('standard', standardWorkflow);
    this.workflowRules.set('contract', standardWorkflow);
    this.workflowRules.set('agreement', standardWorkflow);
    
    // Simple workflow for basic documents
    const simpleWorkflow: DocumentWorkflowAction[] = [
      {
        type: 'create',
        description: 'Create document',
        automated: true,
        conditions: []
      },
      {
        type: 'publish',
        description: 'Auto-publish simple document',
        automated: true,
        conditions: []
      }
    ];

    this.workflowRules.set('letter', simpleWorkflow);
    this.workflowRules.set('simple', simpleWorkflow);

    this.isInitialized = true;
    console.log('📋 [DOCUMENT-WORKFLOW] Initialized with workflow rules');
  }

  /**
   * Create a new document version
   */
  async createDocumentVersion(
    documentId: string,
    content: string,
    author: string,
    changes: DocumentChange[] = [],
    parentVersion?: string
  ): Promise<DocumentVersion> {
    console.log('📄 [DOCUMENT-WORKFLOW] Creating new document version:', documentId);

    const existingVersions = this.documentVersions.get(documentId) || [];
    const newVersionNumber = this.generateVersionNumber(existingVersions, parentVersion);

    // Analyze document content
    const metadata = await this.analyzeDocumentContent(content);

    const newVersion: DocumentVersion = {
      id: `${documentId}_v${newVersionNumber}`,
      documentId,
      version: newVersionNumber,
      content,
      changes,
      author,
      timestamp: new Date(),
      metadata,
      status: 'draft',
      parentVersion,
      branchName: parentVersion ? 'main' : undefined
    };

    // Run initial compliance checks
    newVersion.metadata.complianceChecks = await this.runComplianceChecks(content, metadata);

    // Store version
    existingVersions.push(newVersion);
    this.documentVersions.set(documentId, existingVersions);

    // Trigger workflow
    await this.triggerWorkflow(newVersion);

    console.log('✅ [DOCUMENT-WORKFLOW] Created version:', newVersion.version);
    return newVersion;
  }

  /**
   * Modify existing document and create new version
   */
  async modifyDocument(
    documentId: string,
    modifications: Array<{
      section: string;
      oldContent: string;
      newContent: string;
      reasoning?: string;
    }>,
    author: string
  ): Promise<DocumentVersion> {
    console.log('✏️ [DOCUMENT-WORKFLOW] Modifying document:', documentId);

    const versions = this.documentVersions.get(documentId);
    if (!versions || versions.length === 0) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Get latest version
    const latestVersion = this.getLatestVersion(versions);
    let modifiedContent = latestVersion.content;

    // Apply modifications
    const changes: DocumentChange[] = [];
    for (const mod of modifications) {
      // Apply the modification
      modifiedContent = modifiedContent.replace(mod.oldContent, mod.newContent);
      
      changes.push({
        type: 'modification',
        section: mod.section,
        description: `Modified ${mod.section}`,
        oldContent: mod.oldContent,
        newContent: mod.newContent,
        reasoning: mod.reasoning,
        confidence: 0.9
      });
    }

    // Create new version with modifications
    return await this.createDocumentVersion(
      documentId,
      modifiedContent,
      author,
      changes,
      latestVersion.version
    );
  }

  /**
   * Get document version history
   */
  getVersionHistory(documentId: string): DocumentVersion[] {
    const versions = this.documentVersions.get(documentId) || [];
    return versions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get latest version of document
   */
  getLatestVersion(versions: DocumentVersion[]): DocumentVersion {
    return versions.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );
  }

  /**
   * Compare two document versions
   */
  compareVersions(version1: DocumentVersion, version2: DocumentVersion): {
    differences: DocumentChange[];
    similarity: number;
    summary: string;
  } {
    console.log('🔍 [DOCUMENT-WORKFLOW] Comparing versions:', version1.version, 'vs', version2.version);

    const differences: DocumentChange[] = [];
    
    // Simple word-based comparison
    const words1 = version1.content.split(/\s+/);
    const words2 = version2.content.split(/\s+/);
    
    let additions = 0;
    let deletions = 0;
    let modifications = 0;

    // Basic diff algorithm (simplified)
    if (words2.length > words1.length) {
      additions = words2.length - words1.length;
    } else if (words1.length > words2.length) {
      deletions = words1.length - words2.length;
    }

    // Calculate similarity
    const maxLength = Math.max(words1.length, words2.length);
    const minLength = Math.min(words1.length, words2.length);
    const similarity = minLength / maxLength;

    const summary = `${additions} additions, ${deletions} deletions, similarity: ${(similarity * 100).toFixed(1)}%`;

    return {
      differences,
      similarity,
      summary
    };
  }

  /**
   * Analyze document content
   */
  private async analyzeDocumentContent(content: string): Promise<DocumentVersionMetadata> {
    const wordCount = content.split(/\s+/).length;
    
    // Extract sections (simplified)
    const sections = this.extractSections(content);
    
    // Determine complexity
    const legalComplexity = this.determineLegalComplexity(content);
    
    // Assess risk level
    const riskLevel = this.assessRiskLevel(content);
    
    // Calculate completeness
    const completeness = this.calculateCompleteness(content, sections);

    return {
      wordCount,
      sections,
      legalComplexity,
      riskLevel,
      completeness,
      aiGenerated: true,
      reviewRequired: riskLevel === 'high' || riskLevel === 'critical',
      complianceChecks: [] // Will be populated by runComplianceChecks
    };
  }

  /**
   * Extract document sections
   */
  private extractSections(content: string): string[] {
    const sections: string[] = [];
    
    // Look for common section patterns
    const sectionPatterns = [
      /#{1,3}\s*(.+)/g, // Markdown headers
      /^\d+\.\s*(.+)/gm, // Numbered sections
      /^[A-Z\s]+:$/gm, // All caps sections
      /\*\*(.+?)\*\*/g // Bold sections
    ];

    sectionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const sectionName = match[1]?.trim();
        if (sectionName && sectionName.length > 2 && sectionName.length < 100) {
          sections.push(sectionName);
        }
      }
    });

    return Array.from(new Set(sections)).slice(0, 20); // Dedupe and limit
  }

  /**
   * Determine legal complexity
   */
  private determineLegalComplexity(content: string): 'simple' | 'moderate' | 'complex' | 'expert' {
    const complexityIndicators = {
      expert: ['litigation', 'precedent', 'statutory interpretation', 'regulatory compliance', 'due diligence'],
      complex: ['indemnification', 'liability', 'intellectual property', 'termination', 'confidentiality'],
      moderate: ['agreement', 'contract', 'terms', 'conditions', 'obligations'],
      simple: ['letter', 'notice', 'request', 'acknowledgment']
    };

    const contentLower = content.toLowerCase();
    
    for (const [level, indicators] of Object.entries(complexityIndicators)) {
      if (indicators.some(indicator => contentLower.includes(indicator))) {
        return level as any;
      }
    }

    return content.length > 2000 ? 'moderate' : 'simple';
  }

  /**
   * Assess risk level
   */
  private assessRiskLevel(content: string): 'low' | 'medium' | 'high' | 'critical' {
    const riskIndicators = {
      critical: ['criminal', 'prosecution', 'bankruptcy', 'insolvency'],
      high: ['breach', 'default', 'penalty', 'damages', 'liability', 'termination'],
      medium: ['warranty', 'representation', 'indemnity', 'confidential'],
      low: ['acknowledgment', 'notice', 'information', 'request']
    };

    const contentLower = content.toLowerCase();
    
    for (const [level, indicators] of Object.entries(riskIndicators)) {
      if (indicators.some(indicator => contentLower.includes(indicator))) {
        return level as any;
      }
    }

    return 'low';
  }

  /**
   * Calculate document completeness
   */
  private calculateCompleteness(content: string, sections: string[]): number {
    let completeness = 0.5; // Base score

    // Check for common required elements
    const requiredElements = [
      'date', 'parties', 'consideration', 'terms', 'signature'
    ];

    const contentLower = content.toLowerCase();
    const foundElements = requiredElements.filter(element => 
      contentLower.includes(element) || 
      sections.some(section => section.toLowerCase().includes(element))
    );

    completeness += (foundElements.length / requiredElements.length) * 0.3;

    // Check for placeholders (reduce completeness)
    const placeholders = content.match(/\[.*?\]/g) || [];
    completeness -= Math.min(placeholders.length * 0.05, 0.3);

    // Check length appropriateness
    if (content.length > 500) {
      completeness += 0.1;
    }
    if (content.length > 1500) {
      completeness += 0.1;
    }

    return Math.max(0, Math.min(1, completeness));
  }

  /**
   * Run compliance checks
   */
  private async runComplianceChecks(content: string, metadata: DocumentVersionMetadata): Promise<ComplianceCheck[]> {
    const checks: ComplianceCheck[] = [];

    // Check for required disclaimers
    if (!content.toLowerCase().includes('solicitor') && !content.toLowerCase().includes('legal advice')) {
      checks.push({
        type: 'legal_requirement',
        description: 'Legal advice disclaimer',
        status: 'warning',
        details: 'Consider adding disclaimer about seeking professional legal advice'
      });
    }

    // Check for signature blocks
    if (metadata.legalComplexity !== 'simple' && !content.toLowerCase().includes('signature')) {
      checks.push({
        type: 'legal_requirement',
        description: 'Signature block',
        status: 'warning',
        details: 'Document may require signature blocks for all parties'
      });
    }

    // Check for date fields
    if (!content.toLowerCase().includes('date') && !content.includes('[DATE]')) {
      checks.push({
        type: 'best_practice',
        description: 'Date field',
        status: 'warning',
        details: 'Document should include execution date'
      });
    }

    // Check formatting
    if (content.split('\n').length < 5) {
      checks.push({
        type: 'formatting',
        description: 'Document structure',
        status: 'warning',
        details: 'Document may benefit from better section organization'
      });
    }

    // Content quality check
    if (metadata.wordCount < 100) {
      checks.push({
        type: 'content_quality',
        description: 'Document length',
        status: 'warning',
        details: 'Document may be too brief for legal effectiveness'
      });
    }

    return checks;
  }

  /**
   * Trigger workflow actions
   */
  private async triggerWorkflow(version: DocumentVersion): Promise<void> {
    console.log('⚡ [DOCUMENT-WORKFLOW] Triggering workflow for version:', version.version);

    const workflowType = this.determineWorkflowType(version);
    const workflow = this.workflowRules.get(workflowType) || this.workflowRules.get('standard')!;

    for (const action of workflow) {
      if (action.automated && this.canExecuteAction(action, version)) {
        await this.executeWorkflowAction(action, version);
      }
    }
  }

  /**
   * Determine workflow type based on document
   */
  private determineWorkflowType(version: DocumentVersion): string {
    const content = version.content.toLowerCase();
    
    if (content.includes('contract') || content.includes('agreement')) {
      return 'contract';
    }
    if (content.includes('letter') || version.metadata.legalComplexity === 'simple') {
      return 'simple';
    }
    
    return 'standard';
  }

  /**
   * Check if workflow action can be executed
   */
  private canExecuteAction(action: DocumentWorkflowAction, version: DocumentVersion): boolean {
    if (!action.conditions) return true;

    return action.conditions.every(condition => {
      switch (condition.type) {
        case 'compliance_passed':
          return version.metadata.complianceChecks.every(check => 
            check.status !== 'failed'
          );
        case 'review_completed':
          return version.status === 'review';
        case 'approval_required':
          return version.status === 'approved';
        default:
          return true;
      }
    });
  }

  /**
   * Execute workflow action
   */
  private async executeWorkflowAction(action: DocumentWorkflowAction, version: DocumentVersion): Promise<void> {
    console.log('🔄 [DOCUMENT-WORKFLOW] Executing action:', action.type);

    switch (action.type) {
      case 'review':
        version.status = 'review';
        break;
      case 'approve':
        if (version.metadata.reviewRequired) {
          // Requires human approval
          console.log('👤 [DOCUMENT-WORKFLOW] Human approval required for:', version.id);
        } else {
          version.status = 'approved';
        }
        break;
      case 'publish':
        version.status = 'published';
        break;
      case 'archive':
        version.status = 'archived';
        break;
    }
  }

  /**
   * Generate version number
   */
  private generateVersionNumber(existingVersions: DocumentVersion[], parentVersion?: string): string {
    if (!parentVersion) {
      return '1.0';
    }

    const childVersions = existingVersions.filter(v => v.parentVersion === parentVersion);
    const latestChild = childVersions.reduce((latest, current) => 
      this.compareVersionNumbers(current.version, latest.version) > 0 ? current : latest,
      { version: parentVersion } as DocumentVersion
    );

    const [major, minor] = latestChild.version.split('.').map(Number);
    return `${major}.${minor + 1}`;
  }

  /**
   * Compare version numbers
   */
  private compareVersionNumbers(v1: string, v2: string): number {
    const [major1, minor1] = v1.split('.').map(Number);
    const [major2, minor2] = v2.split('.').map(Number);

    if (major1 !== major2) return major1 - major2;
    return minor1 - minor2;
  }

  /**
   * Get workflow statistics
   */
  getWorkflowStats(): {
    totalDocuments: number;
    totalVersions: number;
    statusDistribution: Record<string, number>;
    averageVersionsPerDocument: number;
    compliancePassRate: number;
  } {
    let totalVersions = 0;
    let totalComplianceChecks = 0;
    let passedComplianceChecks = 0;
    const statusCounts: Record<string, number> = {};

    for (const versions of this.documentVersions.values()) {
      totalVersions += versions.length;
      
      for (const version of versions) {
        statusCounts[version.status] = (statusCounts[version.status] || 0) + 1;
        
        totalComplianceChecks += version.metadata.complianceChecks.length;
        passedComplianceChecks += version.metadata.complianceChecks.filter(
          check => check.status === 'passed'
        ).length;
      }
    }

    return {
      totalDocuments: this.documentVersions.size,
      totalVersions,
      statusDistribution: statusCounts,
      averageVersionsPerDocument: this.documentVersions.size > 0 ? totalVersions / this.documentVersions.size : 0,
      compliancePassRate: totalComplianceChecks > 0 ? passedComplianceChecks / totalComplianceChecks : 0
    };
  }
}

// Export singleton instance
export const documentWorkflow = new DocumentWorkflowService();