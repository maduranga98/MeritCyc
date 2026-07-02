# MeritCyc

Merit-based salary increment management for companies. Run fair, transparent,
data-driven increment cycles with budget simulation, manager/HR evaluations,
career paths, and pay-equity analytics.

**Stack**: React 19 + TypeScript + Vite + Tailwind CSS 4, Firebase (Auth,
Firestore, Cloud Functions, Storage, Hosting), i18next (EN/FR).

## Features

- **Roles**: super admin, HR admin, manager, employee — each with a scoped
  dashboard and navigation.
- **People management**: employee directory (with CSV export), departments,
  salary bands, invites, QR self-registration, HR approval workflows.
- **Increment cycles**: 4-step create wizard, criteria builder with templates,
  tier configuration, budget settings, finalize flow.
- **Budget simulation**: what-if scenario builder with distribution and
  threshold sliders, apply-to-cycle.
- **Evaluations**: manager scoring, HR score review and overrides with audit
  logging, deadline reminders.
- **Employee experience**: career map, increment stories, improvement
  recommendations, real-time cycle progress.
- **Analytics**: executive dashboard, department drill-down, fairness / pay
  equity dashboard with PDF export, branded cycle summary PDFs, audit trail
  with CSV export.
- **Global search**: Ctrl/Cmd+K command palette — jump to any page, or search
  employees by name/email/title (admins).
- **Billing**: plan configuration and trial handling.
- **Localization**: full English and French translations.

## Getting started

```bash
npm install
cp .env.example .env   # fill in values from the Firebase console
npm run dev
```

Firebase config values live in `.env` (see `.env.example`). The app fails fast
at startup with a clear error if any are missing.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run lint` | ESLint (0 errors, 0 warnings expected) |
| `npm test` | Vitest unit tests |
| `npm run preview` | Serve the production build locally |

## Deployment

Hosting, Firestore rules/indexes, Storage rules, and Cloud Functions are all
configured in `firebase.json`.

```bash
npm run build
firebase deploy               # hosting + rules + functions
# or selectively:
firebase deploy --only hosting
firebase deploy --only firestore:rules,storage
firebase deploy --only functions
```

### Production checklist

- [ ] `.env` populated with the **production** Firebase project's web config.
- [ ] Cloud Functions deployed (`functions/` — Node 24). All Firestore writes
      go through Functions; client writes are denied by rules.
- [ ] Firestore rules + indexes deployed (`firestore.rules`,
      `firestore.indexes.json`).
- [ ] Storage rules deployed (`storage.rules` — image-only uploads, 5 MB cap).
- [ ] Auth providers enabled in the Firebase console (email/password, Google)
      and the production domain added to authorized domains.
- [ ] SMTP credentials configured for the mail-sending Functions (nodemailer).
- [ ] Custom claims (`role`, `companyId`) are set by the registration/approval
      Functions — verify a full signup → approval flow end-to-end.
- [ ] Run through `MANUAL_TEST_CHECKLIST.md` on a staging project.

Hosting is configured with security headers (nosniff, `X-Frame-Options: DENY`,
HSTS, Referrer-Policy, Permissions-Policy), immutable caching for hashed
assets, and no-cache for `index.html`.

## Project structure

```
src/
  components/   # shared UI + feature components (layout, cycles, people, …)
  pages/        # route-level pages grouped by domain
  services/     # Firestore/Functions data access layer
  stores/       # zustand stores
  context/      # auth context
  hooks/        # shared hooks (idle timeout, …)
  locales/      # en/fr translations
  types/        # domain types
functions/      # Firebase Cloud Functions (all privileged writes)
```
