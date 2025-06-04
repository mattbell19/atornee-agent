# AI Legal LangGraph Backend Service

## 🤖 Overview

This is the **LangGraph-powered backend service** for the AI Legal Assistant platform. It provides advanced AI workflow orchestration, legal document generation, and research capabilities using LangChain agents and custom legal tools.

**Live Service**: https://ai-legal-langgraph-backend-9a5cb2bf3dd6.herokuapp.com  
**Main Platform**: https://app.atornee.com

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Main App      │◄──►│  LangGraph       │◄──►│   OpenAI API    │
│   (Express.js)  │    │   Backend        │    │   Integration   │
│                 │    │   (FastAPI)      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   PostgreSQL     │
                       │   & Redis        │
                       └──────────────────┘
```

## ⚡ Features

- **🔧 LangGraph Workflows**: Advanced AI agent orchestration
- **📋 Document Generation**: Legal document creation with AI
- **🔍 Legal Research**: Intelligent legal knowledge retrieval  
- **💬 Conversation Management**: Context-aware chat handling
- **🗃️ Document Storage**: PostgreSQL integration for persistence
- **⚡ Fast API**: High-performance async Python backend

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL database
- Redis (optional, for caching)
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/mattbell19/ai-legal-langgraph-backend.git
cd ai-legal-langgraph-backend

# Install dependencies
pip install -r requirements.txt

# Setup environment variables
cp env.example .env
# Edit .env with your API keys and database URLs
```

### Environment Variables

```bash
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Optional but recommended
LANGSMITH_API_KEY=your_langsmith_api_key_here
LANGSMITH_PROJECT=ai-legal-assistant-langgraph

# Database (optional - uses memory if not provided)
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
REDIS_URL=redis://localhost:6379

# Application Settings
DEBUG=false
PORT=8000
CORS_ORIGINS=https://app.atornee.com,http://localhost:3000
```

### Run Locally

```bash
# Development mode
python main.py

# Or with uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The service will be available at: http://localhost:8000

## 📡 API Endpoints

### Health Check
```
GET /
```
Returns service status and version information.

### Process Conversation
```
POST /api/conversation/process
Content-Type: application/json

{
  "conversation_id": "string",
  "user_id": "number", 
  "message": "string"
}
```

### Additional Endpoints
- `GET /docs` - Interactive API documentation (Swagger UI)
- `GET /redoc` - Alternative API documentation

## 🔧 Core Components

### LegalWorkflowEngine
Main orchestration engine that handles:
- Agent workflow coordination
- Tool selection and execution
- Response generation and formatting

### DocumentGenerator  
Specialized service for:
- Legal document creation
- Template processing
- Document formatting and styling

### ConversationStore
Handles:
- Conversation persistence
- Context management
- Redis caching integration

## 🛠️ Development

### Project Structure
```
backend/
├── main.py              # FastAPI application entry point
├── requirements.txt     # Python dependencies
├── Procfile            # Heroku deployment config
├── agents/             # LangGraph agents and workflows
├── api/                # API route handlers
├── models/             # Data models and schemas
├── tools/              # Custom tools for agents
└── workflows/          # LangGraph workflow definitions
```

### Testing
```bash
# Run tests
pytest

# Run with coverage
pytest --cov=.
```

### Code Quality
```bash
# Format code
black .

# Lint code  
flake8 .

# Type checking
mypy .
```

## 🚀 Deployment

### Heroku Deployment

The service is automatically deployed to Heroku:

```bash
# Deploy to Heroku
git push heroku main

# View logs
heroku logs --app ai-legal-langgraph-backend --tail

# Check status
heroku ps --app ai-legal-langgraph-backend
```

### Environment Configuration

Set environment variables in Heroku:
```bash
heroku config:set OPENAI_API_KEY=your_key --app ai-legal-langgraph-backend
heroku config:set LANGSMITH_API_KEY=your_key --app ai-legal-langgraph-backend
```

## 🔗 Integration

### Main Platform Integration

The backend integrates with the main AI Legal Assistant platform:

```javascript
// Main platform calls this service
const response = await fetch('https://ai-legal-langgraph-backend-9a5cb2bf3dd6.herokuapp.com/api/conversation/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversation_id: conversationId,
    user_id: userId,
    message: userMessage
  })
});
```

## 📊 Monitoring

### Health Checks
- **Service Health**: `GET /` 
- **Heroku Monitoring**: Available in Heroku dashboard
- **LangSmith Tracing**: Enabled with API key

### Logs
```bash
# Real-time logs
heroku logs --app ai-legal-langgraph-backend --tail

# Error logs only
heroku logs --app ai-legal-langgraph-backend --tail | grep ERROR
```

## 🔒 Security

- API key authentication for OpenAI integration
- CORS configuration for allowed origins
- Input validation and sanitization
- Environment variable protection

## 📚 Documentation

- **API Docs**: Available at `/docs` when running
- **Main Platform**: [GitHub Repository](https://github.com/mattbell19/atornee-main)
- **LangGraph**: [Official Documentation](https://langchain-ai.github.io/langgraph/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m "Add your feature"`
4. Push to branch: `git push origin feature/your-feature`
5. Create a Pull Request

## 📝 License

This project is proprietary software for the AI Legal Assistant platform.

## 🆘 Support

For issues and support:
- Create an issue in this repository
- Check the main platform repository for related issues
- Review Heroku logs for deployment issues

---

**🏛️ Part of the AI Legal Assistant Platform**  
**🚀 Deployed on Heroku**  
**🤖 Powered by LangGraph & OpenAI** # Test deployment pipeline
