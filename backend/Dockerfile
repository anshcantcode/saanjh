FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATABASE_PATH=/data/saanjh.db

WORKDIR /srv/saanjh

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --requirement requirements.txt \
    && addgroup --system saanjh \
    && adduser --system --ingroup saanjh saanjh \
    && mkdir -p /data \
    && chown -R saanjh:saanjh /data /srv/saanjh

COPY --chown=saanjh:saanjh app ./app

USER saanjh
EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "127.0.0.1"]
