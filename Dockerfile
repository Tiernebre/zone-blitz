FROM denoland/deno:2.7.11 AS base
LABEL org.opencontainers.image.source=https://github.com/tiernebre/zone-blitz
WORKDIR /app

# Cache dependencies by copying config files first
COPY deno.json deno.lock ./
COPY server/deno.json ./server/
COPY packages/shared/deno.json ./packages/shared/
RUN deno install

# Production stage
FROM base AS production
COPY . .

# Baked at build time by CI (--build-arg GIT_SHA=$GITHUB_SHA) so the
# running container can report which commit it's on via /api/health.
ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA

ENV DENO_ENV=production
EXPOSE 3000

# Run migrations then start the server
CMD ["sh", "-c", "cd server && deno run --allow-net --allow-env --allow-read --allow-sys db/migrate.ts && deno run --allow-net --allow-env --allow-read --allow-sys main.ts"]
