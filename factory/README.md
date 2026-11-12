# VELARA Design Team (Asset Factory)

**Team (DM + 4 designers):**
| Worker | Role | Autonomy |
|--------|------|----------|
| sandbox (DM) | queuebharta, verify, ASSETS.md, game-integrate | har turn |
| **actions-cpu** (designer.yml) | Blender CPU, unlimited, **24/7 cron (6-hourly)** | poori — khud commit [skip ci] |
| **colab-gpu** (notebook) | T4 heavy bakes (2048px) | GHTOKEN secret ho to khud push, warna tmate-pull |
| **kaggle-gpu** (kaggle/VELARA-Designer.ipynb) | P100/T4x2 | GHTOKEN secret se khud push |
| **codespace** | interactive debug + heavy jobs | assistant ssh se |

**Queue system:** `factory/queue/<id>.json` — {id, script, args, brief, status, priority}.
`pending -> running (claim) -> done/failed`. Results `factory/out/` mein, workers khud
commit karte hain (`[skip ci]`), DM review karke `public/assets/` + game mein integrate karta hai.

**Dispatch (DM se):**
```bash
TOKEN=$(tr -d '[:space:]' < .ghtoken)
# manual: specific jobs
curl -s -X POST -H "Authorization: Bearer $TOKEN"   "https://api.github.com/repos/priyanshagrahari54-blip/Velara/actions/workflows/designer.yml/dispatches"   -d '{"ref":"main","inputs":{"jobs":"velara-gt,pico-s"}}'
# ya "next" (queue se 2): -d '{"ref":"main","inputs":{"jobs":"next","count":"2"}}'
```
Cron khud har 6 ghante queue dekhta hai — pending ho to process (24/7 team).

**Approval flow (naya):** job `done` -> DM preview **chat mein** kholta hai -> USER haan/na bolta hai
-> tabhi `public/assets/` + game mein integrate. `proposed` = planner idea (user approve kare to `pending`).

**3D Artist (image->3D):** `kaggle/` ya `colab/` `VELARA-Artist-Image23D.ipynb` —
tum image do, TripoSR AI 3D GLB banata hai, review queue mein push hota hai.

**Naya job add karna:** `factory/queue/<id>.json` banao (status:"pending") + script
`factory/jobs/make-*.py` — commit+push. Bas.

*(Purana codespace runbook neeche hai — ab wo bhi isi queue ko use karta hai.)*

Codespace = **heavy-kaam worker**: Blender 4.5 LTS (headless, CPU) wahan
high-quality 3D assets banata hai — model → AO bake → Draco GLB — aur
sandbox wapas aake game mein integrate karta hai. (Unreal Engine web export
support nahi karta + codespace specs se engine build possible nahi — isliye
Blender hi asset engine hai.)

## Files
| File | Kaam |
|------|------|
| `.devcontainer/setup-blender.sh` | Codespace mein Blender 4.5.16 install (idempotent, postCreateCommand) |
| `factory/make-<asset>.py` | Ek Blender job = ek asset (model+bake+preview+Draco GLB) |
| `factory/verify-glb.py` | GLB round-trip verify (import karke stats) |
| `factory/out/` | Codespace-side output (gitignored nahi, par commit sirf final assets) |

## Sandbox-side runbook (har naye turn / reset ke baad)
```bash
cd /home/user/velara-city-game
bash tools/codespace-gh.sh                      # gh CLI install + auth (.ghtoken se)
NAME=$(cat /home/user/.codespace-name)          # current codespace

# codespace start (agar shutdown ho) — REST se:
TOKEN=$(tr -d '[:space:]' < .ghtoken)
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/user/codespaces/$NAME/start" | head -c 200

# job chalao (codespace repo-clone already latest main par hota hai):
GH_TOKEN=$TOKEN gh codespace ssh -c "$NAME" -- \
  'cd /workspaces/Velara && git pull --ff-only && blender --background --python factory/make-streetlamp.py'

# verify:
GH_TOKEN=$TOKEN gh codespace ssh -c "$NAME" -- \
  'cd /workspaces/Velara && blender --background --python factory/verify-glb.py -- factory/out/streetlamp.glb'

# asset sandbox mein laao:
mkdir -p public/assets/props references
GH_TOKEN=$TOKEN gh codespace ssh -c "$NAME" -- 'cat /workspaces/Velara/factory/out/streetlamp.glb' > public/assets/props/streetlamp.glb
GH_TOKEN=$TOKEN gh codespace ssh -c "$NAME" -- 'cat /workspaces/Velara/factory/out/streetlamp_preview.png' > references/STREETLAMP-PREVIEW.png
```

## Nayi asset recipe
1. `factory/make-<name>.py` banao (make-streetlamp.py ko template maano).
2. Commit+push karo, upar wala job-command chalao.
3. GLB `public/assets/props/` mein lao, ASSETS.md mein entry + `tools/git-push.sh`.
4. Game integration (three.js GLTFLoader) alag phase mein.

## GPU worker — Google Colab (free T4, bakes 10-50× faster)
1. Notebook kholo (GitHub se seedha Colab mein):
   `https://colab.research.google.com/github/priyanshagrahari54-blip/Velara/blob/main/colab/VELARA-Factory-GPU.ipynb`
2. **Runtime ▸ Run all** — notebook repo clone + Blender + tmate bridge ready karega
   aur ek `ssh ...@...tmate.io` line print karega. **Wo line chat mein paste karo.**
3. Sandbox se connect + GPU job (notebook ka tab khula rakhna):
   ```bash
   ssh -o StrictHostKeyChecking=accept-new <tmate-line> \
     'cd /content/Velara && git pull --ff-only -q && blender --background --python factory/make-streetlamp-ultra.py -- --bake 2048 --samples 256'
   ssh <tmate-line> 'cat /content/Velara/factory/out/streetlamp.glb' > public/assets/props/streetlamp.glb
   ```
   (Repo private ho to clone skip ho jata hai — files ssh se transfer karo, no token needed.)
4. Notes: Colab free ~12 ghante/session, tab band = worker band, ephemeral storage.
   GPU nahi mila to bhi chalega (CPU), bas slow.

## Quota notes
- Codespace: 2-core/8GB/32GB. Free tier ~120 core-hr/month → 2-core ~1 hr ≈ 2 core-hr.
- Idle 30 min par khud shutdown ho jata hai — restart upar wale REST start se.
- Ek time pe ek hi codespace rakho (delete + create se naya milta hai).
- Colab GPU: free tier daily/monthly limits — heavy bake bursts ke liye best, always-on nahi.
