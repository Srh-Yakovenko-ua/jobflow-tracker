FROM ghcr.io/astral-sh/uv:0.13.6 AS uv

FROM python:3.14.10-slim-trixie AS base
ENV PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"
WORKDIR /app

FROM base AS deps
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv
COPY services/documents/pyproject.toml services/documents/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM deps AS dev
COPY services/documents/app app
EXPOSE 8002
CMD ["uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8002"]

FROM base AS prod
ENV PYTHONDONTWRITEBYTECODE=1
RUN useradd --system --no-create-home --uid 10001 documents
COPY --from=deps /opt/venv /opt/venv
COPY services/documents/app app
USER documents
EXPOSE 8002
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=10 CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8002/health', timeout=2)"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
