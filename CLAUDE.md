# Evan's Game Genie

Static Vite + React mobile web app showing Evan's game library, driven by his Google Sheet.

## ⚠️ THIS REPO IS PUBLIC

Everything committed here is visible on GitHub. Hard rules:

- **Never commit secrets**: no API keys, tokens, passwords, or `.env` files (`.gitignore` blocks the common patterns — do not bypass it).
- **Never commit personal data**: no emails, phone numbers, addresses, or private URLs. Commits use the GitHub noreply author email — keep it that way.
- Data enters the app **only** via `npm run refresh-data`, which bakes the sheet snapshot + Steam store data (scripts/fetch-data.mjs) and bg3.wiki companion intros (scripts/fetch-wiki.mjs) into `src/data/`. All of it is public information (game titles, scores, player counts, CC BY-SA wiki text). Both sources are keyless — if a future data source requires a key, stop and rework the approach with the user; do not put the key in this repo.

## How it works

- `src/data/sheet-snapshot.csv` + `games-meta.json` — baked by the refresh script.
- `src/data/meta-overrides.json` — hand-edited details for console exclusives (not on Steam).
- `src/data/ign-overrides.json` — hand-maintained IGN scores.
- `src/data/wiki-companions.json` — BG3 companion intros baked from bg3.wiki (CC BY-SA 4.0; attributed in-app). Run standalone with `npm run refresh-wiki`.
- Deploys automatically to GitHub Pages on push to `master` (.github/workflows/deploy.yml).
- Update loop: edit sheet → `npm run refresh-data` → commit → push.
