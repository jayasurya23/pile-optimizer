# syntax=docker/dockerfile:1
#
# pile-optimizer — static Vite build served by nginx on Azure Container Apps.
# Built by `az acr build` (no Docker on the CI runner), matching the house pattern.

# ---------- build ----------
FROM mirror.gcr.io/library/node:20-alpine AS build
WORKDIR /src

# Dependency layer: only re-resolves when the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---------- runtime ----------
# nginx-unprivileged runs as UID 101 and listens on 8080 — no root, no setcap,
# and it satisfies Container Apps' non-root expectation without extra config.
FROM mirror.gcr.io/nginxinc/nginx-unprivileged:1.27-alpine

# The stock image's /etc/nginx/nginx.conf already has `include /etc/nginx/conf.d/*.conf;`
# inside its http{} block, which is what makes the `map` directive legal in ours.
COPY --chown=101:101 nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --chown=101:101 nginx/snippets/ /etc/nginx/snippets/
COPY --chown=101:101 nginx/denied.html /usr/share/nginx/html/denied.html

COPY --from=build --chown=101:101 /src/dist/ /usr/share/nginx/html/

USER 101
EXPOSE 8080

# nginx handles SIGTERM itself; no init shim needed for a request/response server.
CMD ["nginx", "-g", "daemon off;"]
