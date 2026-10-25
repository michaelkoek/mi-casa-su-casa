# Mi casa su casa

Huishoud-PWA voor Michael en zijn vriendin: één app op beide telefoons voor huishouden, klusjes, geld, kind, eten, agenda en (later) mail.
Next.js 16 (App Router) + Neon (Postgres) + Drizzle + Better Auth (inloggen met een code per mail) + Serwist (PWA) + Web Push.

Scope en werkwijze staan in `CLAUDE.md`, het ontwerp in `docs/design.md`.

## Lokaal draaien

1. `npm install`
2. `cp .env.example .env.local` en vul de dev-waarden in (zie `.env.example`). Gebruik de Neon-branch `dev`.
3. `npm run db:migrate` maakt de tabellen aan.
4. `npm run db:bootstrap -- --demo --name "Test" --member "Michael=jij@voorbeeld.nl" --member "Partner=partner@voorbeeld.nl"` maakt een huishouden met voorbeelddata. Zonder `--demo` krijg je de lege startset.
5. `npm run dev`, open http://localhost:3000 en log in met een van de e-mailadressen. Zonder `GMAIL_APP_PASSWORD` staat de code in de serverlog.

Meldingen en de service worker testen lokaal: `NEXT_PUBLIC_ENABLE_SW_IN_DEV=true` en `npm run dev:https`.

## Scripts

| Script | Doel |
| --- | --- |
| `npm run dev` / `dev:https` | Ontwikkelen (met of zonder https) |
| `npm run build` / `start` | Productie-build en -server |
| `npm run lint` | ESLint |
| `npm test` | Vitest (pure logica in `src/lib`) |
| `npm run db:generate` | Migratie maken uit `src/db/schema.ts` |
| `npm run db:migrate` | Migraties uitvoeren (gebruikt `DATABASE_URL_UNPOOLED`) |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:bootstrap` | Huishouden aanmaken (`--name`, `--member "Naam=mail"` 1 tot 4 keer, optioneel `--demo`) |

## Deploy-checklist

1. Neon: project (Londen, eu-west-2) met branches `production` en `dev`. Kopieer van beide de gepoolde URL (`DATABASE_URL`) en de directe URL (`DATABASE_URL_UNPOOLED`).
2. Lokaal: `cp .env.example .env.local`, vul de dev-waarden in, daarna `npm run db:migrate` en `npm run db:bootstrap -- --demo ...`.
3. VAPID-sleutels: draai één keer `npx web-push generate-vapid-keys`. Gebruik dezelfde sleutels in elke omgeving.
4. Gmail: zet 2FA aan op het Google-account, maak een app-wachtwoord (myaccount.google.com/apppasswords) en zet `GMAIL_USER` en `GMAIL_APP_PASSWORD`.
5. Vercel:
   - importeer de repo; framework Next.js; Functions-regio `lhr1`
   - omgevingsvariabelen: Production naar Neon `production`; Preview en Development naar Neon `dev`
   - `BETTER_AUTH_URL` alleen voor Production (de productie-URL); Preview valt terug op `https://$VERCEL_URL`
   - `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`
6. Productiedatabase, vanaf je eigen machine:
   - `DATABASE_URL_UNPOOLED=<production> npm run db:migrate`
   - daarna `npm run db:bootstrap -- --name "<naam>" --member "Michael=<mail>" --member "<naam>=<mail>"` met de productie-URL's
   - elke schemawijziging daarna: `npm run db:generate`, committen, en de productiedatabase migreren *voordat* je pusht.
7. Push naar `main`, Vercel deployt.
8. Op beide telefoons: open de URL, zet de app op het beginscherm, log in *in de geïnstalleerde app*, ga naar Instellingen, zet Meldingen aan en tik op Testmelding.
