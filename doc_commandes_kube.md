# COFRAP — Déploiement OpenFaaS sur Kubernetes (Docker Desktop)

## Prérequis

- Docker Desktop installé avec Kubernetes activé
- Node.js >= 18
- PowerShell 5.1 (Windows)

---

## Étape 1 — Activer Kubernetes dans Docker Desktop

1. Ouvrir Docker Desktop → Settings (⚙)
2. Onglet **Kubernetes** → cocher **Enable Kubernetes**
3. Cliquer **Apply & Restart** — attendre ~3-5 minutes
4. Attendre que l'icône Kubernetes soit **verte** dans la barre des tâches

Vérification dans PowerShell :

```powershell
kubectl config use-context docker-desktop
kubectl get nodes
# Résultat attendu :
# NAME             STATUS   ROLES           AGE   VERSION
# docker-desktop   Ready    control-plane   ...
```

---

## Étape 2 — Installer faas-cli et helm

> `winget` ne trouve pas ces packages directement. On télécharge les binaires manuellement.

```powershell
# Créer un dossier pour les outils
New-Item -ItemType Directory -Force "C:\tools"

# Télécharger faas-cli
Invoke-WebRequest -UseBasicParsing `
  "https://github.com/openfaas/faas-cli/releases/latest/download/faas-cli.exe" `
  -OutFile "C:\tools\faas-cli.exe"

# Télécharger helm
Invoke-WebRequest -UseBasicParsing `
  "https://get.helm.sh/helm-v3.17.3-windows-amd64.zip" `
  -OutFile "C:\tools\helm.zip"

# Extraire helm
Expand-Archive "C:\tools\helm.zip" -DestinationPath "C:\tools\helm-tmp" -Force
Move-Item "C:\tools\helm-tmp\windows-amd64\helm.exe" "C:\tools\helm.exe"
Remove-Item "C:\tools\helm.zip", "C:\tools\helm-tmp" -Recurse -Force

# Ajouter C:\tools au PATH (permanent)
[Environment]::SetEnvironmentVariable(
  "PATH",
  [Environment]::GetEnvironmentVariable("PATH", "User") + ";C:\tools",
  "User"
)
$env:PATH += ";C:\tools"

# Vérifications
faas-cli version
helm version
```

---

## Étape 3 — Installer OpenFaaS sur Kubernetes

```powershell
# Ajouter le repo helm OpenFaaS
helm repo add openfaas https://openfaas.github.io/faas-netes/
helm repo update

# Créer les namespaces openfaas et openfaas-fn
kubectl apply -f https://raw.githubusercontent.com/openfaas/faas-netes/master/namespaces.yml

# Installer OpenFaaS
helm install openfaas openfaas/openfaas `
  --namespace openfaas `
  --set functionNamespace=openfaas-fn `
  --set generateBasicAuth=true

# Attendre que tous les pods soient Running (~2 min)
kubectl get pods -n openfaas
```

### Récupérer le mot de passe admin

> La méthode pipe ne fonctionne pas en PowerShell 5.1 — passer par une variable intermédiaire.

```powershell
$b64 = kubectl -n openfaas get secret basic-auth -o jsonpath='{.data.password}'
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64))
```

Si cela échoue encore, afficher le YAML complet et copier la valeur en face de `password:` :

```powershell
kubectl -n openfaas get secret basic-auth -o yaml
# Copier la valeur base64 de "password:" puis :
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("VALEUR_BASE64_ICI"))
```

### Exposer le gateway et se connecter

> PowerShell 5.1 n'accepte pas `&` pour les tâches en arrière-plan.
> Il faut **deux fenêtres PowerShell séparées**.

**Fenêtre 1 — garder ouverte en permanence :**

```powershell
kubectl port-forward -n openfaas svc/gateway 8080:8080
```

**Fenêtre 2 — login faas-cli :**

```powershell
faas-cli login --username admin --password MON_MOT_DE_PASSE
```

L'UI OpenFaaS est accessible sur : http://127.0.0.1:8080/ui/

---

## Étape 4 — Déployer PostgreSQL sur Kubernetes

```powershell
kubectl apply -f k8s/postgres.yml
kubectl -n cofrap rollout status deploy/postgres
```

### Appliquer les migrations Prisma

Exposer postgres temporairement dans une nouvelle fenêtre :

```powershell
# Fenêtre dédiée — garder ouverte pendant la migration
kubectl -n cofrap port-forward svc/postgres 5432:5432
```

Dans une autre fenêtre, à la racine du monorepo :

```powershell
# Configurer la variable d'environnement
$env:DATABASE_URL = "postgresql://cofrap:cofrap_secret@localhost:5432/cofrap"

