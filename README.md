# DJIFFA ACADEMY

Plateforme officielle de formation en ligne de **DJIFFA DESIGN AGENCY**, fondée et dirigée par **Faith Ariola**.

---

## Architecture Technique

- **Frontend** : React 19 + TypeScript + Tailwind CSS v4 + Vite
- **Backend** : Express (`server.ts`, port `3000`) servant le build SPA en production et les routes API sécurisées :
  - `/api/health` & `/api/infrastructure/status`
  - `/api/auth/admin-verify` & `/api/auth/admin-session` (jetons HMAC-SHA256 signés côté serveur)
  - `/api/payments/create-session`, `/api/payments/verify`, `/api/payments/webhook`, `/api/payments/refund` (**FedaPay**, **KKiaPay**, **CinetPay**)
  - `/api/media/signed-url` & `/api/media/upload-url` (URL signées Supabase Storage avec contrôle d’inscription)
  - `/api/supabase/migrate`, `/api/supabase/admin-data`, `/api/supabase/admin-action`
- **Base de données, Auth & Stockage** : Supabase (PostgreSQL + RLS + Supabase Auth + Buckets `brand-assets`, `course-pdfs`, `course-videos`) avec mode local de secours transparent si les variables ne sont pas encore renseignées.
- **Hébergement Vidéo multi-sources** : Lecteur compatible Android/Desktop supportant Supabase Storage privé (`sb://course-videos/...`), Bunny Stream, Cloudflare Stream, Vimeo, YouTube et MP4/CDN.

---

## Démarrage rapide en local

```bash
npm install
cp .env.example .env
# Renseignez vos variables dans .env (optionnel : fonctionne aussi en mode local sans clés)
npm run dev
```

Application disponible sur `http://localhost:3000`.

## Vérification & Build de production

```bash
npm run lint
npm run build
NODE_ENV=production npm start
```

Consultez **`DEPLOYMENT.md`** pour le guide complet de mise en ligne (Supabase, GitHub, Stockage Vidéo, FedaPay, Render et nom de domaine personnalisé).
