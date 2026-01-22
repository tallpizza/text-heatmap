import os
from dotenv import load_dotenv

load_dotenv()

# Anthropic API
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
HAIKU_MODEL = os.getenv("HAIKU_MODEL", "claude-3-5-haiku-latest")

# Limits
MAX_CHARACTERS = int(os.getenv("MAX_CHARACTERS", "100000"))
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
