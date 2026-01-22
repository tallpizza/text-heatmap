import os
from dotenv import load_dotenv

load_dotenv()

MODEL_NAME = os.getenv("MODEL_NAME", "distilbert-base-multilingual-cased")
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "512"))
OVERLAP = int(os.getenv("OVERLAP", "50"))
MAX_CHARACTERS = int(os.getenv("MAX_CHARACTERS", "100000"))
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
