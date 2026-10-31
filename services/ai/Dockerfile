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
COPY services/ai/pyproject.toml services/ai/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM deps AS dev
COPY services/ai/app app
EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8001"]

FROM base AS prod
ENV PYTHONDONTWRITEBYTECODE=1
RUN useradd --system --no-create-home --uid 10001 ai
COPY --from=deps /opt/venv /opt/venv
COPY services/ai/app app
USER ai
EXPOSE 8001
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=10 CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=2)"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
