#!/usr/bin/env bash
# Helm Pack — new Skill scaffolder
# Usage: ./scripts/new-skill.sh <skill-slug>

set -e
SKILL_SLUG="$1"
if [ -z "$SKILL_SLUG" ]; then
  echo "Usage: $0 <skill-slug>"
  echo "Example: $0 meeting-followup"
  exit 1
fi

TEMPLATE_DIR="$(dirname "$0")/../pack-template/skills/example-skill"
TARGET_DIR="$(dirname "$0")/../skills/$SKILL_SLUG"

if [ -d "$TARGET_DIR" ]; then
  echo "Error: $TARGET_DIR already exists."
  exit 1
fi

cp -r "$TEMPLATE_DIR" "$TARGET_DIR"

# Replace placeholder in SKILL.md
sed -i.bak "s/<skill-slug>/$SKILL_SLUG/g" "$TARGET_DIR/SKILL.md" && rm "$TARGET_DIR/SKILL.md.bak"

echo "✅ Created Skill: $TARGET_DIR"
echo "Next steps:"
echo "  1. Edit $TARGET_DIR/SKILL.md frontmatter"
echo "  2. Fill seed/playbook.md, seed/templates/*, seed/thresholds.yaml"
echo "  3. Add fixtures/ samples"
echo "  4. See docs/GETTING_STARTED.md for full guide"
