# syntax=docker/dockerfile:1
#
# pile-optimizer — Vite build served by the FastAPI run-storage backend on
# Azure Container Apps. Built by `az acr build` (no Docker on the CI runner).
# The server replaced nginx when runs became persistent: one process now serves
# the SPA, the security headers, the EasyAuth tripwire, and /api/runs.

# ---------- frontend build ----------
FROM mirror.gcr.io/library/node:20-alpine AS build
WORKDIR /src

# Dependency layer: only re-resolves when the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---------- runtime ----------
FROM mirror.gcr.io/library/python:3.11-slim

# Baked at build time so /api/me reports exactly which commit is running.
ARG GIT_SHA=dev
ENV GIT_SHA=${GIT_SHA} PYTHONUNBUFFERED=1

WORKDIR /app
COPY server/requirements.txt server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt

COPY server/ server/
COPY --from=build /src/dist/ dist/

# Non-root, matching the old nginx-unprivileged posture.
RUN useradd --uid 1001 --create-home appuser
USER 1001

EXPOSE 8000
CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]
