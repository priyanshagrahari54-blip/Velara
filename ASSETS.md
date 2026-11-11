# ASSETS.md — Velara Asset Registry (licence-safe, master-spec rule 5)

> In-game CREDITS isi file se aate hain (pause menu). Rule: sirf CC0/permissive
> ya self-made procedural assets — licence-unknown file kabhi commit nahi hoti.

## Registry
| Asset | Source | Author | Licence | Used for |
|-------|--------|--------|---------|----------|
| Facade textures ×4 (windows + emissive) | procedural canvas (`src/world/city.js`) | VELARA team | CC0 (self-made) | Building walls, lit windows |
| Road/sidewalk/stripe/wood/money/neon/storefront/billboard/signal textures | procedural canvas (`src/world/city.js`, `src/ui/ui.js`) | VELARA team | CC0 (self-made) | World dressing, HUD |
| Vehicles, pedestrians, props, metro, city geometry | procedural three.js geometry | VELARA team | CC0 (self-made) | Everything visible |
| Audio (engine/ambience) | WebAudio synthesis | VELARA team | CC0 (self-made) | Sound |
| HUD font | system font stack | OS vendor | n/a (system) | HUD text |
| Asphalt007 (1K-JPG) | [ambientCG](https://ambientcg.com/view?id=Asphalt007) | Lennart Demes (ambientCG) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Road + ground albedo |
| Concrete034 (1K-JPG) | [ambientCG](https://ambientcg.com/view?id=Concrete034) | Lennart Demes (ambientCG) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Sidewalk / podium albedo |
| streetlamp.glb ULTRA (cobra streetlight — high→low normal+AO bake, roughness wear, emissive lens; 58.7KB Draco) | factory/make-streetlamp-ultra.py — Blender asset-factory (codespace/Colab) | VELARA team | CC0 (self-made) | Night-phase hero prop |
