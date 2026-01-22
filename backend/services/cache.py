import hashlib
import json
import logging
from typing import Optional, Any
from collections import OrderedDict
import asyncio

logger = logging.getLogger(__name__)


class MemoryCache:
    """LRU 메모리 캐시 (Redis 폴백용)"""

    def __init__(self, max_size: int = 1000):
        self._cache: OrderedDict[str, tuple[Any, float]] = OrderedDict()
        self._max_size = max_size

    def get(self, key: str) -> Optional[str]:
        if key not in self._cache:
            return None

        value, expire_at = self._cache[key]

        # TTL 체크
        import time
        if expire_at and time.time() > expire_at:
            del self._cache[key]
            return None

        # LRU: 최근 사용으로 이동
        self._cache.move_to_end(key)
        return value

    def set(self, key: str, value: str, ttl: int = 0):
        import time
        expire_at = time.time() + ttl if ttl > 0 else 0

        # 이미 존재하면 삭제 후 재삽입 (순서 갱신)
        if key in self._cache:
            del self._cache[key]

        self._cache[key] = (value, expire_at)

        # 최대 크기 초과 시 가장 오래된 항목 삭제
        while len(self._cache) > self._max_size:
            self._cache.popitem(last=False)

    def delete(self, key: str) -> bool:
        if key in self._cache:
            del self._cache[key]
            return True
        return False

    def clear(self):
        self._cache.clear()


class CacheService:
    """Redis 우선, 메모리 폴백 캐시 서비스"""

    def __init__(self):
        self._redis = None
        self._memory_cache = MemoryCache(max_size=1000)
        self._use_redis = False
        self._redis_url = None

    async def initialize(self, redis_url: str):
        """Redis 연결 시도. 실패 시 메모리 캐시 사용."""
        self._redis_url = redis_url

        try:
            import redis.asyncio as redis
            self._redis = redis.from_url(redis_url, decode_responses=True)
            # 연결 테스트
            await self._redis.ping()
            self._use_redis = True
            logger.info(f"Redis 연결 성공: {redis_url}")
        except ImportError:
            logger.warning("redis 패키지가 설치되지 않음, 메모리 캐시 사용")
            self._use_redis = False
        except Exception as e:
            logger.warning(f"Redis 연결 실패 ({e}), 메모리 캐시 사용")
            self._use_redis = False
            self._redis = None

    async def get(self, key: str) -> Optional[str]:
        """캐시에서 값 조회"""
        if self._use_redis and self._redis:
            try:
                value = await self._redis.get(key)
                if value:
                    logger.debug(f"Cache HIT (Redis): {key}")
                else:
                    logger.debug(f"Cache MISS (Redis): {key}")
                return value
            except Exception as e:
                logger.warning(f"Redis get 실패 ({e}), 메모리 캐시로 폴백")
                self._use_redis = False

        # 메모리 캐시
        value = self._memory_cache.get(key)
        if value:
            logger.debug(f"Cache HIT (Memory): {key}")
        else:
            logger.debug(f"Cache MISS (Memory): {key}")
        return value

    async def set(self, key: str, value: str, ttl: int = 0):
        """캐시에 값 저장"""
        if self._use_redis and self._redis:
            try:
                if ttl > 0:
                    await self._redis.setex(key, ttl, value)
                else:
                    await self._redis.set(key, value)
                logger.debug(f"Cache SET (Redis): {key}, TTL: {ttl}s")
                return
            except Exception as e:
                logger.warning(f"Redis set 실패 ({e}), 메모리 캐시로 폴백")
                self._use_redis = False

        # 메모리 캐시
        self._memory_cache.set(key, value, ttl)
        logger.debug(f"Cache SET (Memory): {key}, TTL: {ttl}s")

    async def delete(self, key: str) -> bool:
        """캐시에서 값 삭제"""
        if self._use_redis and self._redis:
            try:
                result = await self._redis.delete(key)
                return result > 0
            except Exception as e:
                logger.warning(f"Redis delete 실패 ({e})")
                self._use_redis = False

        return self._memory_cache.delete(key)

    async def close(self):
        """연결 종료"""
        if self._redis:
            await self._redis.close()

    @staticmethod
    def hash_text(text: str) -> str:
        """텍스트를 SHA256 해시의 앞 16자리로 변환"""
        return hashlib.sha256(text.encode()).hexdigest()[:16]

    @staticmethod
    def make_translate_key(translate_type: str, model: str, text: str) -> str:
        """번역 캐시 키 생성"""
        text_hash = CacheService.hash_text(text)
        return f"translate:{translate_type}:{model}:{text_hash}"

    @staticmethod
    def make_analyze_key(model: str, text: str) -> str:
        """분석 캐시 키 생성"""
        text_hash = CacheService.hash_text(text)
        return f"analyze:{model}:{text_hash}"

    @staticmethod
    def make_file_key(content: bytes) -> str:
        """파일 캐시 키 생성"""
        file_hash = hashlib.sha256(content).hexdigest()[:16]
        return f"file:{file_hash}"

    @property
    def is_redis_connected(self) -> bool:
        return self._use_redis


# 싱글톤 인스턴스
cache = CacheService()
