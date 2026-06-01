# helm-pack-template

Open-source skeleton for building Helm certified industry packs.

## What this is
A scaffolding repo for the Helm dual-layer Skill structure (SKILL.md natural-language outer layer + worker implementation inner layer). Helps Helm certified AI implementation engineers, partners, and customers quickly bootstrap a new industry pack.

## Core constraints (from Helm dual-layer spec)
- **Day-1 industry effectiveness** — each Skill ships seed/ (playbook + templates + thresholds), works out of the box
- **Operating quality is the core evidence** — each Skill defines quantitative quality thresholds + business-side readable validation
- **First landing is the seed event** — the first Day-1 impression of the first design partner customer determines ecosystem ignition
- **Evidence before commitment** — before a Pack delivery becomes a claim, prepare a Context Packet, Pack Studio safe sample, Evidence Matrix, Review-Ready Work Pack, and Proof Loop closeout. These are review-first artifacts, not execution authority.

## Quick start
```bash
cp -r pack-template/ ../my-helm-pack/
cd ../my-helm-pack
./scripts/new-skill.sh my-first-skill
```

## Docs
- `docs/GETTING_STARTED.md`
- `docs/SKILL_MD_REFERENCE.md`
- `docs/GOVERNANCE.md`
- `pack-template/artifacts/`

## License
- Template & examples: Apache-2.0
- Your derived pack: author's choice (OSS or commercial)
- Helm trademarks: see GOVERNANCE.md
