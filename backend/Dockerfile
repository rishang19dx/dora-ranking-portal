FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app/

# Run as an unprivileged user (security audit SEC-07).
RUN useradd --create-home --uid 1000 dora \
    && mkdir -p /app/media /app/staticfiles /app/.data /backups \
    && chown -R dora:dora /app /backups \
    && chmod +x /app/entrypoint.sh
USER dora

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health/', timeout=4).status == 200 else 1)"

ENTRYPOINT ["/app/entrypoint.sh"]
# Production WSGI server, never `runserver` (security audit SEC-06).
CMD ["gunicorn", "dora_backend.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4", "--timeout", "120", "--access-logfile", "-"]
