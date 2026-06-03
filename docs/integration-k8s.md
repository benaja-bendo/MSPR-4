# Contrat d'intégration K8S / OpenFaaS — COFRAP MSPR

## Fonctions OpenFaaS

| Nom déployé | Rôle | Routes |
|-------------|------|--------|
| `fn-auth` | Inscription, login, renouvellement | `POST /register`, `POST /login`, `POST /renew` |
| `fn-password` | MDP auto 24 car. + QR usage unique | `POST /generate` |
| `fn-mfa` | Secret TOTP + QR + activation | `POST /setup`, `POST /confirm` |

## Ingress Traefik (recommandé)

| Chemin | Cible |
|--------|--------|
| `/` | Frontend Next.js |
| `/function/` | OpenFaaS Gateway |

## Frontend (navigateur)

En production (même host), laisser les variables vides pour appels relatifs :

- `/function/fn-auth/login`
- `/function/fn-password/generate`
- `/function/fn-mfa/setup`

## Secrets K8s

| Secret | Services |
|--------|----------|
| `DATABASE_URL` | fn-auth, fn-mfa, fn-password |
| `ENCRYPTION_KEY` (32+ car.) | fn-auth, fn-mfa, fn-password |

## PostgreSQL

Appliquer les migrations avant déploiement :

```bash
npm run db:migrate:deploy
```

## Parcours utilisateur

1. `fn-auth/register` → `fn-password/generate` (QR MDP) → `fn-mfa/setup` (QR 2FA) → `fn-mfa/confirm`
2. `fn-auth/login` (username + MDP + code 2FA)
3. Si > 6 mois : `expired` → `fn-auth/renew` → régénération MDP + 2FA
