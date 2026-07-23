export const aiUsageLimits = {} as const;

export type AiFeature = "corrector" | "question";

export type AiUsageAllowance = {
  unlimited: boolean;
  used: number;
  remaining: number | null;
  limit: number | null;
  bonusCreditId?: string;
};

/**
 * A self-hosted instance uses the operator's own AI account, so account-based
 * quotas do not belong in the application. Provider-side limits still apply.
 */
export async function claimAiUsage(
  feature: AiFeature,
): Promise<AiUsageAllowance> {
  void feature;
  return { unlimited: true, used: 0, remaining: null, limit: null };
}

export async function releaseAiUsage(
  feature: AiFeature,
  allowance?: AiUsageAllowance,
): Promise<void> {
  void feature;
  void allowance;
}

export function aiUsageHeaders(
  allowance: AiUsageAllowance,
): Record<string, string> {
  void allowance;
  return {
    "x-ai-limit": "unlimited",
    "x-ai-remaining": "unlimited",
  };
}

export function aiUsageErrorResponse(error: unknown) {
  void error;
  return null;
}
