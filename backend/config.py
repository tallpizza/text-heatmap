import os
from dotenv import load_dotenv

load_dotenv()

# Anthropic API
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
HAIKU_MODEL = os.getenv("HAIKU_MODEL", "claude-3-5-haiku-latest")

# Limits (청킹으로 긴 텍스트 지원)
MAX_CHARACTERS = int(os.getenv("MAX_CHARACTERS", "2000000"))  # 2백만자
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "100"))
