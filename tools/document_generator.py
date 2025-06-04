"""
Document Generator
Handles creation of legal documents with templates and customization
"""

import logging
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
from jinja2 import Template, Environment, DictLoader
import json

from models.conversation_models import (
    DocumentGenerationRequest, DocumentGenerationResponse, GeneratedDocument, 
    DocumentType
)

logger = logging.getLogger(__name__)

class DocumentGenerator:
    """
    Generates legal documents using templates and collected requirements
    """
    
    def __init__(self):
        self.templates: Dict[str, str] = {}
        self.jinja_env: Optional[Environment] = None
        logger.info("📄 DocumentGenerator initialized")
    
    async def initialize(self):
        """Initialize document templates"""
        try:
            self._load_templates()
            self.jinja_env = Environment(loader=DictLoader(self.templates))
            logger.info("✅ Document templates loaded")
        except Exception as e:
            logger.error(f"❌ Failed to initialize document generator: {e}")
            raise
    
    def _load_templates(self):
        """Load document templates"""
        
        # NDA Template
        self.templates["nda"] = """
NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into on {{ effective_date }} by and between:

{% for party in parties %}
{{ loop.index }}. {{ party }}{% if not loop.last %}, and{% endif %}
{% endfor %}

("Parties")

RECITALS

WHEREAS, the Parties wish to explore {{ purpose | default("potential business opportunities") }};

WHEREAS, in connection with such discussions, the Parties may disclose certain confidential and proprietary information;

NOW, THEREFORE, in consideration of the mutual covenants contained herein, the Parties agree as follows:

1. DEFINITION OF CONFIDENTIAL INFORMATION

"Confidential Information" means any and all non-public, confidential or proprietary information disclosed by one Party ("Disclosing Party") to the other Party ("Receiving Party"), whether orally, in writing, or in any other form, including but not limited to:

- Technical data, trade secrets, know-how, research, product plans, products, services, customers, customer lists, markets, software, developments, inventions, processes, formulas, technology, designs, drawings, engineering, hardware configuration information, marketing, finances, or other business information.

2. OBLIGATIONS OF RECEIVING PARTY

The Receiving Party agrees to:

a) Hold and maintain the Confidential Information in strict confidence;
b) Not disclose the Confidential Information to any third parties without the prior written consent of the Disclosing Party;
c) Use the Confidential Information solely for the purpose of {{ purpose | default("evaluating potential business opportunities") }};
d) Take reasonable precautions to protect the confidentiality of the Confidential Information.

3. TERM

This Agreement shall remain in effect for a period of {{ duration | default("two (2) years") }} from the date first written above, unless earlier terminated by mutual written consent of the Parties.

4. RETURN OF MATERIALS

Upon termination of this Agreement or upon request by the Disclosing Party, the Receiving Party shall promptly return or destroy all documents, materials, and other tangible manifestations of Confidential Information.

5. GOVERNING LAW

This Agreement shall be governed by and construed in accordance with the laws of England and Wales.

6. ENTIRE AGREEMENT

This Agreement constitutes the entire agreement between the Parties with respect to the subject matter hereof and supersedes all prior and contemporaneous agreements and understandings.

IN WITNESS WHEREOF, the Parties have executed this Agreement as of the date first written above.

{% for party in parties %}

_________________________
{{ party }}
Date: ___________

{% endfor %}
"""

        # Service Agreement Template
        self.templates["service_agreement"] = """
SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into on {{ effective_date }} by and between:

Service Provider: {{ parties[0] if parties|length >= 1 else "SERVICE PROVIDER" }}
Client: {{ parties[1] if parties|length >= 2 else "CLIENT" }}

1. SERVICES

The Service Provider agrees to provide the following services:
{{ services | default("Services to be defined") }}

2. PAYMENT TERMS

{{ payment_terms | default("Payment terms to be specified") }}

3. TERM

This Agreement shall commence on {{ start_date | default("the effective date") }} and shall continue for {{ duration | default("a period to be specified") }}.

4. INTELLECTUAL PROPERTY

All work product created by Service Provider in the performance of services hereunder shall be owned by {{ ip_owner | default("the parties as mutually agreed") }}.

5. CONFIDENTIALITY

Both parties acknowledge that they may have access to certain confidential information and agree to maintain such information in strict confidence.

6. TERMINATION

Either party may terminate this Agreement upon {{ termination_notice | default("thirty (30) days") }} written notice to the other party.

7. GOVERNING LAW

This Agreement shall be governed by the laws of England and Wales.

IN WITNESS WHEREOF, the parties have executed this Agreement.

_________________________
{{ parties[0] if parties|length >= 1 else "SERVICE PROVIDER" }}
Date: ___________

_________________________
{{ parties[1] if parties|length >= 2 else "CLIENT" }}
Date: ___________
"""

        # Employment Contract Template
        self.templates["employment_contract"] = """
EMPLOYMENT CONTRACT

This Employment Contract ("Contract") is entered into between:

Employer: {{ parties[0] if parties|length >= 1 else "EMPLOYER" }}
Employee: {{ parties[1] if parties|length >= 2 else "EMPLOYEE" }}

1. POSITION AND DUTIES

The Employee is hired for the position of {{ position | default("Position to be specified") }}.

2. COMPENSATION

The Employee's salary shall be {{ salary | default("To be specified") }} per {{ salary_period | default("annum") }}, payable {{ payment_frequency | default("monthly") }}.

3. START DATE

Employment shall commence on {{ start_date | default("Date to be specified") }}.

4. WORKING HOURS

The Employee's normal working hours shall be {{ working_hours | default("as agreed between the parties") }}.

5. BENEFITS

The Employee shall be entitled to {{ benefits | default("benefits as per company policy") }}.

6. PROBATIONARY PERIOD

The Employee shall be subject to a probationary period of {{ probation_period | default("three (3) months") }}.

7. TERMINATION

This contract may be terminated by either party giving {{ notice_period | default("one (1) month") }} written notice.

8. CONFIDENTIALITY

The Employee agrees to maintain confidentiality of all proprietary information of the Employer.

9. GOVERNING LAW

This Contract shall be governed by the laws of England and Wales.

IN WITNESS WHEREOF, the parties have signed this Contract.

_________________________
{{ parties[0] if parties|length >= 1 else "EMPLOYER" }}
Date: ___________

_________________________
{{ parties[1] if parties|length >= 2 else "EMPLOYEE" }}
Date: ___________
"""

        # Privacy Policy Template
        self.templates["privacy_policy"] = """
PRIVACY POLICY

Last updated: {{ last_updated | default(current_date) }}

{{ company_name | default("COMPANY NAME") }} ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information.

1. INFORMATION WE COLLECT

We may collect information about you in a variety of ways:

- Personal Data: {{ personal_data_types | default("Name, email address, phone number") }}
- Usage Data: Information about how you use our services
- Device Information: Information about your device and internet connection

2. HOW WE USE YOUR INFORMATION

We use the information we collect to:

- Provide and maintain our services
- Process transactions
- Communicate with you
- Improve our services

3. SHARING YOUR INFORMATION

We may share your information in certain situations:

- With service providers who assist us in operating our business
- When required by law
- With your consent

4. DATA SECURITY

We implement appropriate security measures to protect your personal information.

5. YOUR RIGHTS

You have the right to:

- Access your personal data
- Correct inaccurate data
- Request deletion of your data
- Withdraw consent

6. CONTACT US

If you have questions about this Privacy Policy, please contact us at:
{{ contact_email | default("contact@company.com") }}

{{ company_name | default("COMPANY NAME") }}
{{ company_address | default("Company Address") }}
"""

        # Terms of Service Template
        self.templates["terms_of_service"] = """
TERMS OF SERVICE

Last updated: {{ last_updated | default(current_date) }}

1. ACCEPTANCE OF TERMS

By accessing and using {{ service_name | default("our service") }}, you accept and agree to be bound by the terms and provision of this agreement.

2. DESCRIPTION OF SERVICE

{{ service_description | default("Service description to be provided") }}

3. USER OBLIGATIONS

Users agree to:

- Use the service lawfully and responsibly
- Not violate any applicable laws or regulations
- Not interfere with the service's operation

4. INTELLECTUAL PROPERTY

All content and materials available through the service are protected by intellectual property rights.

5. LIMITATION OF LIABILITY

{{ company_name | default("We") }} shall not be liable for any indirect, incidental, special, consequential, or punitive damages.

6. TERMINATION

We may terminate or suspend your access to the service immediately, without prior notice or liability.

7. GOVERNING LAW

These Terms shall be governed by the laws of England and Wales.

8. CONTACT INFORMATION

For questions about these Terms, please contact us at:
{{ contact_email | default("contact@company.com") }}

{{ company_name | default("COMPANY NAME") }}
{{ company_address | default("Company Address") }}
"""

        # Freelancer Agreement Template
        self.templates["freelancer_agreement"] = """
FREELANCER AGREEMENT

This Freelancer Agreement ("Agreement") is entered into between:

Client: {{ parties[0] if parties|length >= 1 else "CLIENT" }}
Freelancer: {{ parties[1] if parties|length >= 2 else "FREELANCER" }}

1. SERVICES

The Freelancer agrees to provide the following services:
{{ services | default("Services to be specified") }}

2. DELIVERABLES

The Freelancer shall deliver:
{{ deliverables | default("Deliverables to be specified") }}

3. PAYMENT

Payment terms: {{ payment_terms | default("Payment terms to be specified") }}
Total amount: {{ total_amount | default("Amount to be specified") }}

4. TIMELINE

Project start date: {{ start_date | default("Start date to be specified") }}
Project deadline: {{ deadline | default("Deadline to be specified") }}

5. INTELLECTUAL PROPERTY

Unless otherwise specified, all work product shall be owned by the Client.

6. INDEPENDENT CONTRACTOR

The Freelancer is an independent contractor and not an employee of the Client.

7. CONFIDENTIALITY

The Freelancer agrees to maintain confidentiality of all Client information.

8. TERMINATION

Either party may terminate this Agreement with written notice.

IN WITNESS WHEREOF, the parties have executed this Agreement.

_________________________
{{ parties[0] if parties|length >= 1 else "CLIENT" }}
Date: ___________

_________________________
{{ parties[1] if parties|length >= 2 else "FREELANCER" }}
Date: ___________
"""

    async def generate_document(self, request: DocumentGenerationRequest) -> DocumentGenerationResponse:
        """Generate a document based on the request"""
        try:
            document_type = request.document_type.value
            parameters = request.parameters
            
            # Add default values
            parameters["current_date"] = datetime.now().strftime("%B %d, %Y")
            parameters["effective_date"] = parameters.get("effective_date", parameters["current_date"])
            
            # Validate and process parameters
            processed_params = self._process_parameters(document_type, parameters)
            
            # Get template
            template = self.jinja_env.get_template(document_type)
            
            # Generate document content
            content = template.render(**processed_params)
            
            # Create document object
            document_id = str(uuid.uuid4())
            document = GeneratedDocument(
                id=document_id,
                title=self._get_document_title(document_type, processed_params),
                type=request.document_type,
                content=content,
                generated_at=datetime.now(),
                parameters_used=processed_params
            )
            
            # Validate document quality
            warnings = self._validate_document(document_type, processed_params)
            suggestions = self._get_improvement_suggestions(document_type, processed_params)
            
            logger.info(f"✅ Generated {document_type} document: {document_id}")
            
            return DocumentGenerationResponse(
                document=document,
                status="success",
                warnings=warnings,
                suggestions=suggestions
            )
            
        except Exception as e:
            logger.error(f"❌ Document generation failed: {e}")
            
            # Return error response
            return DocumentGenerationResponse(
                document=GeneratedDocument(
                    id=str(uuid.uuid4()),
                    title="Document Generation Failed",
                    type=request.document_type,
                    content=f"Error generating document: {str(e)}",
                    generated_at=datetime.now(),
                    parameters_used=request.parameters
                ),
                status="failed",
                warnings=[f"Generation failed: {str(e)}"],
                suggestions=["Please check your parameters and try again"]
            )
    
    def _process_parameters(self, document_type: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Process and validate parameters for document generation"""
        processed = parameters.copy()
        
        # Process parties (ensure they're in the right format)
        if "parties" in processed:
            parties = processed["parties"]
            if isinstance(parties, str):
                # Split string into list of parties
                if " and " in parties.lower():
                    processed["parties"] = [p.strip() for p in parties.split(" and ")]
                elif "," in parties:
                    processed["parties"] = [p.strip() for p in parties.split(",")]
                else:
                    processed["parties"] = [parties.strip()]
            elif isinstance(parties, list):
                processed["parties"] = [str(p).strip() for p in parties]
        
        # Document-specific processing
        if document_type == "nda":
            # Ensure we have at least 2 parties for NDA
            if len(processed.get("parties", [])) < 2:
                if len(processed.get("parties", [])) == 1:
                    processed["parties"].append("Second Party")
                else:
                    processed["parties"] = ["First Party", "Second Party"]
        
        elif document_type in ["service_agreement", "employment_contract", "freelancer_agreement"]:
            # Ensure we have exactly 2 parties
            parties = processed.get("parties", [])
            if len(parties) < 2:
                if document_type == "employment_contract":
                    processed["parties"] = [parties[0] if parties else "Employer", "Employee"]
                elif document_type == "freelancer_agreement":
                    processed["parties"] = [parties[0] if parties else "Client", "Freelancer"]
                else:
                    processed["parties"] = [parties[0] if parties else "Service Provider", "Client"]
        
        # Process duration to be more readable
        if "duration" in processed:
            duration = processed["duration"]
            if isinstance(duration, (int, float)):
                if duration >= 1:
                    processed["duration"] = f"{int(duration)} year{'s' if duration != 1 else ''}"
                else:
                    months = int(duration * 12)
                    processed["duration"] = f"{months} month{'s' if months != 1 else ''}"
        
        return processed
    
    def _get_document_title(self, document_type: str, parameters: Dict[str, Any]) -> str:
        """Generate appropriate title for the document"""
        titles = {
            "nda": "Non-Disclosure Agreement",
            "service_agreement": "Service Agreement", 
            "employment_contract": "Employment Contract",
            "privacy_policy": "Privacy Policy",
            "terms_of_service": "Terms of Service",
            "freelancer_agreement": "Freelancer Agreement"
        }
        
        base_title = titles.get(document_type, "Legal Document")
        
        # Add specificity based on parties
        parties = parameters.get("parties", [])
        if len(parties) >= 2:
            return f"{base_title} - {parties[0]} & {parties[1]}"
        elif len(parties) == 1:
            return f"{base_title} - {parties[0]}"
        
        return base_title
    
    def _validate_document(self, document_type: str, parameters: Dict[str, Any]) -> List[str]:
        """Validate document and return warnings"""
        warnings = []
        
        # Common validations
        parties = parameters.get("parties", [])
        if not parties:
            warnings.append("No parties specified")
        elif len(parties) < 2:
            warnings.append("Only one party specified - consider adding the second party")
        
        # Document-specific validations
        if document_type == "nda":
            if not parameters.get("purpose"):
                warnings.append("No purpose specified for the NDA")
            if not parameters.get("duration"):
                warnings.append("No duration specified - defaulting to 2 years")
        
        elif document_type in ["service_agreement", "freelancer_agreement"]:
            if not parameters.get("services"):
                warnings.append("No services specified")
            if not parameters.get("payment_terms"):
                warnings.append("No payment terms specified")
        
        elif document_type == "employment_contract":
            if not parameters.get("position"):
                warnings.append("No position/job title specified")
            if not parameters.get("salary"):
                warnings.append("No salary specified")
        
        return warnings
    
    def _get_improvement_suggestions(self, document_type: str, parameters: Dict[str, Any]) -> List[str]:
        """Get suggestions for improving the document"""
        suggestions = []
        
        if document_type == "nda":
            suggestions.extend([
                "Consider adding a clause about return of confidential materials",
                "You may want to specify what constitutes confidential information more precisely",
                "Consider adding exceptions for publicly available information"
            ])
        
        elif document_type in ["service_agreement", "freelancer_agreement"]:
            suggestions.extend([
                "Consider adding detailed project milestones",
                "You may want to specify intellectual property ownership clearly",
                "Consider adding a dispute resolution clause"
            ])
        
        elif document_type == "employment_contract":
            suggestions.extend([
                "Consider adding details about benefits and vacation time",
                "You may want to include a non-compete clause if appropriate",
                "Consider specifying grounds for termination"
            ])
        
        # General suggestions
        suggestions.append("Have this document reviewed by a qualified legal professional")
        suggestions.append("Ensure all parties understand the terms before signing")
        
        return suggestions[:3]  # Limit to 3 suggestions 