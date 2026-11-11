# Rule: src/gameplay/ — Gameplay Layer

**Scope:** `src/gameplay/**` (player, vehicle, missions)

1. **No renderer/scene imports** — gameplay physics-first hai; visuals sync
   hote hai apne hi mesh se, par postFX/renderer ko touch nahi karte.
2. **Tuning constants top par named** (MAX_FORCE, WALK, JUMP_V…) — magic
   numbers spread nahi hone chahiye.
3. Vehicle/player behaviour change = **test update required**:
   `test/final-check.mjs` / `test/player-test.mjs` pehle ya saath mein.
4. Physics stability invariants:
   - koi bhi force **center of mass** pe lagta hai jab tak lever arm intended na ho
     (ADR-001 ka lesson).
   - angular velocity clamp + speed governor kabhi remove mat karo.
5. Missions read-only game state use karte hain; UI sirf injected `ui` se.
