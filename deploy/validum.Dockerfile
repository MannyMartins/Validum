FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/validum/package.json apps/validum/package.json
RUN pnpm install --frozen-lockfile
COPY apps/validum apps/validum
RUN test -n "$VITE_SUPABASE_URL" && test -n "$VITE_SUPABASE_PUBLISHABLE_KEY"
RUN pnpm --filter @mvp/validum build

FROM nginx:1.27-alpine
ENV PORT=8080
COPY deploy/nginx.validum.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/validum/dist /usr/share/nginx/html
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-8080}/health.json" || exit 1
EXPOSE 8080
