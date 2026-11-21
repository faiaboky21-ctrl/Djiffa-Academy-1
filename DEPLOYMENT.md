# Guide de Mise en Ligne — DJIFFA ACADEMY

Ce guide détaille les étapes nécessaires pour relier **Supabase**, **GitHub**, **l’hébergement vidéo/PDF**, **FedaPay / KKiaPay / CinetPay** et déployer **DJIFFA ACADEMY** sur **Render** avec un nom de domaine personnalisé.

---

## 1. Préparer Supabase (Base de données, Auth & Storage)

1. Créez un projet gratuit sur [supabase.com](https://supabase.com).
2. Ouvrez **SQL Editor** dans votre tableau de bord Supabase.
3. Copiez-collez l’intégralité du fichier **`supabase/schema.sql`** puis cliquez sur **Run**.
   - Cela crée toutes les tables (`profiles`, `domains`, `courses`, `course_private_contents`, `enrollments`, `lesson_progress`, `certificates`, `orders`, `promo_codes`, `coaching_programs`, `coaching_requests`, `testimonials`, `site_settings`), active **Row Level Security (RLS)** et crée automatiquement les 3 buckets :
     - `brand-assets` (public — logo agence)
     - `course-pdfs` (privé — URL signées après vérification d’achat)
     - `course-videos` (privé — URL signées après vérification d’achat)
4. Récupérez vos clés dans **Project Settings → API** :
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = `anon` `public` key
   - `SUPABASE_URL` = Project URL (identique)
   - `SUPABASE_SERVICE_ROLE_KEY` = `service_role` secret key *(strictement côté serveur, jamais côté navigateur)*
5. Une fois l’application démarrée avec ces variables :
   - Connectez-vous à l’**Espace Direction** -> onglet **Logo, Paiements & Site**.
   - Cliquez sur **« Migrer mes données locales vers Supabase »** pour pousser instantanément toutes vos formations existantes (dont *La Méthode Faith Ariola*), domaines, codes promo et paramètres sans perte de données.

---

## 2. Hébergement des Vidéos & Supports Pédagogiques

Deux options s’offrent à vous et fonctionnent directement dans le lecteur **DJIFFA ACADEMY** :

- **Option A — Supabase Storage privé (`course-videos` & `course-pdfs`)** :
  - Depuis l’éditeur de leçon dans l’Espace Direction, cliquez sur **Vidéo** ou **PDF** pour téléverser directement le fichier.
  - Le système génère automatiquement une référence protégée `sb://course-videos/...` ou `sb://course-pdfs/...` qui nécessite une inscription confirmée pour être lue via `/api/media/signed-url`.
- **Option B — Streaming dédié recommandé pour vidéos longues / HD : Bunny Stream ou Cloudflare Stream** :
  - Hébergez vos vidéos HD sur Bunny Stream (`iframe.mediadelivery.net/...`) ou Cloudflare Stream et collez le lien d’intégration dans la leçon.
  - Avantage : streaming adaptatif fluide sur connexion mobile Android en Afrique de l’Ouest, lecture rapide et protection contre le téléchargement simple.
  - *Note technique* : pour du DRM matériel strict (Widevine/FairPlay), un service de streaming spécialisé (Bunny Stream DRM / Cloudflare Stream / Mux) reste indispensable au-delà d’un simple bucket de stockage.

---

## 3. Paiements Réels (Bénin & International)

**Recommandation pour démarrer au Bénin : FedaPay** (MTN Mobile Money, Moov Money, Visa, Mastercard — sans abonnement mensuel fixe).

1. Créez un compte marchand sur [fedapay.com](https://fedapay.com) (ou [kkiapay.me](https://kkiapay.me) / [cinetpay.com](https://cinetpay.com)).
2. Commencez en mode **Sandbox** pour valider votre parcours, puis passez en **Live** après validation de votre dossier marchand.
3. Renseignez les variables serveur :
   - `PAYMENT_PROVIDER=fedapay`
   - `PAYMENT_MODE=sandbox` *(puis `live`)*
   - `FEDAPAY_PUBLIC_KEY=...`
   - `FEDAPAY_SECRET_KEY=...`
   - `FEDAPAY_WEBHOOK_SECRET=...`
4. Dans votre tableau de bord FedaPay → **Webhooks**, ajoutez l’URL :
   ```
   https://VOTRE-DOMAINE/api/payments/webhook
   ```
   Événements conseillés : `transaction.approved`, `transaction.declined`, `transaction.canceled`, `transaction.refunded`.

---

## 4. Sauvegarde & Connexion GitHub

Le dépôt local est prêt et `.gitignore` protège vos fichiers `.env` sensibles. Pour publier sur votre compte GitHub :

```bash
git remote add origin https://github.com/VOTRE-COMPTE/djiffa-academy.git
git push -u origin main
```

---

## 5. Déploiement sur Render (Full-Stack Node + Express + React)

Le fichier **`render.yaml`** est inclus à la racine :

1. Connectez votre compte **Render** (`render.com`) à votre dépôt GitHub.
2. Sélectionnez **New → Blueprint** (ou **Web Service**) et choisissez votre dépôt `djiffa-academy`.
3. Vérifiez les commandes :
   - **Build Command** : `npm install && npm run build`
   - **Start Command** : `npm start`
4. Ajoutez vos variables d’environnement dans **Environment** (en reprenant `.env.example`), notamment :
   - `APP_URL=https://votre-domaine.com`
   - `ADMIN_EMAIL=faith.ariola@djiffa-agency.com`
   - `ADMIN_ACCESS_CODE=<votre-code-secret-fort>`
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - Vos clés FedaPay / KKiaPay / CinetPay
5. **Important Vite** : comme `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont intégrés au moment du build (`vite build`), renseignez-les **avant** de lancer le déploiement (ou déclenchez un *Manual Deploy → Clear build cache & deploy* après les avoir ajoutés).
6. Dans Render → **Settings → Custom Domains**, ajoutez votre nom de domaine (ex. `academy.djiffadesignagency.com`) et configurez l’enregistrement DNS CNAME/A indiqué par Render (HTTPS SSL automatique).
