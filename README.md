# COFRAP Monorepo

Monorepo Turborepo pour la plateforme COFRAP (auth, MFA, mots de passe).

## Structure

```
cofrap-monorepo/
├── apps/
│   ├── frontend/      # Next.js (UI)
│   ├── fn-auth/       # NestJS → OpenFaaS (authentification)
│   ├── fn-mfa/        # NestJS → OpenFaaS (MFA)
│   └── fn-password/   # NestJS → OpenFaaS (hash / validation)
├── packages/
│   ├── database/      # Prisma + PostgreSQL
│   ├── shared-types/  # DTOs Zod + interfaces TypeScript
│   ├── eslint-config/
│   └── typescript-config/
└── turbo.json
```

## Prérequis

- Node.js >= 18
- PostgreSQL (local ou conteneur)

## Démarrage rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer la base de données
cp packages/database/.env.example packages/database/.env
npm run db:generate
npm run db:push

# 3. Lancer tout en dev
npm run dev
```

## Ports

| Application   | Port dev |
|---------------|----------|
| frontend      | 3000     |
| fn-auth       | 8080     |
| fn-mfa        | 8080     |
| fn-password   | 8080     |

> En dev local, lancez une seule fonction NestJS à la fois (même port 8080 OpenFaaS).

## Docker (OpenFaaS)

Depuis la racine du monorepo :

```bash
docker build -f apps/fn-auth/Dockerfile -t cofrap/fn-auth .
docker build -f apps/fn-mfa/Dockerfile -t cofrap/fn-mfa .
docker build -f apps/fn-password/Dockerfile -t cofrap/fn-password .
```

## Scripts utiles

- `npm run build` — compile tous les packages et apps
- `npm run dev` — mode développement (Turbo)
- `npm run db:generate` — génère le client Prisma
- `npm run db:push` — synchronise le schéma avec PostgreSQL
- `npm run db:migrate` — migrations Prisma
