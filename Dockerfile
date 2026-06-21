FROM python:3.11-slim as builder

WORKDIR /app

# Install system builds dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN pip install --no-cache-dir poetry

# Copy dependency configuration
COPY pyproject.toml ./

# Install main packages (omit development packages)
RUN poetry config virtualenvs.create false \
    && poetry install --only main --no-interaction --no-ansi --no-root

# --- Runtime Stage ---
FROM python:3.11-slim

WORKDIR /app

# Copy packages from builder stage
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application source code
COPY src/ ./src/

# Expose server port
EXPOSE 8000

# Set environment path defaults
ENV PYTHONPATH=/app

# Start ASGI server
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
