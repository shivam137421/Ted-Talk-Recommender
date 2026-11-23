# Production Dockerfile for TalkWise ML Microservice
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/ml/src:/app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install pinned Python dependencies
COPY ml/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy dataset mapping and clean catalog
COPY data/processed/slug_mapping.json ./data/processed/slug_mapping.json
COPY data/processed/talks_clean.csv ./data/processed/talks_clean.csv

# Copy trained model artifacts
COPY ml/artifacts/ ./ml/artifacts/

# Copy ML service and source code
COPY ml/src/ ./ml/src/
COPY ml/service/ ./ml/service/

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "ml.service.main:app", "--host", "0.0.0.0", "--port", "8000"]

