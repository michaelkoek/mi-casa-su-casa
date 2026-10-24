# Design — Mi casa su casa

Richting: **rustig, warm en snel**. Een huis-app die je tien keer per dag met één hand opent.
Strak betekent hier: weinig kleur, veel ruimte, één duidelijke actie per scherm.

Klikbaar prototype en designsysteem: https://claude.ai/artifact/U4cMt91yRg9DMsaB5hm6e2

De toets voor elk scherm: kan iemand het zonder uitleg, met één hand, binnen vijf seconden?

## Navigatie

- Tabbalk onderaan, vijf tabs: **Vandaag · Huis · Geld · Kind · Meer** (Meer = Eten, Agenda, Mail, Instellingen)
- Eén zwevende plusknop rechtsonder boven de tabbalk: opent een sheet met snelle acties (Uitgave, Taak, Klus, Medicijn)
- Huis heeft een segmented control: **Huishouden | Klusjes**
- Geen hamburgermenu, geen acties bovenin het scherm

## Interactie

- **Geen bevestigingsvensters.** Elke actie gebeurt direct, met een toast "Ongedaan maken" (5 s)
- **Optimistische UI**: afvinken, signaal geven en categoriseren tonen direct het resultaat
- **Invoer via bottom sheets** met slimme standaarden (vandaag, jij, laatst gebruikte categorie); sluiten door omlaag te vegen
- **Signaalknoppen**: één tik = signaal + push naar de ander; de knop blijft "open" tot iemand op Gedaan tikt
- **Lege staten** hebben één zin en één actie ("Nog geen klussen. Voeg de eerste toe.")
- **Laden**: skeletons in de vorm van de inhoud, geen spinners
- Touch targets minimaal 44 × 44 px

## Visuele stijl

| Token | Licht | Donker | Gebruik |
| --- | --- | --- | --- |
| `--bg` | #f6f4f1 | #12110f | Achtergrond |
| `--surface` | #ffffff | #1c1a17 | Kaarten, sheets |
| `--ink` / `--ink-2` / `--ink-3` | stone 900 / 600 / 400 | omgekeerd | Tekst |
| `--accent` | #2f6b5e (pine) | #6fb3a2 | Primaire acties, actieve tab, voortgang |
| `--ok` `--warn` `--bad` | | | Alleen betekenis (budget over, dosis te vroeg) |

- Eén accentkleur. Modules herken je aan icoon en titel, niet aan kleur
- Font: Geist voor alles, `tabular-nums` (`.num`) voor bedragen en tijden; geen serif
- Radius: 10 / 14 / 20 px, sheets 28 px bovenhoeken
- Kaarten alleen waar groepering helpt; anders scheiden met witruimte of een 1px-lijn
- Schaduw: zachte, getinte diffusieschaduw (`--shadow-card`), nooit glow
- Iconen: Phosphor, regular; fill alleen voor de actieve tab
- Geen emoji, geen gradients op tekst, geen puur zwart

## Beweging — alleen als het iets uitlegt

| Moment | Animatie | Duur |
| --- | --- | --- |
| Tab wisselen | View Transition: crossfade + 12px horizontale verschuiving in de richting van de tab | 220 ms |
| Kaart → detail | Gedeeld element (`layoutId` / view-transition-name) | 300 ms |
| Afvinken | Vinkje tekent zich, rij vervaagt en de lijst schuift dicht (`layout`) | 220 ms |
| Signaal geven | Knop schaalt 0.96 → 1 en krijgt de "open"-staat; badge telt op | 150 ms |
| Bottom sheet | Veer omhoog (stiffness 400, damping 36), wegvegen met slepen | — |
| Toast | Van onderen in, na 5 s weg | 220 ms |

Regels:

- Alleen `transform` en `opacity`; ease-out (`--ease-out`); nooit langer dan 300 ms
- Geen animatie bij data laden, geen eindeloze loops
- `prefers-reduced-motion`: alles uit (staat al in `globals.css`)

## PWA

- Manifest: naam "Mi casa su casa", short name "Mi casa", `display: standalone`, maskable icons, theme color per kleurschema
- App shortcuts (lang indrukken van het icoon): Prullenbak vol · Uitgave toevoegen · Medicijn geven
- Web Push voor signalen en afspraken; Badging API met het aantal open signalen
- Serwist: app-shell offline; acties offline in een wachtrij
- Installatie: eigen prompt op Android; uitlegsheet op iPhone (Deel → Zet op beginscherm) — push werkt daar pas na installatie
- `viewport-fit=cover` + `env(safe-area-inset-*)` overal waar iets tegen de rand staat

## Taal

Kort, menselijk, jij-vorm. "Prullenbak vol" in plaats van "Signaal: afvalbak heeft lediging nodig".
Alle tekst via `messages/nl.json`.
