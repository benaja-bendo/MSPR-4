# Déploiement COFRAP sur Minikube (OpenFaaS + PostgreSQL + Frontend)

Guide pas à pas pour déployer le PoC MSPR sur un cluster **Minikube** local, avec :

- **PostgreSQL** dans le namespace `cofrap`
- **OpenFaaS Community** (Helm) — fonctions `fn-auth`, `fn-mfa`, `fn-password`
- **Frontend** Next.js derrière le même Ingress

> Prérequis local déjà OK ? Voir [guide-demarrage-local.md](./guide-demarrage-local.md).

---

## Sommaire

1. [Architecture](#1-architecture)
2. [Outils à installer](#2-outils-à-installer)
3. [Démarrer Minikube](#3-démarrer-minikube)
4. [PostgreSQL dans le cluster](#4-postgresql-dans-le-cluster)
5. [Migrations Prisma](#5-migrations-prisma)
6. [Installer OpenFaaS (Helm)](#6-installer-openfaas-helm)
7. [Construire les images Docker](#7-construire-les-images-docker)
8. [Déployer les fonctions (faas-cli)](#8-déployer-les-fonctions-faas-cli)
9. [Déployer le frontend](#9-déployer-le-frontend)
10. [Ingress et accès navigateur](#10-ingress-et-accès-navigateur)
11. [Vérifications](#11-vérifications)
12. [Dépannage Minikube](#12-dépannage-minikube)

---

## 1. Architecture

```text
                    cofrap.local (Ingress nginx)
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
    path /                                  path /function
          │                                       │
   frontend:3000                          openfaas gateway:8080
   (namespace cofrap)                           │
                    ┌────────────────────────────┼────────────────────────────┐
                    │                            │                            │
              fn-auth                      fn-password                      fn-mfa
         (openfaas-fn)                  (openfaas-fn)                  (openfaas-fn)
                    │                            │                            │
                    └────────────────────────────┴────────────────────────────┘
                                                 │
                                    postgres.cofrap.svc:5432
```

---

## 2. Outils à installer

| Outil | Rôle | Vérification |
|-------|------|--------------|
| [Minikube](https://minikube.sigs.k8s.io/docs/start/) | Cluster K8s local | `minikube version` |
| [kubectl](https://kubernetes.io/docs/tasks/tools/) | CLI Kubernetes | `kubectl version --client` |
| [Helm 3](https://helm.sh/docs/intro/install/) | Déployer OpenFaaS | `helm version` |
| [faas-cli](https://docs.openfaas.com/cli/install/) | Déployer les fonctions | `faas-cli version` |
| Docker Desktop | Build d’images | `docker version` |

Sous **Windows**, lancez PowerShell en administrateur si Minikube utilise Docker comme driver.

---

## 3. Démarrer Minikube

### 3.1 Créer le cluster (ressources recommandées MSPR)

```powershell
minikube start --cpus=4 --memory=8192 --disk-size=30g --driver=docker
```

> Si le driver `docker` échoue : `minikube start --cpus=4 --memory=8192 --driver=hyperv` (Hyper-V activé).

### 3.2 Activer l’Ingress nginx (addon Minikube)

```powershell
minikube addons enable ingress
kubectl get pods -n ingress-nginx
```

Attendre que le contrôleur Ingress soit **Running**.

### 3.3 Utiliser le Docker de Minikube pour les builds

Les images doivent être construites **dans le daemon Docker de Minikube** pour que le cluster les trouve sans registry externe :

```powershell
minikube docker-env | Invoke-Expression
```

> À refaire dans **chaque nouveau terminal** avant `docker build`.

Vérification : `docker info | Select-String "minikube"`

---

## 4. PostgreSQL dans le cluster

À la racine du monorepo :

```powershell
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/postgres.yaml
kubectl wait -n cofrap --for=condition=ready pod -l app=postgres --timeout=120s
```

Vérifier :

```powershell
kubectl get pods -n cofrap
```

---

## 5. Migrations Prisma

Les migrations s’exécutent depuis votre PC en pointant vers PostgreSQL via un **port-forward**.

### Terminal A — port-forward

```powershell
kubectl port-forward -n cofrap svc/postgres 5432:5432
```

Laissez ce terminal ouvert.

### Terminal B — migrations

```powershell
cd "C:\Users\Zuhan\Desktop\projet perso\MSPR 4\cofrap-monorepo"

$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/cofrap?schema=public"
npm run db:generate
npm run db:migrate:deploy
```

---

## 6. Installer OpenFaaS (Helm)

### 6.1 Namespaces et dépôts Helm

```powershell
kubectl apply -f https://raw.githubusercontent.com/openfaas/faas-netes/master/namespaces.yml

helm repo add openfaas https://openfaas.github.io/faas-netes/
helm repo update
```

### 6.2 Installation

```powershell
helm upgrade openfaas openfaas/openfaas `
  --install `
  --namespace openfaas `
  --set functionNamespace=openfaas-fn `
  --set generateBasicAuth=true `
  --wait
```

Attendre les pods :

```powershell
kubectl get pods -n openfaas
kubectl get pods -n openfaas-fn
```

### 6.3 Récupérer le mot de passe admin

```powershell
$bytes = kubectl get secret -n openfaas basic-auth -o jsonpath="{.data.basic-auth-password}"
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($bytes))
```

Notez ce mot de passe pour `faas-cli login`.

### 6.4 Secret applicatif (DATABASE_URL, ENCRYPTION_KEY)

Les fonctions tournent dans `openfaas-fn` et doivent joindre PostgreSQL :

```powershell
Copy-Item deploy\k8s\secrets.example.yaml deploy\k8s\secrets.yaml
# Éditez deploy\k8s\secrets.yaml si besoin (même ENCRYPTION_KEY qu’en local)
kubectl apply -f deploy\k8s\secrets.yaml
```

> `deploy/k8s/secrets.yaml` est ignoré par git si vous l’ajoutez au `.gitignore` — ne commitez pas de vraies clés.

OpenFaaS injecte les variables listées dans `deploy/stack.yml` ; il faut aussi les passer au déploiement (voir §8).

---

## 7. Construire les images Docker

Dans un terminal où `minikube docker-env` est actif, à la **racine du monorepo** :

```powershell
docker build -f apps/fn-auth/Dockerfile -t cofrap/fn-auth:latest .
docker build -f apps/fn-mfa/Dockerfile -t cofrap/fn-mfa:latest .
docker build -f apps/fn-password/Dockerfile -t cofrap/fn-password:latest .
docker build -f apps/frontend/Dockerfile `
  --build-arg NEXT_PUBLIC_FN_AUTH_URL=/function/fn-auth `
  --build-arg NEXT_PUBLIC_FN_PASSWORD_URL=/function/fn-password `
  --build-arg NEXT_PUBLIC_FN_MFA_URL=/function/fn-mfa `
  -t cofrap/frontend:latest .
```

Vérifier les images dans Minikube :

```powershell
minikube ssh -- docker images | findstr cofrap
```

---

## 8. Déployer les fonctions (faas-cli)

### 8.1 Port-forward vers la gateway OpenFaaS

**Terminal dédié** (laisser ouvert) :

```powershell
kubectl port-forward -n openfaas svc/gateway 8080:8080
```

### 8.2 Connexion faas-cli

```powershell
$adminPassword = "<mot de passe récupéré en 6.3>"
faas-cli login --username admin --password $adminPassword --gateway http://127.0.0.1:8080
```

### 8.3 Variables pour le déploiement

```powershell
$env:DATABASE_URL = "postgresql://postgres:postgres@postgres.cofrap.svc.cluster.local:5432/cofrap?schema=public"
$env:ENCRYPTION_KEY = "change-me-32-chars-minimum-secret!!"
```

> URL **interne** au cluster : le service `postgres` du namespace `cofrap`.

### 8.4 Déployer la stack

À la racine du projet :

```powershell
faas-cli deploy -f deploy/stack.yml --gateway http://127.0.0.1:8080
```

Lister les fonctions :

```powershell
faas-cli list --gateway http://127.0.0.1:8080
```

### 8.5 Test rapide d’une fonction

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8080/function/fn-auth" -Method Get
```

---

## 9. Déployer le frontend

```powershell
kubectl apply -f deploy/k8s/frontend.yaml
kubectl wait -n cofrap --for=condition=available deployment/frontend --timeout=120s
```

---

## 10. Ingress et accès navigateur

### 10.1 Appliquer les Ingress

```powershell
kubectl apply -f deploy/k8s/ingress.yaml
```

### 10.2 IP de Minikube et fichier hosts

```powershell
minikube ip
```

Éditez en **administrateur** : `C:\Windows\System32\drivers\etc\hosts`

```text
<IP_MINIKUBE>  cofrap.local
```

Exemple : `192.168.49.2  cofrap.local`

### 10.3 (Si besoin) Tunnel Minikube

Si les services LoadBalancer restent en pending :

```powershell
minikube tunnel
```

Laissez ce terminal ouvert (demande parfois les droits admin).

### 10.4 Ouvrir l’application

Navigateur : **http://cofrap.local**

- Page d’accueil → frontend
- API fonctions → `http://cofrap.local/function/fn-auth/...` etc.

---

## 11. Vérifications

| Test | Commande / action |
|------|-------------------|
| Pods cofrap | `kubectl get pods -n cofrap` |
| Pods OpenFaaS | `kubectl get pods -n openfaas` |
| Fonctions | `faas-cli list --gateway http://127.0.0.1:8080` |
| Ingress | `kubectl get ingress -A` |
| Parcours UI | Créer compte → QR MDP → QR 2FA → connexion sur http://cofrap.local |

### Test API via Ingress

```powershell
Invoke-RestMethod -Uri "http://cofrap.local/function/fn-auth" -Method Get
```

---

## 12. Dépannage Minikube

### ImagePullBackOff sur les fonctions

- Avez-vous fait `minikube docker-env | Invoke-Expression` **avant** le `docker build` ?
- `imagePullPolicy` : OpenFaaS utilise l’image locale si tag `latest` et policy adaptée ; reconstruire et `faas-cli deploy` à nouveau.

### Fonction ne joint pas PostgreSQL

- Vérifier `DATABASE_URL` : host `postgres.cofrap.svc.cluster.local`
- Secret dans `openfaas-fn` + variables dans `stack.yml`
- Tester depuis un pod :  
  `kubectl run -it --rm debug --image=postgres:16-alpine -n openfaas-fn -- psql "postgresql://postgres:postgres@postgres.cofrap.svc.cluster.local:5432/cofrap"`

### Ingress 404 ou pas de réponse

- `minikube addons enable ingress`
- Vérifier `kubectl get ingress -A`
- Entrée `hosts` correcte dans `ingress.yaml` et fichier hosts Windows
- `kubectl describe ingress -n cofrap`

### Frontend appelle encore localhost

- Rebuild frontend avec les `--build-arg NEXT_PUBLIC_FN_*=/function/...`
- Redéployer le deployment frontend

### Mémoire insuffisante

```powershell
minikube stop
minikube delete
minikube start --cpus=4 --memory=10240 --disk-size=40g
```

### Tout supprimer et recommencer

```powershell
helm uninstall openfaas -n openfaas
kubectl delete namespace cofrap openfaas-fn openfaas
minikube delete
```

---

## Ordre récapitulatif (checklist)

1. `minikube start` + `ingress` addon  
2. `minikube docker-env`  
3. PostgreSQL (`deploy/k8s`)  
4. Migrations via port-forward  
5. Helm OpenFaaS  
6. Secret `cofrap-app-secrets`  
7. `docker build` × 4 images  
8. `kubectl port-forward` gateway + `faas-cli deploy`  
9. Frontend + Ingress + hosts `cofrap.local`  
10. Test navigateur  

---

## Liens

- [Démarrage local](./guide-demarrage-local.md)
- [Contrat K8s / OpenFaaS](./integration-k8s.md)
- [OpenFaaS Helm chart](https://docs.openfaas.com/deployment/kubernetes/)
