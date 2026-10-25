# Mi casa su casa

@AGENTS.md

Huishoud-PWA voor Michael en zijn vriendin: één app op beide telefoons voor huishouden, klusjes, geld, kind, eten, agenda en (later) mail.
Volledig bouwplan: https://claude.ai/artifact/Gc94FnDWwkzxW28R1UHJtS — lees het bij twijfel over scope.

## Scope v1 (in deze volgorde bouwen)

1. **Fundament** — Neon + Drizzle schema met households, magic-link-login, next-intl, PWA (Serwist), Web Push, deploy op Vercel
2. **Huishouden en signalen** — terugkerende taken met roulatie; signaalknoppen ("prullenbak vol") met pushmelding
3. **Bankkoppeling en uitgaven** — Enable Banking (beperkte modus, eigen rekeningen), dagelijkse import, categorieregels, budget per maand
4. **Kind** — opvang/oppasrooster, medicijnen + koorts met "volgende dosis vanaf", afspraken, dagritme, eten, groei, mijlpalen, voorraad, kledingmaat
5. **Klusjes** — backlog per ruimte (afmaken / onderhoud), prioriteit, kosten, materialen
6. **Eten** — recepten, weekmenu, boodschappenlijst
7. **Agenda en Vandaag** — gedeelde agenda via iCal-link (alleen lezen), overzichtsscherm

Niet in v1: mailsamenvatting, sparen/beleggen, UI om andere huishoudens uit te nodigen, verdeling van kosten tussen personen.

Een fase is pas klaar als hij een week echt gebruikt is (zie de gates in het bouwplan).

## Stack

- Next.js 16 (App Router, Server Components, server actions) + TypeScript — lees eerst `node_modules/next/dist/docs/` voor API's die je niet zeker weet
- Tailwind CSS v4; tokens staan in `src/app/globals.css` (`@theme inline`); fonts Geist + Geist Mono via het `geist`-pakket (lokaal, werkt offline)
- Neon Postgres + Drizzle ORM + drizzle-kit migraties
- Auth: magic link (Better Auth of Auth.js)
- next-intl, alleen locale `nl`, teksten in `messages/nl.json`
- Motion (`motion/react`) voor layout- en sheet-animaties; View Transitions voor paginawissels
- Iconen: `@phosphor-icons/react`, één gewicht (regular; fill voor actieve tab)
- Tests: Vitest voor pure logica, Playwright voor kernflows
- Hosting: Vercel (Hobby, persoonlijk gebruik), Vercel Cron voor bank-import

## Huidige stand: klikbaar prototype

- Alle schermen werken op lokale data: `src/lib/store.tsx` (localStorage, één toestel) met pure updaters in `src/lib/actions.ts` en logica in `src/lib/logic.ts`
- Voorbeelddata in `src/lib/seed.ts`; types in `src/lib/types.ts` zijn de basis voor het Drizzle-schema
- Fase 1 vervangt de store door server actions op Neon; de schermen praten alleen via `useHousehold()` en de updaters

## Harde regels

- **Multi-household vanaf dag één**: elke tabel heeft `household_id`; elke query loopt via de gedeelde data-access helper die filtert op het huishouden van de ingelogde gebruiker. Nooit een `household_id` uit de client vertrouwen.
- Bedragen altijd in centen (integer); tijden als `timestamptz`.
- Geen hardcoded UI-tekst: altijd een key in `messages/nl.json`.
- Mobiel eerst (375 px), duimzone onderaan, safe-area-insets respecteren.
- Secrets (DATABASE_URL, Enable Banking private key, VAPID private key) alleen server-side.
- Geen nieuwe dependency zonder het eerst te vragen.
- Elke feature met tests voor de pure logica (bijv. `nextAssignee()`, `nextDoseAllowedAt()`, categorieregels).

## Design

Lees `docs/design.md` vóór je UI bouwt. Gebruik de skills `frontend-design` en `design-taste-frontend`, met deze projectinstellingen voor `design-taste-frontend`:

- DESIGN_VARIANCE: 3 (dagelijkse app, voorspelbaar)
- MOTION_INTENSITY: 4 (alleen beweging die iets uitlegt; geen eindeloze loops of perpetual micro-animaties)
- VISUAL_DENSITY: 4

## Werkwijze

- Nieuwe feature: `/ship <feature>` (planner → coder → tester → reviewer, op een feature-branch). `plan-only <feature>` voor alleen een spec.
- Begin grote stappen in plan mode; één fase per sessie.
- Gebruik een aparte Neon-branch voor ontwikkeling.

## Commando's

- `npm run dev` — lokaal ontwikkelen
- `npm run build` — productie-build
- `npm run lint` — ESLint
- `npm test` — Vitest (pure logic in `src/lib`)
