import { notFound } from "next/navigation";
import { InternalOperatingRoleHandoffSurface } from "@/features/internal-operating-workspace/role-handoff-surface";
import { loadInternalOperatingRolePageData } from "@/features/internal-operating-workspace/page-loader";

export default async function InternalOperatingRolePage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  const data = await loadInternalOperatingRolePageData(role);

  if (!data) {
    return notFound();
  }

  return (
    <InternalOperatingRoleHandoffSurface
      model={data.model}
      english={data.english}
    />
  );
}
