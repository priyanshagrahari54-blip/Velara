# Rule: src/ui/, test/, security

## UI (src/ui/)
1. UI DOM ke alawa kuch mutate nahi karta — game state sirf `hooks` callbacks se.
2. Inline CSS hi use karo (CSP-compliant), external fonts/CDN mana hai.
3. Har user-visible string Hinglish mein (project ka tone).

## Tests (test/)
1. `browser-smoke.mjs` = release gate: **0 console errors** + full mission chain.
2. Physics tests headless (node) — fast, deterministic.
3. Test change bina reason ke kabhi skip/soften nahi.

## Security (project-wide)
1. Runtime pe **zero network calls** — game 100% offline hai.
2. CSP meta index.html mein hamesha rahe; Electron server bhi CSP header bhejta hai.
3. Electron: `contextIsolation + sandbox + no nodeIntegration`, navigation blocked,
   path-traversal guard internal server mein.
4. `eval`/`new Function`/remote scripts mana hai.
5. User input (touch/keys) kabhi DOM strings mein inject nahi hota.
