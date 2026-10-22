# Data Center Tycoon

An idle/tycoon game that runs as an **offline iPhone PWA**. Buy servers, balance power against heat, take contracts, research upgrades, then IPO and do it again.

Vanilla HTML/CSS/JS. No build step, no frameworks, no CDNs, no web fonts — everything is in this folder and works with no internet.

## Deploy on GitHub Pages

1. Push this folder to the repo's `main` branch (files must be at the repo root).
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `/ (root)` → Save**.
3. After a minute the game is live at `https://<your-username>.github.io/DataCenterTycoon/`.

All paths are relative, so it works under that sub-path.

## Install on iPhone (do this BEFORE the flight)

1. Open the Pages URL in **Safari** while online.
2. Tap **Share → Add to Home Screen → Add**.
3. Launch the game **once from the home-screen icon while still online** so the service worker finishes caching every file.
4. Test it: switch on Airplane Mode and open the icon again. It should start instantly.

Installing to the home screen (rather than just using a Safari tab) also stops iOS from clearing the save after a week of inactivity.

## Updating the game

The service worker is cache-first, so a changed file will not show up until the cache name changes. After editing any file, bump `VERSION` in `sw.js` (`dct-v1` → `dct-v2`), push, then open the app online twice (the first load installs the new cache, the second uses it).

## Playing

- **Servers**: tap *Deploy Manually* early on, then buy servers. Each one adds compute (= income) but also uses power and makes heat.
- **Power over capacity** → servers go offline (red). **Heat over cooling** → servers throttle (orange). Keep both bars under 100% via the **Infra** tab.
- **Contracts**: a client offer arrives about every 45 s (max 3). Accepting reserves compute for the duration and pays a large bonus.
- **Events** every 2–4 min: DDoS (tap the alert 10×), Power Surge (tap to reset), AI Boom (2× income), Heatwave (cooling −30%).
- **Research**: points accrue from compute. 12 one-time upgrades (PUE, server output, contract payouts, offline cap, auto-accept, auto-fix).
- **IPO**: resets the run, keeps Shares (≈ √(run earnings ÷ $100M)). Each Share = +5% permanent income. Expect the first worthwhile IPO around 40–50 minutes.
- Owning 25 / 50 / 100 of a server doubles its output each time. 22 achievements give small permanent bonuses.
- Offline earnings are capped at 2 h (upgradeable in Research).

## Saving

Saves to `localStorage` every 5 s and whenever the app is backgrounded. **Settings → Export** gives a text code; paste it into the box and tap **Import** to restore it. Copy/paste and text selection are disabled everywhere else to make the app feel native; the save box is the only exception.

## Debug mode

Open the page with `?debug=1` (e.g. `index.html?debug=1`): game speed ×10, a **+$1B** button in Settings, and `window.dct` in the console.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `style.css`, `game.js` | The game |
| `sw.js` | Cache-first service worker (bump `VERSION` on every release) |
| `manifest.json`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | PWA install metadata and icons |

## Tuning

Balance lives at the top of `game.js`: `TIERS`, `POWERS`, `COOLS`, `RES` tables, plus `BASE_POW`, `BASE_COOL`, `IPO_DIV` (Share curve) and `RP_K` (research speed).
