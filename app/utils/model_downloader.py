import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

HF_REPO = "Amiiiii7119/swachh-ai-models"

def download_models():
    try:
        from huggingface_hub import hf_hub_download
        for model_file in ["best.pt", "best_v2.pt"]:
            if not Path(f"./{model_file}").exists():
                logger.info(f"Downloading {model_file}...")
                hf_hub_download(
                    repo_id=HF_REPO,
                    filename=model_file,
                    local_dir=".",
                    repo_type="model",
                )
                logger.info(f"{model_file} downloaded!")
            else:
                logger.info(f"{model_file} already exists")
    except Exception as e:
        logger.error(f"Model download failed: {e}")
