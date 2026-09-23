from rq import Queue

from app.core.redis import redis_connection


processing_queue = Queue(
    "meeting-processing",
    connection=redis_connection,
    default_timeout=3600
)