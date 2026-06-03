# Guide complet — installation et tests du monorepo COFRAP

Ce guide décrit comment installer, lancer et tester **toutes** les pièces du PoC en local sur Windows (PowerShell). Les mêmes étapes fonctionnent sur Linux/macOS en adaptant les commandes shell.

## Sommaire

1. [Vue d’ensemble](#1-vue-densemble)
2. [Prérequis](#2-prérequis)
3. [Installation initiale](#3-installation-initiale)
4. [Base de données PostgreSQL](#4-base-de-données-postgresql)
5. [Variables d’environnement](#5-variables-denvironnement)
6. [Compilation des packages partagés](#6-compilation-des-packages-partagés)
7. [Lancer les 3 fonctions + le frontend](#7-lancer-les-3-fonctions--le-frontend)
8. [Tester dans le navigateur](#8-tester-dans-le-navigateur)
9. [Tester avec PowerShell (API)](#9-tester-avec-powershell-api)
10. [Parcours utilisateur complet](#10-parcours-utilisateur-complet)
11. [Dépannage](#11-dépannage)
12. [Build production & Docker (optionnel)](#12-build-production--docker-optionnel)

---

## 1. Vue d’ensemble

Le monorepo contient :

| Composant | Dossier | Port local | Rôle |
|-----------|---------|------------|------|
| **fn-auth** | `apps/fn-auth` | **8080** | Inscription, connexion, renouvellement |
| **fn-mfa** | `apps/fn-mfa` | **8081** | Secret TOTP 2FA + QR + activation |
| **fn-password** | `apps/fn-password` | **8082** | Mot de passe 24 car. + QR usage unique |
| **frontend** | `apps/frontend` | **3000** | Interface de démo |
| **PostgreSQL** | Docker | **5432** | Stockage utilisateurs |
| Packages | `packages/*` | — | `database`, `crypto`, `shared-types` |

En local, le frontend appelle les 3 fonctions via HTTP (pas encore via OpenFaaS). OpenFaaS/Kubernetes est documenté dans [`integration-k8s.md`](./integration-k8s.md).

```text
Navigateur (:3000)
    │
    ├── POST /register, /login, /renew  ──► fn-auth (:8080)
    ├── POST /generate                  ──► fn-password (:8082)
    └── POST /setup, /confirm           ──► fn-mfa (:8081)
                    │
                    ▼
            PostgreSQL (:5432)
```

---

## 2. Prérequis

Installez et vérifiez :

| Outil | Version minimale | Vérification |
|-------|------------------|--------------|
| **Node.js** | 18 (22 recommandé) | `node -v` |
| **npm** | 10+ | `npm -v` |
| **Docker Desktop** | récent | `docker --version` |
| **Git** | — | `git --version` |

Sous Windows, exécutez PowerShell **en mode utilisateur normal** (pas besoin d’admin pour ce guide).

---

## 3. Installation initiale

Ouvrez un terminal à la **racine du monorepo** :

```powershell
cd "C:\Users\Zuhan\Desktop\projet perso\MSPR 4\cofrap-monorepo"
```

### 3.1 Installer les dépendances

```powershell
npm install
```

> Première installation : peut prendre 2–5 minutes selon la connexion.

### 3.2 Configurer l’environnement base de données

```powershell
Copy-Item packages\database\.env.example packages\database\.env
```

Le fichier `packages/database/.env` doit contenir au minimum :

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cofrap?schema=public"
ENCRYPTION_KEY="change-me-32-chars-minimum-secret!!"
```

> **Important** : `ENCRYPTION_KEY` doit faire **au moins 32 caractères** (chiffrement AES-256 du secret MFA).

### 3.3 Configurer le frontend

```powershell
Copy-Item apps\frontend\.env.example apps\frontend\.env.local
```

Contenu attendu de `.env.local` :

```env
NEXT_PUBLIC_FN_AUTH_URL=http://localhost:8080
NEXT_PUBLIC_FN_PASSWORD_URL=http://localhost:8082
NEXT_PUBLIC_FN_MFA_URL=http://localhost:8081
```

---

## 4. Base de données PostgreSQL

### 4.1 Démarrer PostgreSQL avec Docker

À la racine du projet :

```powershell
docker compose up -d
```

Vérifier que le conteneur est prêt :

```powershell
docker compose ps
```

Vous devez voir `cofrap-postgres` avec l’état **healthy**.

### 4.2 Appliquer les migrations Prisma

Toujours à la racine :

```powershell
npm run db:generate
npm run db:migrate:deploy
```

| Commande | Effet |
|----------|--------|
| `db:generate` | Génère le client Prisma |
| `db:migrate:deploy` | Crée les tables `User` et `Session` |

### 4.3 (Optionnel) Inspecter la base

```powershell
npm run db:studio --workspace=@cofrap/database
```

Ouvre Prisma Studio dans le navigateur (souvent http://localhost:5555).

### 4.4 Arrêter PostgreSQL

```powershell
docker compose down
```

Pour supprimer aussi les données : `docker compose down -v`

---

## 5. Variables d’environnement

Les **3 fonctions NestJS** ont besoin des mêmes variables à chaque démarrage :

| Variable | Exemple | Obligatoire |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/cofrap?schema=public` | Oui |
| `ENCRYPTION_KEY` | `change-me-32-chars-minimum-secret!!` | Oui |
| `PORT` | `8080` / `8081` / `8082` | Oui (une par service) |

Sous PowerShell, **dans chaque terminal** qui lance une fonction :

```powershell
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/cofrap?schema=public"
$env:ENCRYPTION_KEY = "change-me-32-chars-minimum-secret!!"
```

Puis définir le port selon le service (voir section 7).

> Les fonctions **ne chargent pas** automatiquement un fichier `.env` : les variables doivent être exportées dans le terminal, ou vous pouvez les définir une fois par session avant les commandes `npm run dev`.

---

## 6. Compilation des packages partagés

Avant le premier lancement (et après modification de `packages/*`) :

```powershell
npm run build --workspace=@cofrap/shared-types
npm run build --workspace=@cofrap/crypto
npm run build --workspace=@cofrap/database
```

Ou en une fois :

```powershell
npm run build
```

Sans cette étape, vous pouvez obtenir des erreurs du type *Cannot find module '@cofrap/crypto'*.

---

## 7. Lancer les 3 fonctions + le frontend

Il faut **4 terminaux** ouverts en parallèle (plus PostgreSQL via Docker).

### Terminal 1 — fn-auth (port 8080)

```powershell
cd "C:\Users\Zuhan\Desktop\projet perso\MSPR 4\cofrap-monorepo"
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/cofrap?schema=public"
$env:ENCRYPTION_KEY = "change-me-32-chars-minimum-secret!!"
$env:PORT = "8080"
npm run dev --workspace=fn-auth
```

Attendre le message : `fn-auth listening on port 8080`

### Terminal 2 — fn-mfa (port 8081)

```powershell
cd "C:\Users\Zuhan\Desktop\projet perso\MSPR 4\cofrap-monorepo"
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/cofrap?schema=public"
$env:ENCRYPTION_KEY = "change-me-32-chars-minimum-secret!!"
$env:PORT = "8081"
npm run dev --workspace=fn-mfa
```

### Terminal 3 — fn-password (port 8082)

```powershell
cd "C:\Users\Zuhan\Desktop\projet perso\MSPR 4\cofrap-monorepo"
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/cofrap?schema=public"
$env:ENCRYPTION_KEY = "change-me-32-chars-minimum-secret!!"
$env:PORT = "8082"
npm run dev --workspace=fn-password
```

### Terminal 4 — frontend (port 3000)

```powershell
cd "C:\Users\Zuhan\Desktop\projet perso\MSPR 4\cofrap-monorepo"
npm run dev --workspace=frontend
```

Ouvrir : **http://localhost:3000**

### Vérification rapide des santés (5e terminal optionnel)

```powershell
Invoke-RestMethod http://localhost:8080
Invoke-RestMethod http://localhost:8081
Invoke-RestMethod http://localhost:8082
```

Réponse attendue pour chacun : `status: ok` et le nom du service.

---

## 8. Tester dans le navigateur

### 8.1 Créer un compte (colonne gauche)

1. Saisir un identifiant, ex. `alice.test`
2. Cliquer **Créer et générer le mot de passe (QR)**
3. **Scanner le QR mot de passe** avec un lecteur QR (téléphone) — il contient le mot de passe en JSON. **Conservez-le** : il ne sera plus affiché (usage unique).
4. Cliquer **Continuer — configurer la 2FA**
5. Scanner le **QR 2FA** avec Google Authenticator, Microsoft Authenticator, etc.
6. Saisir le **code à 6 chiffres** affiché par l’app → **Activer le compte**

### 8.2 Se connecter (colonne droite)

1. Identifiant : `alice.test`
2. Mot de passe : celui lu depuis le QR mot de passe
3. Code 2FA : code courant de l’application authenticator
4. **Se connecter** → message de succès avec un extrait de token de session

### 8.3 Renouvellement (simulation expiration)

- Lien **Renouveler mot de passe / 2FA** sur la page de connexion, ou
- Connexion après expiration (> 6 mois en base, ou compte marqué `expired`)

Le flux régénère un QR mot de passe puis une nouvelle 2FA.

---

## 9. Tester avec PowerShell (API)

Script fourni : [`scripts/test-api.ps1`](../scripts/test-api.ps1)

Exécution manuelle du parcours complet :

```powershell
$auth = "http://localhost:8080"
$pwd  = "http://localhost:8082"
$mfa  = "http://localhost:8081"
$user = "demo.$(Get-Random)"

# 1. Inscription
Invoke-RestMethod -Method Post -Uri "$auth/register" -ContentType "application/json" -Body (@{ username = $user } | ConvertTo-Json)

# 2. Génération mot de passe (réponse contient qrDataUrl — ouvrir dans navigateur si besoin)
$gen = Invoke-RestMethod -Method Post -Uri "$pwd/generate" -ContentType "application/json" -Body (@{ username = $user } | ConvertTo-Json)
$gen | ConvertTo-Json -Depth 3

# Le mot de passe en clair est dans le QR (JSON). Pour test API pur, décoder le QR hors scope.
# Utilisez plutôt le frontend pour récupérer le MDP, ou testez login après création via UI.
```

Pour un test API **sans QR**, le plus simple reste le **frontend** ; les QR encodent le mot de passe et le secret TOTP.

### Test health uniquement

```powershell
.\scripts\test-api.ps1
```

---

## 10. Parcours utilisateur complet

Ordre des appels (identique au frontend) :

| Étape | Endpoint | Méthode |
|-------|----------|---------|
| 1 | `fn-auth` → `/register` | POST `{ "username": "..." }` |
| 2 | `fn-password` → `/generate` | POST `{ "username": "..." }` |
| 3 | `fn-mfa` → `/setup` | POST `{ "username": "..." }` |
| 4 | `fn-mfa` → `/confirm` | POST `{ "username": "...", "code": "123456" }` |
| 5 | `fn-auth` → `/login` | POST `{ "username", "password", "totpCode" }` |
| Expiré | `fn-auth` → `/renew` puis `/generate` avec `"renew": true` | POST |

---

## 11. Dépannage

### `ECONNREFUSED` sur le port 5432

- Docker Desktop est-il démarré ?
- `docker compose up -d` exécuté ?
- `docker compose ps` → service **healthy** ?

### `P1001: Can't reach database server`

- Vérifier `DATABASE_URL` dans le terminal de la fonction
- Même URL que dans `packages/database/.env`

### `Cannot find module '@cofrap/crypto'` (ou shared-types, database)

```powershell
npm run build --workspace=@cofrap/shared-types
npm run build --workspace=@cofrap/crypto
npm run build --workspace=@cofrap/database
npm run db:generate
```

### Le frontend affiche « Erreur inconnue » ou échec réseau

- Les 3 fonctions tournent-elles sur **8080, 8081, 8082** ?
- `apps/frontend/.env.local` existe-t-il avec les bonnes URLs ?
- Redémarrer le frontend après modification de `.env.local`

### `Le QR mot de passe a déjà été généré`

- Normal : usage unique. Pour regénérer : compte `expired` ou appel `/generate` avec `"renew": true` après `/renew`

### `Code 2FA invalide`

- Horloge du téléphone synchronisée (NTP)
- Utiliser le **nouveau** secret après un renouvellement
- Code à **6 chiffres**, pas d’espace

### Port déjà utilisé

```powershell
netstat -ano | findstr :8080
# Tuer le processus ou changer $env:PORT et .env.local en conséquence
```

### Migrations en échec

```powershell
# Réinitialiser la base (⚠️ supprime les données)
docker compose down -v
docker compose up -d
npm run db:migrate:deploy
```

---

## 12. Build production & Docker (optionnel)

### Compiler tout le monorepo

```powershell
npm run build
```

### Images Docker des fonctions

```powershell
docker build -f apps/fn-auth/Dockerfile -t cofrap/fn-auth .
docker build -f apps/fn-mfa/Dockerfile -t cofrap/fn-mfa .
docker build -f apps/fn-password/Dockerfile -t cofrap/fn-password .
```

Lancer un conteneur (exemple fn-auth) :

```powershell
docker run --rm -p 8080:8080 `
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/cofrap?schema=public" `
  -e ENCRYPTION_KEY="change-me-32-chars-minimum-secret!!" `
  cofrap/fn-auth
```

> Sous Windows Docker Desktop, `host.docker.internal` pointe vers la machine hôte où tourne PostgreSQL.

### OpenFaaS

Voir [`integration-k8s.md`](./integration-k8s.md) et `deploy/stack.yml`.

---

## Checklist « tout marche nickel »

- [ ] `docker compose ps` → postgres **healthy**
- [ ] `npm run db:migrate:deploy` sans erreur
- [ ] `npm run build` sans erreur
- [ ] 3× `Invoke-RestMethod http://localhost:808x` → `status: ok`
- [ ] http://localhost:3000 s’ouvre
- [ ] Création compte → 2 QR → activation → connexion OK

---

## Liens utiles

- [README racine](../README.md)
- [Intégration Kubernetes / OpenFaaS](./integration-k8s.md)
