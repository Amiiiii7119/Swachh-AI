FROM python:3.10-slim

# Install system dependencies and clean up in one layer
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user (required by HF Spaces)
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

WORKDIR /app

# Install dependencies — no cache, no build artifacts left behind
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && pip cache purge

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
