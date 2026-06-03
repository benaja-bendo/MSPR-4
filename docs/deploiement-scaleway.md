# Déploiement COFRAP sur Scaleway (Kapsule + OpenFaaS)

Guide pour déployer le PoC MSPR sur **Scaleway Kubernetes Kapsule** : cluster managé, **Container Registry**, Ingress avec **Load Balancer** Scaleway, OpenFaaS et PostgreSQL.

> Déjà testé en local ? [guide-demarrage-local.md](./guide-demarrage-local.md)  
> Équivalent local : [deploiement-minikube.md](./deploiement-minikube.md)

---

## Sommaire

1. [Architecture Scaleway](#1-architecture-scaleway)
2. [Prérequis et coûts](#2-prérequis-et-coûts)
3. [Créer le cluster Kapsule](#3-créer-le-cluster-kapsule)
4. [Configurer kubectl](#4-configurer-kubectl)
5. [Container Registry (images)](#5-container-registry-images)
6. [PostgreSQL : 2 options](#6-postgresql--2-options)
7. [Migrations Prisma](#7-migrations-prisma)
8. [Ingress NGINX + Load Balancer](#8-ingress-nginx--load-balancer)
9. [OpenFaaS (Helm)](#9-openfaas-helm)
10. [Déployer les fonctions](#10-déployer-les-fonctions)
11. [Déployer le frontend](#11-déployer-le-frontend)
12. [DNS et HTTPS (optionnel)](#12-dns-et-https-optionnel)
13. [Vérifications](#13-vérifications)
14. [Dépannage](#14-dépannage)

---

## 1. Architecture Scaleway

```text
Internet
    │
    ▼
Scaleway Load Balancer (créé automatiquement par le Service type LoadBalancer de l'Ingress NGINX)
    │
    ▼
Ingress NGINX (host: cofrap.votredomaine.fr)
    ├── /              → frontend (namespace cofrap)
    └── /function      → OpenFaaS gateway (namespace openfaas)
              ├── fn-auth, fn-mfa, fn-password (namespace openfaas-fn)
              │
              ▼
    PostgreSQL (in-cluster OU Scaleway Managed Database)
```

**Différences principales vs Minikube :**

| Sujet | Minikube | Scaleway Kapsule |
|--------|----------|------------------|
| Images | Docker local Minikube | **Push** vers Scaleway Registry |
| Accès externe | `cofrap.local` + hosts | **IP publique LB** + DNS |
| PostgreSQL | Pod dans le cluster | Pod **ou** base **managée** (recommandé prod) |
| Ingress | Addon Minikube | Helm `ingress-nginx` → LB Scaleway |

---

## 2. Prérequis et coûts

### Compte & outils

| Élément | Détail |
|---------|--------|
| Compte [Scaleway](https://www.scaleway.com/) | Projet avec facturation active |
| **kubectl** | CLI Kubernetes |
| **Helm 3** | OpenFaaS + Ingress |
| **faas-cli** | Déploiement des fonctions |
| **Docker** | Build des images |
| **scw CLI** (optionnel) | [Installation](https://www.scaleway.com/en/docs/cli/) |

### Ressources cluster recommandées (PoC MSPR)

| Paramètre | Valeur indicative |
|-----------|-------------------|
| Type de nœuds | `GP1-S` ou `DEV1-M` (2–3 nœuds) |
| Nœuds | **2 minimum** (1 control plane managé + workers) |
| Pool | 2 vCPU / 4 Go RAM par nœud pour un PoC léger |
| Région | `fr-par` (Paris) — aligner Registry et RDB sur la même région |
| Version K8s | 1.28+ |

> Vérifiez les offres campus / crédits Scaleway pour étudiants.

### Coûts à prévoir (ordre de grandeur)

- Cluster Kapsule (nœuds)
- Load Balancer (via Ingress)
- Container Registry (stockage + pull)
- Managed PostgreSQL (si option B)

---

## 3. Créer le cluster Kapsule

### Via la console Scaleway

1. **Containers** → **Kubernetes** → **Create cluster**
2. Nom : `cofrap-mspr`
3. Région : **Paris** (`fr-par`)
4. Version Kubernetes : stable récente
5. **Type de cluster** : Kapsule (control plane managé)
6. **Pool de nœuds** :
   - Nom : `default`
   - Taille : 2 nœuds
   - Type : selon budget (`DEV1-M` pour dev)
7. **CNI** : défaut (Cilium ou Canal selon offre)
8. Créer le cluster (5–10 min)

### Via CLI (optionnel)

```powershell
scw init
scw k8s cluster create name=cofrap-mspr version=1.29.0 cni=cilium `
  pools.0.name=default pools.0.node-type=DEV1-M pools.0.size=2 pools.0.min-size=2 pools.0.max-size=3
```

---

## 4. Configurer kubectl

### Console

1. Ouvrir le cluster `cofrap-mspr`
2. **Download kubeconfig** ou bouton **Install kubectl config**
3. Fusionner avec votre config locale

### Vérification

```powershell
kubectl config current-context
kubectl get nodes
```

Les nœuds doivent être `Ready`.

---

## 5. Container Registry

Les nœuds Kapsule **ne voient pas** vos images Docker locales : il faut pousser vers **Scaleway Container Registry**.

### 5.1 Créer un namespace Registry

Console : **Containers** → **Container Registry** → **Create namespace**

- Nom : `cofrap-mspr` (exemple)
- Région : **fr-par** (même que le cluster)

URL des images :

```text
rg.fr-par.scw.cloud/cofrap-mspr/fn-auth:latest
rg.fr-par.scw.cloud/cofrap-mspr/fn-mfa:latest
rg.fr-par.scw.cloud/cofrap-mspr/fn-password:latest
rg.fr-par.scw.cloud/cofrap-mspr/frontend:latest
```

> Adaptez `fr-par` et `cofrap-mspr` selon votre projet.

### 5.2 Se connecter à Docker

Console Registry → **Credentials** → générer un token, puis :

```powershell
docker login rg.fr-par.scw.cloud/cofrap-mspr -u nologin --password-stdin
# Coller le token quand demandé
```

### 5.3 Builder et pousser les images

À la **racine du monorepo** (sur votre PC, pas Minikube) :

```powershell
$REG = "rg.fr-par.scw.cloud/cofrap-mspr"

docker build -f apps/fn-auth/Dockerfile -t "${REG}/fn-auth:latest" .
docker build -f apps/fn-mfa/Dockerfile -t "${REG}/fn-mfa:latest" .
docker build -f apps/fn-password/Dockerfile -t "${REG}/fn-password:latest" .
docker build -f apps/frontend/Dockerfile `
  --build-arg NEXT_PUBLIC_FN_AUTH_URL=/function/fn-auth `
  --build-arg NEXT_PUBLIC_FN_PASSWORD_URL=/function/fn-password `
  --build-arg NEXT_PUBLIC_FN_MFA_URL=/function/fn-mfa `
  -t "${REG}/frontend:latest" .

docker push "${REG}/fn-auth:latest"
docker push "${REG}/fn-mfa:latest"
docker push "${REG}/fn-password:latest"
docker push "${REG}/frontend:latest"
```

### 5.4 Secret d’accès au Registry (namespace K8s)

Console : créer une **image pull secret** ou :

```powershell
kubectl create secret docker-registry scw-registry `
  --docker-server=rg.fr-par.scw.cloud `
  --docker-username=nologin `
  --docker-password=<VOTRE_TOKEN_REGISTRY> `
  --namespace=cofrap

kubectl create secret docker-registry scw-registry `
  --docker-server=rg.fr-par.scw.cloud `
  --docker-username=nologin `
  --docker-password=<VOTRE_TOKEN_REGISTRY> `
  --namespace=openfaas-fn
```

---

## 6. PostgreSQL : 2 options

### Option A — PostgreSQL dans le cluster (comme Minikube)

Simple pour un PoC, même manifests que Minikube :

```powershell
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/postgres.yaml
kubectl wait -n cofrap --for=condition=ready pod -l app=postgres --timeout=180s
```

URL interne pour les fonctions :

```text
postgresql://postgres:postgres@postgres.cofrap.svc.cluster.local:5432/cofrap?schema=public
```

### Option B — Scaleway Managed Database (recommandé pour un vrai déploiement)

1. Console : **Databases** → **PostgreSQL** → Create
2. Région `fr-par`, plan **Development** pour PoC
3. Utilisateur / mot de passe / base `cofrap`
4. **Autoriser l’accès** depuis le réseau du cluster Kapsule (Private Network / IP autorisées selon config Scaleway)
5. Récupérer l’endpoint (ex. `xxx.fr-par.scw.cloud:5432`)

URL :

```text
postgresql://<user>:<password>@<host>:5432/cofrap?schema=public&sslmode=require
```

> Ne pas commiter cette URL : utilisez un Secret Kubernetes (voir §10).

**Option A** : ne pas appliquer `postgres.yaml` si vous utilisez la base managée.

---

## 7. Migrations Prisma

Depuis votre PC, avec accès réseau à PostgreSQL :

### Option A (in-cluster)

```powershell
kubectl port-forward -n cofrap svc/postgres 5432:5432
```

Puis :

```powershell
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/cofrap?schema=public"
npm run db:generate
npm run db:migrate:deploy
```

### Option B (Managed DB)

```powershell
$env:DATABASE_URL = "postgresql://USER:PASS@HOST:5432/cofrap?schema=public&sslmode=require"
npm run db:generate
npm run db:migrate:deploy
```

---

## 8. Ingress NGINX + Load Balancer

Scaleway provisionne automatiquement un **Load Balancer** quand le Service Ingress Controller est de type `LoadBalancer`.

```powershell
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx `
  --namespace ingress-nginx `
  --create-namespace `
  --set controller.service.type=LoadBalancer
```

Attendre l’IP externe (2–5 min) :

```powershell
kubectl get svc -n ingress-nginx ingress-nginx-controller -w
```

Noter `EXTERNAL-IP` (ex. `51.158.xx.xx`) — c’est l’IP publique de votre PoC.

Documentation Scaleway : [Ingress + LB](https://www.scaleway.com/en/docs/kubernetes/reference-content/lb-ingress-controller/).

---

## 9. OpenFaaS (Helm)

```powershell
kubectl apply -f https://raw.githubusercontent.com/openfaas/faas-netes/master/namespaces.yml

helm repo add openfaas https://openfaas.github.io/faas-netes/
helm repo update

helm upgrade openfaas openfaas/openfaas `
  --install `
  --namespace openfaas `
  --set functionNamespace=openfaas-fn `
  --set generateBasicAuth=true `
  --wait
```

Mot de passe admin :

```powershell
$bytes = kubectl get secret -n openfaas basic-auth -o jsonpath="{.data.basic-auth-password}"
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($bytes))
```

---

## 10. Déployer les fonctions

### 10.1 Adapter `deploy/stack.yml` pour Scaleway

Copier et éditer :

```powershell
Copy-Item deploy\stack.scaleway.yml.example deploy\stack.scaleway.yml
```

Remplacer `REGISTRY` par votre namespace Registry (ex. `rg.fr-par.scw.cloud/cofrap-mspr`).

### 10.2 Port-forward gateway (depuis votre PC)

```powershell
kubectl port-forward -n openfaas svc/gateway 8080:8080
```

### 10.3 Login et deploy

```powershell
faas-cli login --username admin --password <MDP_ADMIN> --gateway http://127.0.0.1:8080

$env:DATABASE_URL = "<URL_POSTGRES_VUE_EN_SECTION_6>"
$env:ENCRYPTION_KEY = "<CLE_32_CARACTERES_MINIMUM>"

faas-cli deploy -f deploy/stack.scaleway.yml --gateway http://127.0.0.1:8080
faas-cli list --gateway http://127.0.0.1:8080
```

### 10.4 Secret Kubernetes (bonne pratique)

```powershell
kubectl create secret generic cofrap-db `
  --namespace=openfaas-fn `
  --from-literal=DATABASE_URL="<URL_POSTGRES>" `
  --from-literal=ENCRYPTION_KEY="<CLE_32+>"
```

Les variables passées à `faas-cli deploy` via `$env:` restent nécessaires pour l’injection OpenFaaS au déploiement (comme en local).

---

## 11. Déployer le frontend

### 11.1 Manifest avec image Registry

Éditer `deploy/k8s/frontend-scaleway.yaml` : remplacer l’image par la vôtre, puis :

```powershell
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/frontend-scaleway.yaml
```

### 11.2 Ingress Scaleway

Éditer `deploy/k8s/ingress-scaleway.yaml` : remplacer `cofrap.votredomaine.fr` par votre domaine (ou gardez l’IP seule pour test).

```powershell
kubectl apply -f deploy/k8s/ingress-scaleway.yaml
```

### 11.3 Test sans DNS (IP + header Host)

```powershell
$IP = kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
curl -H "Host: cofrap.votredomaine.fr" http://$IP/
```

---

## 12. DNS et HTTPS (optionnel)

### DNS

Chez votre registrar ou Scaleway Domains :

| Type | Nom | Valeur |
|------|-----|--------|
| A | `cofrap` (ou `@`) | `EXTERNAL-IP` du Load Balancer |

Ex. `cofrap.mondomaine.fr` → IP du LB.

### HTTPS (cert-manager + Let’s Encrypt)

Pour la soutenance, HTTP peut suffire ; pour la prod :

1. Installer [cert-manager](https://cert-manager.io/docs/installation/)
2. Créer un `ClusterIssuer` Let's Encrypt
3. Annoter l’Ingress : `cert-manager.io/cluster-issuer: letsencrypt-prod`
4. Ajouter `tls` dans `ingress-scaleway.yaml`

---

## 13. Vérifications

| Check | Commande |
|-------|----------|
| Nœuds | `kubectl get nodes` |
| Postgres | `kubectl get pods -n cofrap` ou test connexion Managed DB |
| OpenFaaS | `kubectl get pods -n openfaas` |
| Fonctions | `faas-cli list --gateway http://127.0.0.1:8080` (port-forward actif) |
| Ingress | `kubectl get ingress -A` |
| UI | `https://cofrap.votredomaine.fr` ou curl avec header Host |

Parcours : création compte → QR MDP → QR 2FA → connexion.

---

## 14. Dépannage

### ImagePullBackOff

- Image poussée sur le Registry ?
- Secret `scw-registry` présent dans le namespace du pod ?
- `imagePullSecrets` dans le Deployment frontend ?

### Fonctions : erreur base de données

- `DATABASE_URL` joignable depuis le cluster (Managed DB : ACL / Private Network)
- Migrations appliquées ?
- Même `ENCRYPTION_KEY` qu’en dev si vous réutilisez des données

### Ingress sans EXTERNAL-IP

- Attendre 5–10 min après install Helm
- `kubectl describe svc -n ingress-nginx ingress-nginx-controller`
- Vérifier quotas / facturation Scaleway

### 502 sur `/function/...`

- Gateway OpenFaaS prête : `kubectl get pods -n openfaas`
- Fonctions déployées : `faas-cli list`
- Logs : `kubectl logs -n openfaas-fn -l faas_function=fn-auth`

### Coûts qui augmentent

- Réduire le nombre de nœuds hors démo
- Supprimer le cluster : Console → Kubernetes → Delete cluster

---

## Checklist rapide Scaleway

1. [ ] Cluster Kapsule `Ready`
2. [ ] Registry : 4 images pushées
3. [ ] PostgreSQL accessible + migrations OK
4. [ ] Ingress NGINX + IP LB obtenue
5. [ ] OpenFaaS Helm installé
6. [ ] `faas-cli deploy` avec bon `DATABASE_URL` / `ENCRYPTION_KEY`
7. [ ] Frontend + Ingress appliqués
8. [ ] DNS (ou test curl + Host)
9. [ ] Parcours UI complet

---

## Fichiers du repo liés à Scaleway

| Fichier | Usage |
|---------|--------|
| `deploy/stack.scaleway.yml.example` | stack OpenFaaS avec images Registry |
| `deploy/k8s/frontend-scaleway.yaml` | Deployment frontend + pull secret |
| `deploy/k8s/ingress-scaleway.yaml` | Ingress (hostname à personnaliser) |
| `deploy/k8s/postgres.yaml` | Option A — Postgres in-cluster |

---

## Liens utiles

- [Kapsule — démo applicative](https://www.scaleway.com/en/docs/tutorials/deploy-demo-application-kubernetes-kapsule/)
- [Ingress + Load Balancer Scaleway](https://www.scaleway.com/en/docs/kubernetes/reference-content/lb-ingress-controller/)
- [Container Registry](https://www.scaleway.com/en/docs/containers/container-registry/)
- [OpenFaaS on Kubernetes](https://docs.openfaas.com/deployment/kubernetes/)
