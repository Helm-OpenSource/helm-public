import {
  ObjectContextOperatingSummary,
  type OperatingSummaryConnection,
} from "@/components/shared/object-context-operating-summary";
import {
  buildBusinessFirstSummaryItems,
  type BusinessFirstSurfaceSnapshot,
} from "@/lib/presentation/business-first-surface-contract";

export function BusinessFirstSurfaceSummary({
  english,
  label,
  title,
  summary,
  snapshot,
  connectionsLabel,
  connections,
}: {
  english: boolean;
  label: string;
  title: string;
  summary: string;
  snapshot: BusinessFirstSurfaceSnapshot;
  connectionsLabel?: string;
  connections?: readonly OperatingSummaryConnection[];
}) {
  return (
    <ObjectContextOperatingSummary
      label={label}
      title={title}
      summary={summary}
      items={buildBusinessFirstSummaryItems({ english, snapshot })}
      connectionsLabel={connectionsLabel}
      connections={connections}
    />
  );
}
