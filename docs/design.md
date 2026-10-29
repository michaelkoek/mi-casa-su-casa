# Design — Mi casa su casa

Richting: **warm, speels en snel** — bento-tegels met grote illustraties, één oranje accent. Een huis-app die je tien keer per dag met één hand opent.
Strak betekent hier: weinig kleur, veel ruimte, één duidelijke actie per scherm.

Klikbaar prototype en designsysteem: https://claude.ai/artifact/U4cMt91yRg9DMsaB5hm6e2

De toets voor elk scherm: kan iemand het zonder uitleg, met één hand, binnen vijf seconden?

## Navigatie

- Tabbalk onderaan met iconen (geen labels, wel aria-labels) en een oranje punt onder de actieve tab: **Vandaag · Huis · (+) · Geld · Kind**
- De ronde oranje plusknop zit in het midden van de tabbalk en opent een sheet met snelle acties (Uitgave, Taak, Klus, Medicijn)
- **Meer** (Eten, Agenda, Mail, Instellingen) zit achter de avatar linksboven
- Vandaag heeft tekst-tabs **Overzicht | Te doen**: actief = groter, vet en zwart
- Huis heeft een segmented control: **Huishouden | Klusjes**

## Het dashboard (Vandaag)

Geïnspireerd op een bento-layout met grote illustraties:

1. Kop: avatar, "Hoi Michael", datum, belletje met badge
2. **Hero-kaart** (oranje, 26 px radius) met het belangrijkste van nu: een open signaal ("Prullenbak vol" + knop "Ik doe het"), anders het avondeten. Rechts een grote platte illustratie die over de rand loopt
3. **Bento-grid**, twee kolommen met verschillende hoogtes (224 / 176 / 132 px): Huishouden (navy), Geld (blauw), Kind (roze), Klusjes (lila, met oranje badge "2 HOOG"), Agenda (mint), Eten (perzik)
4. Elke tegel: titel + één regel status linksboven, illustratie rechtsonder over de rand; tik = naar die module

## Interactie

- **Geen bevestigingsvensters.** Elke actie gebeurt direct, met een toast "Ongedaan maken" (5 s)
- **Optimistische UI**: afvinken, signaal geven en categoriseren tonen direct het resultaat
- **Invoer via bottom sheets** met slimme standaarden (vandaag, jij, laatst gebruikte categorie); sluiten door omlaag te vegen
- **Signaalknoppen**: één tik = signaal + push naar de ander; de knop blijft "open" tot iemand op Gedaan tikt
- **Lege staten** hebben één zin en één actie ("Nog geen klussen. Voeg de eerste toe.")
- **Laden**: skeletons in de vorm van de inhoud, geen spinners (uitzondering: pull-to-refresh-indicator)
- Touch targets minimaal 44 × 44 px

## Visuele stijl

| Token | Licht | Gebruik |
| --- | --- | --- |
| `--bg` | #ffffff | Canvas |
| `--surface` | #f5f4f1 | Lijsten, kaarten zonder moduletint |
| `--ink` / `--ink-2` / `--ink-3` | #17181f / #4f525e / #6c6f7c | Tekst |
| `--accent` | #e8743b | Badges, actieve punt, illustraties, vinkjes |
| `--accent-strong` | #c4521e | Knoppen met witte tekst (contrast ≥ 4.5:1) |
| `--hero` | #e26a2f | Hero-kaart; titel wit 22/700, subtekst donkerbruin |
| `--navy` | #1f2130 | Belangrijkste tegel (Huishouden), vandaag in het opvangrooster |
| `--tile-*` | blauw, roze, lila, perzik, mint | Eén zachte kleur per module |

- Eén accentkleur (oranje); de tegelkleuren zijn pastel en dragen nooit betekenis
- Illustraties: platte SVG, opgebouwd uit oranje, perzik, navy en de tegelkleuren; groot (90–150 px) en deels buiten de tegel
- Font: Geist voor alles (geen serif), `tabular-nums` (`.num`) voor bedragen en tijden
- Radius: knop 16, kaart 22, tegel 24, hero 26, sheet 30; plusknop rond
- Iconen: Phosphor, regular; actieve tab licht gevuld
- Geen emoji, geen gradients op tekst, geen puur zwart

## Beweging — alleen als het iets uitlegt

| Moment | Animatie | Duur |
| --- | --- | --- |
| Dashboard laden | Tegels schuiven 14 px omhoog, 40 ms na elkaar | 420 ms |
| Tekst-tab wisselen | Actieve tab schaalt naar 1,3× en kleurt zwart | 260 ms |
| Tab wisselen | Fade + 16 px in de richting van de tab; oranje punt groeit | 280 ms |
| Afvinken | Vinkje tekent zich, tekst grijs en doorgestreept | 260 ms |
| Signaal geven | Puls, tegel kleurt oranje, badge telt op | 340 ms |
| Plusknop / sheet | Plus draait naar kruis; sheet veert omhoog (`--ease-sheet`), sneller weg | 400 / 220 ms |
| Hero | Wisselt van signaal naar avondeten zodra het signaal gedaan is | 360 ms |
| Toast | Van onderen in, met Ongedaan maken | 300 ms |

Regels:

- Alleen `transform` en `opacity`; ease-out (`--ease-out`); nooit langer dan 420 ms
- De tegel-stagger alleen bij de eerste keer openen, niet bij verversen; geen eindeloze loops (uitzondering: pull-to-refresh-indicator)
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
