# Build depuis la racine du monorepo :
# docker build -f apps/fn-auth/Dockerfile -t cofrap/fn-auth .

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json turbo.json ./
COPY apps/fn-auth/package.json ./apps/fn-auth/
COPY packages/database/package.json ./packages/database/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate --workspace=@cofrap/database
RUN npm run build --workspace=@cofrap/shared-types
RUN npm run build --workspace=@cofrap/database
RUN npm run build --workspace=fn-auth

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=builder /app/apps/fn-auth/dist ./dist
COPY --from=builder /app/apps/fn-auth/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database/prisma ./prisma
EXPOSE 8080
CMD ["node", "dist/main.js"]
