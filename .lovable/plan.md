# Omoggle.com Pixel-Exact Redesign Plan

Goal: rebuild the visual layer of all 8 attached screens to match omoggle.com, while keeping the **UNMOGGLE** wordmark and all existing scoring / multiplayer / Supabase logic untouched.

This is a visual + layout refactor. No backend, no database changes, no scorer changes.

---

## Phase 1 — Foundation (shared)

1. **Fonts** — add the same monospace/display stack omoggle uses (JetBrains Mono / IBM Plex Mono for the all-caps labels, plus a heavy display sans for headings). Wire into `tailwind.config.ts` + `index.css`.
2. **Design tokens** — refresh `index.css` HSL tokens to match omoggle's palette (deep near-black backgrounds, violet/purple accents, cyan + emerald + amber + red status colors, soft glassy card surfaces).
3. **Shared primitives** — `<GlassCard>`, `<PillBadge>`, `<UppercaseLabel>` so every page reuses the same tile look.

## Phase 2 — Per-screen rebuilds

Each item = one screen rebuilt to its screenshot:

1. **Home (`/`)** — image-5: badge → wordmark → online pill → big "ENTER THE ARENA" tile → 3 step tiles → **add "VIEW LEADERBOARD" + "JOIN DISCORD" tiles** (currently missing) → footer micro-copy line.
2. **Camera Check (`/camera-check`)** — image-6: centered glass panel, "CAMERA ACCESS CHECK" heading, "SHORT-LIVED SESSION CHALLENGE" subtitle, dark video frame with cyan ring spinner, ALIGN/BLINK/TURN/DONE step bar, legal copy, EXIT pill button.
3. **Arena hub (`/arena`)** — image-7: top "HOW TO MOG?" pill (left), centered "SEASON 1" + "PLAY ON ROOBET" stack, avatar (right). 4 large tiles: GLOBAL RANK, 1V1 ARENA (with stats sub-card), CUSTOMS (NEW), THE LAB. Below: 6 social tiles (Discord, TikTok, Instagram, Reddit, YouTube, X).
4. **Tile hover (image-8)** — coloured glow + lift on each tile, matching the gold/teal/violet/etc. accents per tile.
5. **Leaderboard (`/leaderboard`)** — image-9: countdown card top-center, GLOBAL ARENA / SEASON 1 toggle, big "LEADERBOARD" title, top-3 podium cards (gold #1 raised, silver #2, bronze #3) with avatar/elo/wins/public-appeal, list of #4+ rows with elo bar, right-side RANK TIERS column.
6. **1v1 entry popup (image-10)** — modal: camera icon, "ADD YOUR PROFILE PHOTO" headline, body copy, "GO TO PROFILE →" CTA, close X. Shown when entering 1v1 without a photo.
7. **Settings (image-11)** — full account modal: avatar + identity header with ELO/WINS/SEASON stat cards, Profile Identity (display name, photo/upload, email), Trophy Case toggles, Country select, Camera Settings (ring light), right column: Replay Settings, Subscription, Purchase History, Discord Role Sync, Account Actions (Sign Out / Delete).
8. **Connecting (image-12)** — minimal centered hex spinner, "CONNECTING..." mono heading, tagline, FIND NEW MATCH + RETURN TO MENU pill buttons.
9. **Brutalized / scoring overlay (image-14)** — replaces current 1v1 result panel: huge red "BRUTALIZED" gradient title, "BY <opponent>" subtitle, side-by-side YOU / OPPONENT score cards (loser tile glows red), VS chip, action stack (FIND NEW MATCH, REMATCH & CHAT, RETURN TO MENU, REPORT OPPONENT), 1–10 RATE OPPONENT row, VIEW MATCH ANALYSIS pill, clip-mode hint. Also restyle in-match telemetry ("OVERALL SCORE / SCANNING…" top-left + readout chip top-right).

## Phase 3 — QA pass

Browser screenshots of every route at 1470×886 + mobile width, compare against the uploaded references, fix layout drift.

---

## Technical Details

- Stack stays React 18 + Vite + Tailwind + wouter. No router or state changes.
- All colors via HSL semantic tokens in `index.css`; no raw hex in components.
- Fonts loaded via `<link>` in `index.html` (Google Fonts: `JetBrains Mono`, plus a display like `Archivo Black` / `Anton` / `Bebas Neue` to mimic omoggle's heavy sans).
- Existing files updated (no new routes): `home.tsx`, `camera-check.tsx`, `arena.tsx`, `leaderboard.tsx`, `live-arena.tsx`, `profile.tsx`, plus shared `page-shell.tsx` / new components in `src/components/`.
- Wordmark text stays `UNMOGGLE` everywhere per your decision.
- 1v1 multiplayer wiring (Supabase channels, scorer broadcast) is left as-is — only the visuals around it change.

## Delivery order

I'll ship in 3 commits so you can review as we go:
- **Commit A:** Phase 1 foundation + Home + Camera Check + Connecting (smallest, sets the visual language).
- **Commit B:** Arena hub + tile hovers + Leaderboard + 1v1 entry popup.
- **Commit C:** Settings modal + Brutalized result screen + in-match telemetry restyle + final QA pass.

After you approve this plan I'll start with Commit A.
