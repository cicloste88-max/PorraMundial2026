# WhatsApp — Porra Mundial 2026

## Estado actual

Sistema de notificaciones WhatsApp en fase **Twilio sandbox**. Los usuarios se suscriben enviando el código `join load-herd` al número público **+14155238886**.

Edge Functions implicadas (descripciones extendidas en `docs/architecture.md`):

- `porra-whatsapp-send` v2 — envío via Twilio (form-urlencoded fetch).
- `porra-whatsapp-webhook` v5 — webhook entrada WhatsApp.
- `porra-apify-webhook` v8 — detecta cambios en partidos y dispara notificaciones Twilio directas.

## Notificaciones configuradas

Eventos del partido que disparan mensajes:

- 🟢 Arranca el partido
- ⏸ Descanso (con marcador)
- 🟢 Segunda parte
- ⚽ Gol — jugador, minuto y marcador
- ⚡ Prórroga
- 🤽 Penaltis
- 🏁 Fin del partido

## Migración pendiente a Meta Business

Migración del sandbox Twilio → producción Meta Business actualmente bloqueada por error **63016** (sandbox parked). Requerida antes del 11 jun 2026 para escalar fuera del límite del sandbox.

## Secrets relacionados

Credenciales Twilio en **Supabase Vault** (nunca hardcodear en código ni docs):

- `TWILIO_ACCOUNT_SID`
- `TWILIO_API_KEY`
- `TWILIO_API_SECRET`

Detalle de gestión de secrets (Vault vs EF secrets) en `docs/architecture.md` §Secrets.
