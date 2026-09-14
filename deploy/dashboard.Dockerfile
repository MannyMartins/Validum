FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/validum/package.json apps/validum/package.json
RUN pnpm install --frozen-lockfile
COPY apps/dashboard apps/dashboard
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN test -n "$NEXT_PUBLIC_API_URL"
RUN pnpm --filter @mvp/dashboard build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/dashboard ./apps/dashboard
EXPOSE 3000
CMD ["sh", "-c", "node_modules/.bin/next start apps/dashboard -p ${PORT:-3000}"]
