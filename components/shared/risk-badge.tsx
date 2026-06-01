"use client";

import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { Badge } from "@/components/ui/badge";
import { riskTone } from "@/data/constants";
import { getLocalizedRiskLabels } from "@/lib/i18n/labels";

export function RiskBadge({ risk }: { risk: keyof typeof riskTone }) {
  const { locale } = useWorkspaceUi();
  const riskLabels = getLocalizedRiskLabels(locale);
  return <Badge className={riskTone[risk]}>{riskLabels[risk] ?? risk}</Badge>;
}
