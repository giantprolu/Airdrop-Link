# 📝 ToDo – AirDrop Web (Next.js + Supabase + Clerk)

> **Document conçu pour être utilisé avec Claude Code**
> 
> Hypothèse :
> - Projet Next.js **déjà créé dans VS Code** (JavaScript, App Router)
> - Repo Git initialisé
> - Projet **Clerk déjà créé**
> - Projet **Supabase déjà créé** (BDD + Storage)
> 
> 👉 Claude Code doit **implémenter**, pas initialiser.

---

## 🔐 0. Variables d’environnement (À RENSEIGNER MANUELLEMENT)

> ⚠️ **IMPORTANT** : Claude Code ne doit PAS inventer ces valeurs.
> Remplir dans `.env.local`.

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YWR2YW5jZWQtcGhlYXNhbnQtNTMuY2xlcmsuYWNjb3VudHMuZGV2JA
CLERK_SECRET_KEY=sk_test_V7eGv2StgsuZ5ypnMMUgpYQfSYr4kcWJ2KYohHwrRp

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://bxrdjwthvqtleexfdcwd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4cmRqd3RodnF0bGVleGZkY3dkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzUyMzAsImV4cCI6MjA4NDkxMTIzMH0.Lhif8yM3O5ufrH3tiZZZ8dnxqOU1ZkfGuBrcaHkYZww

# Optionnel (plus tard)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4cmRqd3RodnF0bGVleGZkY3dkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTMzNTIzMCwiZXhwIjoyMDg0OTExMjMwfQ.QLLx_qa9vwsBDEbdUAEvNEcyRpZ3ZCYVCNOUpr8N00M
```

---

## 1. Authentification – Clerk

### Objectif
- Authentifier l’utilisateur
- Obtenir un `userId` fiable côté client et serveur

### Tâches
- [ ] Installer et configurer `@clerk/nextjs`
- [ ] Ajouter `ClerkProvider` dans `app/layout.js`
- [ ] Créer /configurer :
  - [ ] page `sign-in`
  - [ ] page `sign-up`
- [ ] Vérifier récupération du `userId`
- [ ] Protéger les routes avec middleware Clerk

### Validation
- [ ] Login fonctionnel
- [ ] `userId` accessible côté client et server

---

## 2. Supabase – Base de données

### Objectif
- Stocker les métadonnées des photos

### Tâches
- [ ] Créer table `photos`

```sql
id uuid primary key default gen_random_uuid(),
user_id text not null,
file_path text not null,
created_at timestamp default now()
```

- [ ] Activer Row Level Security (RLS)
- [ ] Créer policies :
  - [ ] SELECT : user lit ses photos
  - [ ] INSERT : user ajoute ses photos

### Validation
- [ ] Impossible d’accéder aux photos d’un autre user

---

## 3. Supabase – Storage

### Objectif
- Stocker les fichiers image

### Tâches
- [ ] Créer bucket `photos`
- [ ] Bucket en **private**
- [ ] Convention chemins :

```
photos/{userId}/{uuid}.jpg
```

- [ ] Vérifier permissions bucket

---

## 4. Client Supabase (Next.js)

### Objectif
- Pouvoir utiliser Supabase côté client et server

### Tâches
- [ ] Créer util `supabaseClient.js`
- [ ] Créer util `supabaseServer.js`
- [ ] Vérifier compatibilité Clerk ↔ Supabase

> ⚠️ Claude Code doit utiliser les clés **depuis env uniquement**

---

## 5. Upload photo (Mobile)

### Objectif
- Upload photo depuis mobile (navigateur / PWA)

### Tâches
- [ ] Créer page / composant Upload
- [ ] Input file (`accept=image/*` + camera)
- [ ] Preview image
- [ ] Upload vers Supabase Storage
- [ ] Insert ligne dans table `photos`
- [ ] Gérer loading + erreurs

### Validation
- [ ] Upload fonctionne depuis mobile
- [ ] Fichier visible dans Supabase Storage

---

## 6. Récupération photo (PC)

### Objectif
- Voir et télécharger les photos depuis PC

### Tâches
- [ ] Page liste des photos
- [ ] Fetch photos par `userId`
- [ ] Générer URL signée Supabase
- [ ] Affichage galerie
- [ ] Bouton Télécharger

---

## 7. Temps réel (Effet AirDrop ✨)

### Objectif
- Sync instantanée mobile → PC

### Tâches
- [ ] Activer Supabase Realtime
- [ ] Subscribe aux INSERT sur `photos`
- [ ] Mettre à jour UI en live
- [ ] Cleanup subscription

---

## 8. PWA (Optionnel mais recommandé)

### Objectif
- Expérience app-like mobile

### Tâches
- [ ] Installer `next-pwa`
- [ ] Configurer `manifest.json`
- [ ] Icône app
- [ ] Mode standalone

---

## 9. Sécurité & Qualité

- [ ] Vérifier RLS actif
- [ ] Vérifier isolation utilisateurs
- [ ] Limite taille fichier
- [ ] Validation type MIME
- [ ] Gestion erreurs serveur

---

## 10. Déploiement

- [ ] Déployer sur Vercel
- [ ] Renseigner env prod (Clerk + Supabase)
- [ ] Test upload mobile en prod
- [ ] Test synchro PC

---

## 11. Résultat attendu 🎯

- Upload photo depuis mobile
- Apparition instantanée sur PC
- Téléchargement immédiat
- Sécurité par utilisateur
- UX fluide type AirDrop

---

## 🧠 Instruction explicite pour Claude Code

> Implémente les tâches **dans l’ordre**.
> Ne jamais :
> - inventer des clés
> - modifier les valeurs `.env`
> - créer un nouveau projet Clerk ou Supabase
> 
> Se concentrer uniquement sur le **code applicatif Next.js**.

