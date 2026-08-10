import { z } from "zod";

import { caioProPublicSafePortfolioRefSchema } from "./caio-pro-fde-cross-repo-contract";

export const CAIO_OPERATING_QUESTION_GENERATION_PATH =
  "/v1/operating-questions/generate" as const;

export const caioOperatingQuestionGenerationRequestSchema = z
  .object({
    portfolioRef: caioProPublicSafePortfolioRefSchema,
    generationKey: z.string().trim().min(1).max(256),
  })
  .strict();

export type CaioOperatingQuestionGenerationRequest = z.infer<
  typeof caioOperatingQuestionGenerationRequestSchema
>;

export function parseCaioOperatingQuestionGenerationRequest(
  value: unknown,
): CaioOperatingQuestionGenerationRequest {
  return caioOperatingQuestionGenerationRequestSchema.parse(value);
}
