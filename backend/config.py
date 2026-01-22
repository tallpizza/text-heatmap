import os
from dotenv import load_dotenv

load_dotenv()

# Anthropic API
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
HAIKU_MODEL = os.getenv("HAIKU_MODEL", "claude-3-5-haiku-latest")

# Limits (청킹으로 긴 텍스트 지원)
MAX_CHARACTERS = int(os.getenv("MAX_CHARACTERS", "2000000"))  # 2백만자
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "100"))

# Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Cache TTL (seconds)
CACHE_TTL_TRANSLATE = int(os.getenv("CACHE_TTL_TRANSLATE", "86400"))  # 24시간
CACHE_TTL_FILE = int(os.getenv("CACHE_TTL_FILE", "3600"))             # 1시간
CACHE_TTL_ANALYZE = int(os.getenv("CACHE_TTL_ANALYZE", "86400"))      # 24시간
