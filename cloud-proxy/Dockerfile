FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run sets PORT env var automatically
CMD exec gunicorn --bind :$PORT --workers 1 --threads 2 --timeout 30 main:app
