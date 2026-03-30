FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080
ENV GOOGLE_GENAI_USE_VERTEXAI=True
ENV GOOGLE_CLOUD_LOCATION=global
ENV FORWARDED_ALLOW_IPS=*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8080

CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "-w", "1", "--threads", "8", "--timeout", "0", "--bind", "0.0.0.0:8080", "app.main:app"]
