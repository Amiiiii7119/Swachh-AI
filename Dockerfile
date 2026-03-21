# Hugging Face Spaces compatible Dockerfile
FROM python:3.10-slim

# Create non-root user (required by HF Spaces)
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

WORKDIR /app

# Install dependencies
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Copy app code
COPY --chown=user . .

# Use /tmp for all writes (HF Spaces restriction)
ENV TMPDIR=/tmp
ENV HF_HOME=/tmp/huggingface
ENV TORCH_HOME=/tmp/torch

# Expose port 7860 (required by HF Spaces)
EXPOSE 7860

# Start FastAPI on port 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]