from __future__ import annotations

# core/task_queue.py
# Async task queue for background jobs (session titles, notifications, etc.)

import asyncio
import json
import os
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, Optional, List
from threading import Lock

try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    redis = None
    REDIS_AVAILABLE = False


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


@dataclass
class Task:
    id: str
    name: str
    payload: Dict[str, Any]
    status: TaskStatus = TaskStatus.PENDING
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    error: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    result: Optional[Any] = None


class TaskQueue(ABC):
    """Abstract base class for task queues."""
    
    @abstractmethod
    async def enqueue(self, task: Task) -> str:
        pass
    
    @abstractmethod
    async def dequeue(self) -> Optional[Task]:
        pass
    
    @abstractmethod
    async def update_status(self, task_id: str, status: TaskStatus, **kwargs):
        pass
    
    @abstractmethod
    async def get_task(self, task_id: str) -> Optional[Task]:
        pass


class InMemoryTaskQueue(TaskQueue):
    """Simple in-memory task queue for development/single-instance."""
    
    def __init__(self):
        self.queue: asyncio.Queue = asyncio.Queue()
        self.tasks: Dict[str, Task] = {}
        self.lock = Lock()
        self._worker_task: Optional[asyncio.Task] = None
        self._handlers: Dict[str, Callable] = {}
        self._running = False
    
    def register_handler(self, task_name: str, handler: Callable):
        """Register a handler function for a task type."""
        self._handlers[task_name] = handler
    
    async def enqueue(self, task: Task) -> str:
        with self.lock:
            self.tasks[task.id] = task
        await self.queue.put(task)
        return task.id
    
    async def dequeue(self) -> Optional[Task]:
        try:
            return await asyncio.wait_for(self.queue.get(), timeout=1.0)
        except asyncio.TimeoutError:
            return None
    
    async def update_status(self, task_id: str, status: TaskStatus, **kwargs):
        with self.lock:
            if task_id in self.tasks:
                task = self.tasks[task_id]
                task.status = status
                if status == TaskStatus.RUNNING:
                    task.started_at = time.time()
                elif status in (TaskStatus.COMPLETED, TaskStatus.FAILED):
                    task.completed_at = time.time()
                for key, value in kwargs.items():
                    if hasattr(task, key):
                        setattr(task, key, value)
    
    async def get_task(self, task_id: str) -> Optional[Task]:
        with self.lock:
            return self.tasks.get(task_id)
    
    async def start_worker(self):
        """Start the background worker."""
        if self._running:
            return
        self._running = True
        self._worker_task = asyncio.create_task(self._worker_loop())
    
    async def stop_worker(self):
        """Stop the background worker."""
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
    
    async def _worker_loop(self):
        while self._running:
            task = await self.dequeue()
            if task is None:
                continue
            
            handler = self._handlers.get(task.name)
            if handler is None:
                await self.update_status(task.id, TaskStatus.FAILED, error=f"No handler for task: {task.name}")
                continue
            
            await self.update_status(task.id, TaskStatus.RUNNING)
            
            try:
                if asyncio.iscoroutinefunction(handler):
                    result = await handler(task.payload)
                else:
                    result = handler(task.payload)
                await self.update_status(task.id, TaskStatus.COMPLETED, result=result)
            except Exception as e:
                task.retry_count += 1
                if task.retry_count < task.max_retries:
                    await self.update_status(task.id, TaskStatus.RETRYING, error=str(e))
                    # Re-queue with delay
                    await asyncio.sleep(2 ** task.retry_count)
                    await self.enqueue(task)
                else:
                    await self.update_status(task.id, TaskStatus.FAILED, error=str(e))


