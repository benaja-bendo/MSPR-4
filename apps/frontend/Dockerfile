# docker build -f apps/frontend/Dockerfile -t cofrap/frontend:latest .
# Build args pour Minikube / Ingress (chemins relatifs OpenFaaS) :
#   --build-arg NEXT_PUBLIC_FN_AUTH_URL=/function/fn-auth
#   --build-arg NEXT_PUBLIC_FN_PASSWORD_URL=/function/fn-password
#   --build-arg NEXT_PUBLIC_FN_MFA_URL=/function/fn-mfa

FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json turbo.json ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN npm ci

FROM base AS builder
ARG NEXT_PUBLIC_FN_AUTH_URL=/function/fn-auth
ARG NEXT_PUBLIC_FN_PASSWORD_URL=/function/fn-password
ARG NEXT_PUBLIC_FN_MFA_URL=/function/fn-mfa
ENV NEXT_PUBLIC_FN_AUTH_URL=$NEXT_PUBLIC_FN_AUTH_URL
ENV NEXT_PUBLIC_FN_PASSWORD_URL=$NEXT_PUBLIC_FN_PASSWORD_URL
ENV NEXT_PUBLIC_FN_MFA_URL=$NEXT_PUBLIC_FN_MFA_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace=@cofrap/shared-types
RUN npm run build --workspace=frontend

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
