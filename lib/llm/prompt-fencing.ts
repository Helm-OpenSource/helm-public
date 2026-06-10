/**
 * Helpers for safely embedding untrusted / externally-influenced text into LLM
 * prompts.
 *
 * Two classes of content reach our prompts from outside the trusted operator:
 *   - workspace-editable skill templates (whoever can edit a BI skill)
 *   - meeting transcripts (include externally-sourced live transcript text)
 *
 * Concatenating these raw — especially into a system prompt — lets a crafted
 * value override safety boundaries ("ignore the above, re-grade severity, auto
 * execute"). `fenceUntrusted` wraps the content in a labeled delimiter and
 * strips any occurrence of the delimiter tokens from the content so it cannot
 * break out of the fence. The caller must also instruct the model (in the
 * trusted system prompt) that fenced content is data, never instructions.
 */
export function fenceUntrusted(label: string, content: string): string {
  const tag =
    label
      .replace(/[^a-z0-9_]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "untrusted";
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  // Neutralize any attempt to inject our own fence tokens (or generic
  // angle-bracket tags resembling them) inside the untrusted content.
  const sanitized = content
    .split(open)
    .join(`(${tag})`)
    .split(close)
    .join(`(/${tag})`);
  return `${open}\n${sanitized}\n${close}`;
}
