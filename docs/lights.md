# Lampen: Shelly en Hue

Lampen lopen via de cloud van de leverancier, vanaf de server. Vercel kan niet bij het thuisnetwerk.

## Status van de controle

| Onderdeel | Bron | Getest tegen het echte apparaat |
| --- | --- | --- |
| Shelly `set/switch` en `get` | Officiële docs | Ja, 2 november 2026: S3SW-001P16EU aan en uit, 92-100 ms per call vanaf thuis (nog niet gemeten vanaf Vercel) |
| Shelly `set/light` | Officiële docs | Nog niet: geen dimbaar apparaat getest |
| Shelly-statusvelden `switch:0` en `output` | Gen2+ RPC | Ja, 2 november 2026 |
| Shelly-statusvelden `light:0` en `brightness` | Gen2+ RPC, niet in de cloud-docs bevestigd | Nog niet |
| Hue `/v2/oauth2/authorize` en `/v2/oauth2/token` met Basic auth | Uit het hoofd | Deels, 2 november 2026: authorize stuurt door naar de Hue-login, token accepteert de app-gegevens en weigert alleen de nepcode. Echte tokens nog niet |
| Hue `/route/api`, `/route/clip/v2` | Uit het hoofd: de docs staan achter een login | Nog niet |
| Hue-limiet van 50.000 calls per dag en goedkeuring van de app | Eén open-source issue, onbevestigd | Nog niet |

Controleer `src/lib/server/lights/hue.ts` tegen de Hue-docs als het koppelen mislukt. Alle Hue-paden staan in dat bestand.

## Instellen

1. `openssl rand -base64 32` en zet de uitkomst als `LIGHTS_TOKEN_KEY` in `.env.local` en op Vercel. Gebruik niet dezelfde sleutel als `BANK_TOKEN_KEY`.
2. Hue: registreer een Remote API-app op developers.meethue.com met callback `https://<productiedomein>/api/lights/hue/callback`. Zet `HUE_CLIENT_ID` en `HUE_CLIENT_SECRET` op Vercel. De callback is geregistreerd op één domein, dus Hue koppelen werkt niet vanaf localhost.
3. Shelly: vul in de app onder Huis, Lampen de server en sleutel in uit de Shelly-app (Gebruikersinstellingen, Authorization cloud key) en voeg apparaten toe met hun ID.

## Grenzen

- Shelly: één call per seconde per account, gedeeld door beide telefoons. De schuifregelaar wacht daarom 1,1 seconde voor hij verstuurt, en een call die 429 krijgt wordt tot twee keer herhaald met 1,1 seconde ertussen. Elk verzoek om status leest maximaal 10 apparaten.
- De Shelly-sleutel verandert als het wachtwoord verandert. De app toont dan "Koppeling verlopen".
- Status wordt opgehaald bij het openen en via de verversknop, niet live.
- Hue-tokens roteren bij elke refresh. De kolom `refresh_lease_until` zorgt dat maar één aanroeper tegelijk ververst (`neon-http` heeft geen transacties). De cron `/api/cron/lights` ververst 48 uur voor het einde en stuurt één push als opnieuw koppelen nodig is.
