# COFRAP Monorepo — PoC MSPR Serverless

Monorepo Turborepo : auth, MFA, génération de mot de passe (OpenFaaS / NestJS).

## Documentation

| Document | Contenu |
|----------|---------|
| **[Guide démarrage local (complet)](docs/guide-demarrage-local.md)** | Installation, PostgreSQL, lancement des 3 fonctions + frontend, tests, dépannage |
| [Intégration K8s / OpenFaaS](docs/integration-k8s.md) | Déploiement cluster, Ingress, secrets |
| **[Déploiement Minikube](docs/deploiement-minikube.md)** | OpenFaaS + PostgreSQL + frontend sur Minikube |
| **[Déploiement Scaleway](docs/deploiement-scaleway.md)** | Kapsule, Registry, Load Balancer, OpenFaaS |

## Conformité MSPR (résumé)

| Exigence | Implémentation |
|----------|----------------|
| MDP auto 24 car. (4 types) | `fn-password` + `@cofrap/crypto` |
| QR MDP usage unique | `passwordQrUsed` + réponse QR une fois |
| 2FA obligatoire à l'activation | `fn-mfa/setup` + `confirm` → `status: active` |
| 2FA au login | `fn-auth/login` + `otplib` |
| Expiration 6 mois | `gendate` + `isCredentialExpired` |
| MFA chiffré en BDD | `mfaEnc` (AES-256-GCM) |
| MDP hash sécurisé | `passwordHash` (bcrypt) |

## Structure

```
apps/frontend, fn-auth, fn-mfa, fn-password
packages/database, shared-types, crypto
deploy/stack.yml
docker-compose.yml          # PostgreSQL local
docs/guide-demarrage-local.md
scripts/test-api.ps1        # Vérification health des fonctions
```

## Démarrage rapide

```powershell
npm install
Copy-Item packages\database\.env.example packages\database\.env
Copy-Item apps\frontend\.env.example apps\frontend\.env.local
docker compose up -d
npm run db:generate
npm run db:migrate:deploy
npm run build
```

Puis lancer **4 terminaux** (détails, variables d’env, tests navigateur) :

→ **[docs/guide-demarrage-local.md](docs/guide-demarrage-local.md)**

Vérification rapide :

```powershell
.\scripts\test-api.ps1
```

## Parcours démo

1. **Créer un compte** : username → QR mot de passe → QR 2FA → code 6 chiffres  
2. **Connexion** : username + mot de passe (du QR) + code 2FA  
3. **Renouvellement** : lien sur la page login si expiration  

## Docker (fonctions)

```bash
docker build -f apps/fn-auth/Dockerfile -t cofrap/fn-auth .
docker build -f apps/fn-mfa/Dockerfile -t cofrap/fn-mfa .
docker build -f apps/fn-password/Dockerfile -t cofrap/fn-password .
```

## Scripts racine

- `npm run db:migrate:deploy` — migrations production / cluster
- `npm run build` — compile tout le monorepo
- `docker compose up -d` — PostgreSQL local
