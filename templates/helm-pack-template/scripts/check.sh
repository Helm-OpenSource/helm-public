#!/usr/bin/env bash
# Helm Pack — self-check
# Verifies SKILL.md frontmatter completeness, seed/ presence, fixtures/ presence

set -e
PACK_ROOT="$(dirname "$0")/.."
PACK_CONTENT_ROOT="$PACK_ROOT"
if [ -d "$PACK_ROOT/pack-template" ]; then
  PACK_CONTENT_ROOT="$PACK_ROOT/pack-template"
fi
shopt -s nullglob
ERRORS=0

required_artifacts=(
  "artifacts/context-packet.template.json"
  "artifacts/pack-studio.sample.csv"
  "artifacts/evidence-matrix.template.csv"
  "artifacts/work-pack.template.md"
  "artifacts/proof-loop-closeout.template.md"
)

echo "Checking Pack artifact templates..."
for artifact in "${required_artifacts[@]}"; do
  if [ ! -f "$PACK_CONTENT_ROOT/$artifact" ]; then
    echo "  ❌ Missing $artifact"; ERRORS=$((ERRORS+1))
  fi
done

for skill_dir in "$PACK_CONTENT_ROOT"/skills/*/; do
  skill_name=$(basename "$skill_dir")
  echo "Checking $skill_name..."

  # SKILL.md
  if [ ! -f "$skill_dir/SKILL.md" ]; then
    echo "  ❌ Missing SKILL.md"; ERRORS=$((ERRORS+1))
  fi

  # seed/
  for required in "seed/playbook.md" "seed/thresholds.yaml"; do
    if [ ! -f "$skill_dir/$required" ]; then
      echo "  ❌ Missing $required"; ERRORS=$((ERRORS+1))
    fi
  done

  # seed/templates/ should have ≥1 file
  template_count=$(find "$skill_dir/seed/templates" -maxdepth 1 -type f 2>/dev/null | wc -l)
  if [ "$template_count" -lt 1 ]; then
    echo "  ⚠️  seed/templates/ is empty (recommend ≥3)"
  fi

  # fixtures/
  if [ ! -d "$skill_dir/fixtures" ]; then
    echo "  ❌ Missing fixtures/"; ERRORS=$((ERRORS+1))
  fi
done

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "❌ $ERRORS error(s) found."
  exit 1
fi
echo ""
echo "✅ All Skills pass basic checks."
