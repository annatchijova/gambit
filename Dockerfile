# GAMBIT YourMove — Cloud Run image.
#
# Multi-stage so the runtime image carries no toolchain and no dev
# dependencies. Uses Next's standalone output (see next.config.ts), which
# traces exactly the node_modules the server needs instead of copying all of
# them.
#
# Build and deploy:
#   gcloud run deploy gambit-yourmove --source . --region us-central1 \
#     --set-env-vars GEMINI_API_KEY=...   # or use --set-secrets
#
# Deploy something on Day 1, while the app is small. A first deploy attempted
# on Day 13 is a first deploy attempted under a deadline.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No credentials are needed to build: env validation runs on first request,
# not at module load, precisely so the build machine does not need a key.
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Never run the server as root.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

# Cloud Run injects PORT. Binding to 0.0.0.0 is required; localhost is not
# reachable from outside the container.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
EXPOSE 8080

CMD ["node", "server.js"]
