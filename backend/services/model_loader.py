from transformers import AutoTokenizer, AutoModel
import torch
from config import MODEL_NAME

_model = None
_tokenizer = None


def get_model_and_tokenizer():
    global _model, _tokenizer

    if _model is None or _tokenizer is None:
        _tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        _model = AutoModel.from_pretrained(MODEL_NAME, output_attentions=True)
        _model.eval()

        if torch.cuda.is_available():
            _model = _model.cuda()

    return _model, _tokenizer
