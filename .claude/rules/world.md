# Rule: src/world/ — World Layer

**Scope:** `src/world/**` (city, environment, traffic)

1. **Guaranteed-clear spawn areas** — jis block mein player spawn hota hai wahan
   kabhi random building nahi (TDZ/deep-penetration lesson — ADR-003).
2. Static bodies = `staticBox()` helper se; ground hamesha **BOX** hai, Plane nahi (ADR-002).
3. Light budget: point lights < 40 total. Har naya light `env` intensity se
   gated hona chahiye (din mein off).
4. Textures canvas-generated, `SRGBColorSpace` + `RepeatWrapping` set karo.
5. Traffic = dynamic servo bodies (finite mass). Kinematic bodies kabhi nahi —
   infinite-mass launches (ADR-004).
