# helm-pack-template

Open-source skeleton for building Helm certified industry packs.

## What this is
A scaffolding repo for the Helm dual-layer Skill structure (SKILL.md natural-language outer layer + worker implementation inner layer). Helps Helm certified AI implementation engineers, partners, and customers quickly bootstrap a new industry pack.

## Core constraints (from Helm dual-layer spec)
- **Day-1 industry effectiveness** — each Skill ships seed/ (playbook + templates + thresholds), works out of the box
- **Operating quality is the core evidence** — each Skill defines quantitative quality thresholds + business-side readable validation
- **First landing is the seed event** — the first Day-1 impression of the first design partner customer determines ecosystem ignition

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

## License
- Template & examples: Apache-2.0
- Your derived pack: author's choice (OSS or commercial)
- Helm trademarks: see GOVERNANCE.md
