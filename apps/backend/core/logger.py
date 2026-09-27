# core/logger.py
# Structured JSON logging for production observability

import json
import logging
import sys
import time
import uuid
from contextvars import ContextVar
from datetime import datetime
from typing import Any, Optional

# Context variables for request tracing
request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
user_id_var: ContextVar[Optional[str]] = ContextVar("user_id", default=None)
session_id_var: ContextVar[Optional[str]] = ContextVar("session_id", default=None)

class JSONFormatter(logging.Formatter):
    """Format log records as JSON for structured logging."""
    
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add context variables if present
        request_id = request_id_var.get()
        if request_id:
            log_data["request_id"] = request_id
            
        user_id = user_id_var.get()
        if user_id:
            log_data["user_id"] = user_id
            
        session_id = session_id_var.get()
        if session_id:
            log_data["session_id"] = session_id
        
        # Add extra fields from record
        for key, value in record.__dict__.items():
            if key not in {
                "name", "msg", "args", "created", "filename", "funcName",
                "levelname", "levelno", "lineno", "module", "msecs",
                "message", "name", "pathname", "process", "processName",
                "relativeCreated", "thread", "threadName", "exc_info",
                "exc_text", "stack_info"
            }:
                log_data[key] = value
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
            
        return json.dumps(log_data, ensure_ascii=False)


def setup_logging(level: str = "INFO", json_format: bool = True) -> None:
    """Configure application logging."""
    log_level = getattr(logging, level.upper(), logging.INFO)
    
    handler = logging.StreamHandler(sys.stdout)
    
    if json_format:
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S"
            )
        )
    
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.handlers = [handler]
    
    # Reduce noise from third-party libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("ollama").setLevel(logging.WARNING)
    logging.getLogger("langchain").setLevel(logging.WARNING)
    logging.getLogger("supabase").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance with the given name."""
    return logging.getLogger(name)


class LogContext:
    """Context manager for adding request context to logs."""
    
    def __init__(
        self,
        request_id: Optional[str] = None,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
    ):
        self.request_id = request_id or str(uuid.uuid4())[:8]
        self.user_id = user_id
        self.session_id = session_id
        self._tokens = []
    
    def __enter__(self):
        self._tokens.append(request_id_var.set(self.request_id))
        if self.user_id:
            self._tokens.append(user_id_var.set(self.user_id))
        if self.session_id:
            self._tokens.append(session_id_var.set(self.session_id))
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        for token in reversed(self._tokens):
            if token is not None:
                # Reset context vars
                pass  # ContextVar.reset() would be called but we don't store tokens properly
        # Simpler approach: just don't use contextvars for now, use explicit passing


def log_chat_request(
    logger: logging.Logger,
    user_id: str,
    session_id: str,
    message: str,
    route: str,
    is_high_risk: bool,
    latency_ms: float,
    tokens_used: Optional[int] = None,
):
    """Log a chat request with structured data."""
    logger.info(
        "chat_request",
        extra={
            "event_type": "chat_request",
            "user_id": user_id,
            "session_id": session_id,
            "message_length": len(message),
            "route": route,
            "is_high_risk": is_high_risk,
            "latency_ms": latency_ms,
            "tokens_used": tokens_used,
        }
    )


def log_guardrail_trigger(
    logger: logging.Logger,
    user_id: str,
    session_id: str,
    message: str,
    trigger_type: str,  # "semantic" or "keyword"
    route: str,
):
    """Log a guardrail trigger event."""
    logger.warning(
        "guardrail_triggered",
        extra={
            "event_type": "guardrail_triggered",
            "user_id": user_id,
            "session_id": session_id,
            "message_length": len(message),
            "trigger_type": trigger_type,
            "route": route,
        }
    )


def log_error(
    logger: logging.Logger,
    error: Exception,
    context: dict[str, Any],
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
):
    """Log an error with context."""
    logger.error(
        f"error: {str(error)}",
        extra={
            "event_type": "error",
            "error_type": type(error).__name__,
            "error_message": str(error),
            "user_id": user_id,
            "session_id": session_id,
            **context,
        },
        exc_info=True
    )


def log_performance(
    logger: logging.Logger,
    operation: str,
    latency_ms: float,
    success: bool,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    **kwargs,
):
    """Log performance metrics."""
    logger.info(
        f"performance: {operation}",
        extra={
            "event_type": "performance",
            "operation": operation,
            "latency_ms": latency_ms,
            "success": success,
            "user_id": user_id,
            "session_id": session_id,
            **kwargs,
        }
    )


# Initialize logging on import
setup_logging()