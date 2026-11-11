# Rule: src/engine/ — Engine Layer

**Scope:** `src/engine/**` (renderer, quality, input, camera, physics world factory)

1. **No gameplay knowledge.** Engine modules ko missions, money, health, traffic
   ke baare mein kuch nahi pata hona chahiye. State read hota hai injected
   getters se (`getMode()`, `isPlaying()`), kabhi direct game object se nahi.
2. **No DOM** except `renderer.domElement` (canvas) aur `window` events.
   UI/DOM sirf `src/ui/` mein.
3. **Deterministic APIs** — same inputs, same behaviour. `Math.random()` engine
   modules mein mana hai (world/ gameplay mein allowed).
4. Har export documented hai: kya karta hai, kya return karta hai.
5. Performance-sensitive loops mein per-frame allocations avoid karo
   (reusable vectors/arrays).
