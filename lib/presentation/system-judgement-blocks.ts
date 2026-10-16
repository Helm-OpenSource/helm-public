// Source-level helpers for the object-first guards (see CLAUDE.md
// "Object-first"). A workspace view keeps its system judgement inside at most
// one collapsed `<details data-system-judgement>` block; these helpers find
// that block in a view's source so a guard can check what sits outside it.
//
// 对象优先守卫的源码辅助：找到视图源码里的 `<details data-system-judgement>`
// 块，守卫据此检查块外的内容。

export const SYSTEM_JUDGEMENT_ATTRIBUTE = "data-system-judgement";

function findOpeningTagEnd(source: string, start: number) {
  let braceDepth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth -= 1;
    else if (char === ">" && braceDepth === 0) return index;
  }
  return -1;
}

function findMatchingDetailsClose(source: string, start: number) {
  const tokens = /<details\b|<\/details>/g;
  tokens.lastIndex = start;
  let depth = 0;
  for (
    let match = tokens.exec(source);
    match !== null;
    match = tokens.exec(source)
  ) {
    depth += match[0] === "</details>" ? -1 : 1;
    if (depth === 0) return match.index + match[0].length;
  }
  return -1;
}

/**
 * Removes every `<details data-system-judgement …>…</details>` block and
 * returns what is left, how many blocks there were, and their opening tags.
 */
export function splitSystemJudgementBlocks(file: string, source: string) {
  let outside = source;
  const openingTags: string[] = [];
  let attributeIndex = outside.indexOf(SYSTEM_JUDGEMENT_ATTRIBUTE);

  while (attributeIndex >= 0) {
    const start = outside.lastIndexOf("<details", attributeIndex);
    if (start < 0 || outside.slice(start + 1, attributeIndex).includes("<")) {
      throw new Error(
        `${file}: ${SYSTEM_JUDGEMENT_ATTRIBUTE} must sit on a <details> element`,
      );
    }
    const openingEnd = findOpeningTagEnd(outside, start);
    const end = findMatchingDetailsClose(outside, start);
    if (openingEnd < 0 || end < 0) {
      throw new Error(`${file}: unbalanced system judgement <details> block`);
    }
    openingTags.push(outside.slice(start, openingEnd + 1));
    outside = outside.slice(0, start) + outside.slice(end);
    attributeIndex = outside.indexOf(SYSTEM_JUDGEMENT_ATTRIBUTE);
  }

  return { outside, count: openingTags.length, openingTags };
}
