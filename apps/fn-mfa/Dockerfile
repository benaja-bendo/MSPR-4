# docker build -f apps/fn-mfa/Dockerfile -t cofrap/fn-mfa .

FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json turbo.json ./
COPY apps/fn-mfa/package.json ./apps/fn-mfa/
COPY packages/database/package.json ./packages/database/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/crypto/package.json ./packages/crypto/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate --workspace=@cofrap/database
RUN npm run build --workspace=@cofrap/shared-types
RUN npm run build --workspace=@cofrap/crypto
RUN npm run build --workspace=@cofrap/database
RUN npm run build --workspace=fn-mfa

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=builder /app/apps/fn-mfa/dist ./dist
COPY --from=builder /app/apps/fn-mfa/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database/prisma ./prisma
EXPOSE 8080
CMD ["node", "dist/main.js"]
