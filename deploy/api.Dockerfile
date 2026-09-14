FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/validum/package.json apps/validum/package.json
RUN pnpm install --frozen-lockfile
COPY apps/api apps/api
# Prisma solo necesita una URL sintacticamente valida para generar el cliente;
# la conexion real se inyecta exclusivamente al ejecutar el contenedor.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build pnpm --filter @mvp/api prisma:generate \
  && pnpm --filter @mvp/api build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node apps/api/node_modules/prisma/build/index.js migrate deploy --schema apps/api/prisma/schema.prisma && exec node apps/api/dist/src/main.js"]