class RedisTaskQueue(TaskQueue):
    """Redis-backed task queue for production/distributed."""
    
    def __init__(self, redis_url: str, queue_name: str = "tasks"):
        self.redis_url = redis_url
        self.queue_name = queue_name
        self._pool: Optional[redis.ConnectionPool] = None
        self._client: Optional[redis.Redis] = None
        self._handlers: Dict[str, Callable] = {}
        self._worker_task: Optional[asyncio.Task] = None
        self._running = False
    
    async def _get_client(self) -> redis.Redis:
        if self._client is None:
            self._pool = redis.ConnectionPool.from_url(
                self.redis_url,
                max_connections=20,
                decode_responses=True
            )
            self._client = redis.Redis(connection_pool=self._pool)
        return self._client
    
    def register_handler(self, task_name: str, handler: Callable):
        self._handlers[task_name] = handler
    
    async def enqueue(self, task: Task) -> str:
        client = await self._get_client()
        task_data = {
            "id": task.id,
            "name": task.name,
            "payload": task.payload,
            "status": task.status.value,
            "created_at": task.created_at,
            "max_retries": task.max_retries,
            "retry_count": task.retry_count,
        }
        await client.lpush(f"{self.queue_name}:pending", json.dumps(task_data))
        await client.hset(f"{self.queue_name}:tasks", task.id, json.dumps(task_data))
        return task.id
    
    async def dequeue(self) -> Optional[Task]:
        client = await self._get_client()
        # Blocking pop with timeout
        result = await client.brpop(f"{self.queue_name}:pending", timeout=1)
        if result is None:
            return None
        _, task_json = result
        task_data = json.loads(task_json)
        return Task(
            id=task_data["id"],
            name=task_data["name"],
            payload=task_data["payload"],
            status=TaskStatus(task_data["status"]),
            created_at=task_data["created_at"],
            max_retries=task_data.get("max_retries", 3),
            retry_count=task_data.get("retry_count", 0),
        )
    
    async def update_status(self, task_id: str, status: TaskStatus, **kwargs):
        client = await self._get_client()
        task_data = await client.hget(f"{self.queue_name}:tasks", task_id)
        if task_data:
            task = json.loads(task_data)
            task["status"] = status.value
            if status == TaskStatus.RUNNING:
                task["started_at"] = time.time()
            elif status in (TaskStatus.COMPLETED, TaskStatus.FAILED):
                task["completed_at"] = time.time()
            for key, value in kwargs.items():
                task[key] = value
            await client.hset(f"{self.queue_name}:tasks", task_id, json.dumps(task))
    
    async def get_task(self, task_id: str) -> Optional[Task]:
        client = await self._get_client()
        task_data = await client.hget(f"{self.queue_name}:tasks", task_id)
        if task_data:
            task = json.loads(task_data)
            return Task(
                id=task["id"],
                name=task["name"],
                payload=task["payload"],
                status=TaskStatus(task["status"]),
                created_at=task["created_at"],
                started_at=task.get("started_at"),
                completed_at=task.get("completed_at"),
                error=task.get("error"),
                retry_count=task.get("retry_count", 0),
                max_retries=task.get("max_retries", 3),
                result=task.get("result"),
            )
        return None
    
    async def start_worker(self):
        if self._running:
            return
        self._running = True
        self._worker_task = asyncio.create_task(self._worker_loop())
    
    async def stop_worker(self):
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
    
    async def _worker_loop(self):
        while self._running:
            task = await self.dequeue()
            if task is None:
                continue
            
            handler = self._handlers.get(task.name)
            if handler is None:
                await self.update_status(task.id, TaskStatus.FAILED, error=f"No handler for task: {task.name}")
                continue
            
            await self.update_status(task.id, TaskStatus.RUNNING)
            
            try:
                if asyncio.iscoroutinefunction(handler):
                    result = await handler(task.payload)
                else:
                    result = handler(task.payload)
                await self.update_status(task.id, TaskStatus.COMPLETED, result=result)
            except Exception as e:
                task.retry_count += 1
                if task.retry_count < task.max_retries:
                    await self.update_status(task.id, TaskStatus.RETRYING, error=str(e))
                    await asyncio.sleep(2 ** task.retry_count)
                    await self.enqueue(task)
                else:
                    await self.update_status(task.id, TaskStatus.FAILED, error=str(e))
    
    async def close(self):
        await self.stop_worker()
        if self._client:
            await self._client.close()
        if self._pool:
            await self._pool.disconnect()


# Global task queue instance
_task_queue: Optional[TaskQueue] = None


def get_task_queue() -> TaskQueue:
    """Get or create the global task queue."""
    global _task_queue
    if _task_queue is None:
        redis_url = os.getenv("REDIS_URL")
        if redis_url and REDIS_AVAILABLE:
            _task_queue = RedisTaskQueue(redis_url)
        else:
            _task_queue = InMemoryTaskQueue()
    return _task_queue


async def init_task_queue():
    """Initialize and start the task queue worker."""
    queue = get_task_queue()
    await queue.start_worker()
    return queue


async def shutdown_task_queue():
    """Shutdown the task queue worker."""
    global _task_queue
    if _task_queue:
        await _task_queue.stop_worker()
        if hasattr(_task_queue, 'close'):
            await _task_queue.close()
        _task_queue = None


# Convenience functions for common tasks
async def enqueue_session_title_generation(session_id: str, first_message: str, user_id: str) -> str:
    """Enqueue a session title generation task."""
    queue = get_task_queue()
    task = Task(
        id=str(uuid.uuid4()),
        name="generate_session_title",
        payload={
            "session_id": session_id,
            "first_message": first_message,
            "user_id": user_id,
        }
    )
    return await queue.enqueue(task)


async def enqueue_high_risk_notification(user_id: str, message: str, session_id: str = None) -> str:
    """Enqueue a high-risk notification task."""
    queue = get_task_queue()
    task = Task(
        id=str(uuid.uuid4()),
        name="send_high_risk_notification",
        payload={
            "user_id": user_id,
            "message": message,
            "session_id": session_id,
        }
    )
    return await queue.enqueue(task)


# Register default handlers
def _register_default_handlers(queue: TaskQueue):
    """Register default task handlers."""
    from services.chatbot.core import chat as chat_fn
    from supabase import create_client
    from core.security import encrypt_text
    import os
    
    supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"))
    
    async def generate_session_title_handler(payload: Dict[str, Any]):
        session_id = payload["session_id"]
        first_message = payload["first_message"]
        
        prompt = f"Buatkan satu judul singkat (maksimal 5 kata) untuk percakapan yang diawali dengan pesan berikut: '{first_message}'. Hanya keluarkan judulnya saja tanpa tanda kutip atau penjelasan tambahan."
        title = chat_fn(prompt).strip(' \n\'"')
        
        supabase.table("chat_sessions").update({"title": title}).eq("session_id", session_id).execute()
        return {"title": title}
    
    async def send_high_risk_notification_handler(payload: Dict[str, Any]):
        # This would integrate with notification service (email, push, etc.)
        # For now, just log it
        from core.logger import get_logger
        logger = get_logger("notifications")
        logger.warning(
            "high_risk_notification",
            extra={
                "event_type": "high_risk_notification",
                "user_id": payload["user_id"],
                "session_id": payload.get("session_id"),
                "message": payload["message"],
            }
        )
        return {"notified": True}
    
    queue.register_handler("generate_session_title", generate_session_title_handler)
    queue.register_handler("send_high_risk_notification", send_high_risk_notification_handler)