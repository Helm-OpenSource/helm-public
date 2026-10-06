/** Source admission only. A reviewed assembler may replace this fixed slot.
 * It conveys no payment, model, credential, budget or deployment authority. */
export const serverBootstrapBinding = Object.freeze({
  schema: "helm.server-bootstrap-binding/v1",
  mode: "legacy-optional",
  bootstrapVersion: "helm.server-bootstrap/v1",
} as const);
