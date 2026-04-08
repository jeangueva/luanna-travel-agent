"""
Redis client and HITL helpers for pending confirmations.
"""

import json
import os
from typing import Optional
import redis.asyncio as redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")


async def get_redis_client():
    """Get async Redis client."""
    return await redis.from_url(REDIS_URL, decode_responses=True)


async def save_pending_plan(user_id: str, plan_data: dict, ttl: int = 1800) -> None:
    """Save pending plan to Redis (HITL)."""
    client = await get_redis_client()
    key = f"hitl:{user_id}"
    await client.setex(key, ttl, json.dumps(plan_data))
    await client.close()


async def get_pending_plan(user_id: str) -> Optional[dict]:
    """Retrieve pending plan from Redis."""
    client = await get_redis_client()
    key = f"hitl:{user_id}"
    data = await client.get(key)
    await client.close()
    return json.loads(data) if data else None


async def delete_pending_plan(user_id: str) -> None:
    """Delete pending plan after confirmation."""
    client = await get_redis_client()
    key = f"hitl:{user_id}"
    await client.delete(key)
    await client.close()


async def cache_search_results(destination: str, search_type: str, results: list, ttl: int = 3600) -> None:
    """Cache search results to avoid duplicate API calls."""
    client = await get_redis_client()
    key = f"search:{search_type}:{destination}"
    await client.setex(key, ttl, json.dumps(results))
    await client.close()


async def get_cached_results(destination: str, search_type: str) -> Optional[list]:
    """Get cached search results."""
    client = await get_redis_client()
    key = f"search:{search_type}:{destination}"
    data = await client.get(key)
    await client.close()
    return json.loads(data) if data else None
