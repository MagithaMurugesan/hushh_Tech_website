# =============================================================================
# Runtime-only Dockerfile for GCP Cloud Run
# dist/ is pre-built by CI/CD pipeline — no Vite build happens here
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# Install server-side dependencies only
COPY package-server.json package.json
RUN npm install --omit=dev --no-audit --no-fund

# Copy pre-built Vite output
COPY dist/ dist/

# Copy server and API routes
COPY server.js ./
COPY api/ api/

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
