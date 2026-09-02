# Railway deployment — one service that builds the website + API and serves both.
# Using a Dockerfile (instead of Railway's auto-builder) pins the pnpm version so the
# pnpm-workspace.yaml overrides/settings are honoured, and installs without a frozen
# lockfile so the overrides drift can't fail the build.
# Pull the base image from AWS ECR's public mirror of the Docker Official Images
# instead of Docker Hub. Docker Hub rate-limits anonymous pulls from shared CI IPs
# (Railway), which was failing the build with "registry-1.docker.io ... EOF".
FROM public.ecr.aws/docker/library/node:22-bookworm-slim

# Build tools for native deps (bcrypt, cpu-features) + CA certs.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Pin pnpm so pnpm-workspace.yaml (overrides, minimumReleaseAge) is read the same way as local.
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate

WORKDIR /app
COPY . .

# NOT --frozen-lockfile: tolerate lockfile/overrides drift instead of failing the build.
RUN pnpm install --no-frozen-lockfile

# Build the React website (fastap-admin -> dist/public) and the API bundle (-> dist).
RUN pnpm --filter @workspace/fastap-admin build \
    && pnpm --filter @workspace/api-server build

# Railway injects PORT; the server reads process.env.PORT. cwd is /app, so the API finds
# the built site at artifacts/fastap-admin/dist/public (see app.ts STATIC_DIR).
CMD ["node", "artifacts/api-server/dist/index.mjs"]
