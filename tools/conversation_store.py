"""
Conversation Store
Handles persistent storage of conversation state and message history
"""

import json
import logging
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import redis.asyncio as redis
import asyncpg

from models.conversation_models import WorkflowState, WorkflowStateEnum, UserIntent, DocumentType

logger = logging.getLogger(__name__)

class ConversationStore:
    """
    Persistent storage for conversation state and history
    Uses Redis for fast access and PostgreSQL for durable storage
    """
    
    def __init__(self, redis_url: Optional[str] = None, postgres_url: Optional[str] = None):
        self.redis_url = redis_url
        self.postgres_url = postgres_url
        self.redis_client: Optional[redis.Redis] = None
        self.postgres_pool: Optional[asyncpg.Pool] = None
        
        # Cache for conversation states (fallback when Redis unavailable)
        self.memory_cache: Dict[int, WorkflowState] = {}
        self.message_cache: Dict[int, List[Dict[str, Any]]] = {}
        
        logger.info("🗄️ ConversationStore initialized")
    
    async def initialize(self):
        """Initialize database connections"""
        try:
            # Initialize Redis connection if URL provided
            if self.redis_url:
                try:
                    self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
                    await self.redis_client.ping()
                    logger.info("✅ Redis connection established")
                except Exception as e:
                    logger.warning(f"⚠️ Redis connection failed, using memory cache: {e}")
                    self.redis_client = None
            
            # Initialize PostgreSQL connection if URL provided
            if self.postgres_url:
                try:
                    self.postgres_pool = await asyncpg.create_pool(
                        self.postgres_url,
                        min_size=1,
                        max_size=5,
                        command_timeout=60
                    )
                    await self._create_tables()
                    logger.info("✅ PostgreSQL connection established")
                except Exception as e:
                    logger.warning(f"⚠️ PostgreSQL connection failed, using memory cache: {e}")
                    self.postgres_pool = None
            
            if not self.redis_client and not self.postgres_pool:
                logger.info("📝 Using in-memory storage only")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize storage: {e}")
            # Continue with memory-only storage
    
    async def close(self):
        """Close database connections"""
        if self.redis_client:
            await self.redis_client.close()
        if self.postgres_pool:
            await self.postgres_pool.close()
        logger.info("🔒 ConversationStore connections closed")
    
    async def _create_tables(self):
        """Create necessary PostgreSQL tables"""
        if not self.postgres_pool:
            return
        
        async with self.postgres_pool.acquire() as conn:
            # Conversation states table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS conversation_states (
                    conversation_id BIGINT PRIMARY KEY,
                    current_state VARCHAR(50) NOT NULL,
                    user_intent VARCHAR(50),
                    document_type VARCHAR(50),
                    collected_requirements JSONB DEFAULT '{}',
                    missing_requirements JSONB DEFAULT '[]',
                    validation_errors JSONB DEFAULT '[]',
                    progress_percentage REAL DEFAULT 0,
                    next_step TEXT,
                    conversation_history JSONB DEFAULT '[]',
                    confidence_score REAL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            """)
            
            # Message history table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS conversation_messages (
                    id BIGSERIAL PRIMARY KEY,
                    conversation_id BIGINT NOT NULL,
                    user_id BIGINT NOT NULL,
                    content TEXT NOT NULL,
                    is_user_message BOOLEAN NOT NULL DEFAULT true,
                    metadata JSONB DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
            
            # Create indexes
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_conversation_messages_conv_id ON conversation_messages(conversation_id)")
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at ON conversation_messages(created_at)")
    
    async def get_conversation_state(self, conversation_id: int) -> Optional[WorkflowState]:
        """Get conversation state by ID"""
        try:
            # Try Redis first
            if self.redis_client:
                state_data = await self.redis_client.get(f"conv_state:{conversation_id}")
                if state_data:
                    data = json.loads(state_data)
                    return self._parse_workflow_state(data)
            
            # Try PostgreSQL
            if self.postgres_pool:
                async with self.postgres_pool.acquire() as conn:
                    row = await conn.fetchrow(
                        "SELECT * FROM conversation_states WHERE conversation_id = $1",
                        conversation_id
                    )
                    if row:
                        return self._parse_workflow_state_from_db(row)
            
            # Check memory cache
            return self.memory_cache.get(conversation_id)
            
        except Exception as e:
            logger.error(f"❌ Error getting conversation state: {e}")
            return self.memory_cache.get(conversation_id)
    
    async def save_conversation_state(self, state: WorkflowState):
        """Save conversation state"""
        try:
            conversation_id = state.conversation_id
            
            # Save to Redis
            if self.redis_client:
                state_data = state.dict()
                state_data['created_at'] = state_data['created_at'].isoformat()
                state_data['updated_at'] = state_data['updated_at'].isoformat()
                await self.redis_client.setex(
                    f"conv_state:{conversation_id}",
                    3600,  # 1 hour TTL
                    json.dumps(state_data)
                )
            
            # Save to PostgreSQL
            if self.postgres_pool:
                async with self.postgres_pool.acquire() as conn:
                    await conn.execute("""
                        INSERT INTO conversation_states (
                            conversation_id, current_state, user_intent, document_type,
                            collected_requirements, missing_requirements, validation_errors,
                            progress_percentage, next_step, conversation_history,
                            confidence_score, updated_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                        ON CONFLICT (conversation_id) DO UPDATE SET
                            current_state = $2,
                            user_intent = $3,
                            document_type = $4,
                            collected_requirements = $5,
                            missing_requirements = $6,
                            validation_errors = $7,
                            progress_percentage = $8,
                            next_step = $9,
                            conversation_history = $10,
                            confidence_score = $11,
                            updated_at = $12
                    """,
                        conversation_id,
                        state.current_state.value,
                        state.user_intent.value if state.user_intent else None,
                        state.document_type.value if state.document_type else None,
                        json.dumps(state.collected_requirements),
                        json.dumps(state.missing_requirements),
                        json.dumps(state.validation_errors),
                        state.progress_percentage,
                        state.next_step,
                        json.dumps(state.conversation_history),
                        state.confidence_score,
                        state.updated_at
                    )
            
            # Save to memory cache
            self.memory_cache[conversation_id] = state
            
        except Exception as e:
            logger.error(f"❌ Error saving conversation state: {e}")
            # At least save to memory cache
            self.memory_cache[conversation_id] = state
    
    async def get_conversation_history(self, conversation_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """Get conversation message history"""
        try:
            # Try PostgreSQL first for message history
            if self.postgres_pool:
                async with self.postgres_pool.acquire() as conn:
                    rows = await conn.fetch("""
                        SELECT user_id, content, is_user_message, metadata, created_at
                        FROM conversation_messages 
                        WHERE conversation_id = $1 
                        ORDER BY created_at DESC 
                        LIMIT $2
                    """, conversation_id, limit)
                    
                    messages = []
                    for row in reversed(rows):  # Reverse to get chronological order
                        messages.append({
                            "user_id": row["user_id"],
                            "content": row["content"],
                            "is_user_message": row["is_user_message"],
                            "metadata": json.loads(row["metadata"]) if row["metadata"] else {},
                            "timestamp": row["created_at"].isoformat()
                        })
                    return messages
            
            # Try Redis cache
            if self.redis_client:
                messages_data = await self.redis_client.get(f"conv_history:{conversation_id}")
                if messages_data:
                    return json.loads(messages_data)
            
            # Check memory cache
            return self.message_cache.get(conversation_id, [])
            
        except Exception as e:
            logger.error(f"❌ Error getting conversation history: {e}")
            return self.message_cache.get(conversation_id, [])
    
    async def save_message(self, message: Dict[str, Any]):
        """Save a message to conversation history"""
        try:
            conversation_id = message["conversation_id"]
            
            # Save to PostgreSQL
            if self.postgres_pool:
                async with self.postgres_pool.acquire() as conn:
                    await conn.execute("""
                        INSERT INTO conversation_messages (
                            conversation_id, user_id, content, is_user_message, metadata
                        ) VALUES ($1, $2, $3, $4, $5)
                    """,
                        conversation_id,
                        message["user_id"],
                        message["content"],
                        message["is_user_message"],
                        json.dumps(message.get("metadata", {}))
                    )
            
            # Update Redis cache
            if self.redis_client:
                messages = await self.get_conversation_history(conversation_id)
                messages.append({
                    "user_id": message["user_id"],
                    "content": message["content"],
                    "is_user_message": message["is_user_message"],
                    "metadata": message.get("metadata", {}),
                    "timestamp": message.get("timestamp", datetime.now()).isoformat()
                })
                # Keep only last 100 messages in cache
                if len(messages) > 100:
                    messages = messages[-100:]
                
                await self.redis_client.setex(
                    f"conv_history:{conversation_id}",
                    3600,  # 1 hour TTL
                    json.dumps(messages)
                )
            
            # Update memory cache
            if conversation_id not in self.message_cache:
                self.message_cache[conversation_id] = []
            self.message_cache[conversation_id].append(message)
            
            # Keep memory cache limited
            if len(self.message_cache[conversation_id]) > 100:
                self.message_cache[conversation_id] = self.message_cache[conversation_id][-100:]
        
        except Exception as e:
            logger.error(f"❌ Error saving message: {e}")
            # At least save to memory cache
            if conversation_id not in self.message_cache:
                self.message_cache[conversation_id] = []
            self.message_cache[conversation_id].append(message)
    
    async def reset_conversation(self, conversation_id: int):
        """Reset conversation state to start over"""
        try:
            # Create fresh state
            fresh_state = WorkflowState(
                conversation_id=conversation_id,
                current_state=WorkflowStateEnum.IDLE,
                updated_at=datetime.now()
            )
            
            # Save fresh state
            await self.save_conversation_state(fresh_state)
            
            # Clear Redis caches
            if self.redis_client:
                await self.redis_client.delete(f"conv_state:{conversation_id}")
                await self.redis_client.delete(f"conv_history:{conversation_id}")
            
            # Clear memory caches
            self.memory_cache.pop(conversation_id, None)
            self.message_cache.pop(conversation_id, None)
            
            logger.info(f"🔄 Conversation {conversation_id} reset")
            
        except Exception as e:
            logger.error(f"❌ Error resetting conversation: {e}")
            # At least clear memory
            self.memory_cache.pop(conversation_id, None)
            self.message_cache.pop(conversation_id, None)
    
    async def cleanup_old_conversations(self, days: int = 30):
        """Clean up old conversation data"""
        try:
            cutoff_date = datetime.now() - timedelta(days=days)
            
            if self.postgres_pool:
                async with self.postgres_pool.acquire() as conn:
                    # Delete old messages
                    deleted_messages = await conn.execute(
                        "DELETE FROM conversation_messages WHERE created_at < $1",
                        cutoff_date
                    )
                    
                    # Delete old states
                    deleted_states = await conn.execute(
                        "DELETE FROM conversation_states WHERE updated_at < $1",
                        cutoff_date
                    )
                    
                    logger.info(f"🧹 Cleaned up old data: {deleted_messages} messages, {deleted_states} states")
            
        except Exception as e:
            logger.error(f"❌ Error cleaning up old conversations: {e}")
    
    def _parse_workflow_state(self, data: Dict[str, Any]) -> WorkflowState:
        """Parse workflow state from dictionary"""
        # Convert enum strings back to enums
        if isinstance(data.get('current_state'), str):
            data['current_state'] = WorkflowStateEnum(data['current_state'])
        if isinstance(data.get('user_intent'), str):
            data['user_intent'] = UserIntent(data['user_intent'])
        if isinstance(data.get('document_type'), str):
            data['document_type'] = DocumentType(data['document_type'])
        
        # Convert timestamp strings back to datetime
        if isinstance(data.get('created_at'), str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])
        if isinstance(data.get('updated_at'), str):
            data['updated_at'] = datetime.fromisoformat(data['updated_at'])
        
        return WorkflowState(**data)
    
    def _parse_workflow_state_from_db(self, row) -> WorkflowState:
        """Parse workflow state from database row"""
        return WorkflowState(
            conversation_id=row['conversation_id'],
            current_state=WorkflowStateEnum(row['current_state']),
            user_intent=UserIntent(row['user_intent']) if row['user_intent'] else None,
            document_type=DocumentType(row['document_type']) if row['document_type'] else None,
            collected_requirements=json.loads(row['collected_requirements']),
            missing_requirements=json.loads(row['missing_requirements']),
            validation_errors=json.loads(row['validation_errors']),
            progress_percentage=row['progress_percentage'],
            next_step=row['next_step'],
            conversation_history=json.loads(row['conversation_history']),
            confidence_score=row['confidence_score'],
            created_at=row['created_at'],
            updated_at=row['updated_at']
        ) 