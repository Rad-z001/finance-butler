# Finance Butler backend — multi-stage build for the npm-workspaces monorepo.
# One image, two commands:
#   api:    node apps/backend/dist/server.js   (default CMD)
#   worker: node apps/backend/dist/worker.js
# The `build` target keeps dev deps (prisma CLI, tsx) — used by the one-shot
# migrate service in docker-compose.prod.yml.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/

FROM deps AS build
RUN npm ci
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/backend apps/backend
RUN npm run build -w packages/shared \
 && npx prisma generate --schema apps/backend/prisma/schema.prisma \
 && npm run build -w apps/backend

FROM deps AS prod
ENV NODE_ENV=production
RUN npm ci --omit=dev
# generated Prisma client (same alpine base → matching engine binaries)
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client node_modules/@prisma/client
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/backend/dist apps/backend/dist
COPY apps/backend/prisma apps/backend/prisma
USER node
EXPOSE 3000
CMD ["node", "apps/backend/dist/server.js"]