# Appliquer les migrations
cd packages/database
npx prisma migrate deploy
cd ../..
```

---

## Étape 5 — Configurer le registry Docker local

OpenFaaS a besoin d'un registry pour récupérer les images.

```powershell
# Démarrer un registry local (une seule fois)
docker run -d -p 5000:5000 --name registry registry:2
```

Autoriser le registry non-sécurisé dans Docker Desktop :
- Settings → Docker Engine → ajouter dans le JSON :

```json
{
  "insecure-registries": ["localhost:5000"]
}
```

Cliquer **Apply & Restart**.

---

## Étape 6 — Construire et pousser les images Docker

Depuis la **racine du monorepo** :

```powershell
docker build -f apps/fn-auth/Dockerfile     -t localhost:5000/cofrap/fn-auth:latest .
docker build -f apps/fn-mfa/Dockerfile      -t localhost:5000/cofrap/fn-mfa:latest .
docker build -f apps/fn-password/Dockerfile -t localhost:5000/cofrap/fn-password:latest .

docker push localhost:5000/cofrap/fn-auth:latest
docker push localhost:5000/cofrap/fn-mfa:latest
docker push localhost:5000/cofrap/fn-password:latest
```

---

## Étape 7 — Déployer les fonctions OpenFaaS

```powershell
# Depuis la racine du monorepo
faas-cli deploy -f stack.yml

# Vérifier le déploiement
faas-cli list
# fn-auth, fn-mfa, fn-password doivent apparaître avec le statut Ready
```

---

## Étape 8 — Tester les fonctions

```powershell
# fn-auth — inscription
Invoke-WebRequest -Method POST http://127.0.0.1:8080/function/fn-auth/register `
  -ContentType "application/json" `
  -Body '{"email":"test@example.com","password":"MotDePasseTresLongEt24Chars!"}'

# fn-auth — connexion
Invoke-WebRequest -Method POST http://127.0.0.1:8080/function/fn-auth/login `
  -ContentType "application/json" `
  -Body '{"email":"test@example.com","password":"MotDePasseTresLongEt24Chars!"}'

# fn-mfa — setup
Invoke-WebRequest -Method POST http://127.0.0.1:8080/function/fn-mfa/setup `
  -ContentType "application/json" `
  -Body '{"userId":"mon-user-id"}'

# fn-password — hash
Invoke-WebRequest -Method POST http://127.0.0.1:8080/function/fn-password/hash `
  -ContentType "application/json" `
  -Body '{"password":"MotDePasseTresLongEt24Chars!"}'
```

---

## Récapitulatif des URLs OpenFaaS

| Fonction        | Méthode | URL                                                   |
|-----------------|---------|-------------------------------------------------------|
| Inscription     | POST    | http://127.0.0.1:8080/function/fn-auth/register       |
| Connexion       | POST    | http://127.0.0.1:8080/function/fn-auth/login          |
| MFA setup       | POST    | http://127.0.0.1:8080/function/fn-mfa/setup           |
| MFA verify      | POST    | http://127.0.0.1:8080/function/fn-mfa/verify          |
| Hash password   | POST    | http://127.0.0.1:8080/function/fn-password/hash       |
| Validate password | POST  | http://127.0.0.1:8080/function/fn-password/validate   |

---

## Récapitulatif des fenêtres PowerShell à maintenir ouvertes

| Fenêtre | Commande                                                    | Rôle                        |
|---------|-------------------------------------------------------------|-----------------------------|
| 1       | `kubectl port-forward -n openfaas svc/gateway 8080:8080`   | Gateway OpenFaaS             |
| 2       | `kubectl -n cofrap port-forward svc/postgres 5432:5432`    | PostgreSQL (migrations/dev)  |
| 3       | Commandes faas-cli / kubectl                                | Travail principal            |
