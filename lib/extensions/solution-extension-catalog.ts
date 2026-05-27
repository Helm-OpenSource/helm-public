import { SolutionExtensionKind } from "@prisma/client";
import {
  listSolutionExtensionCatalog,
  type SolutionExtensionCatalogEntry as RegistrySolutionExtensionCatalogEntry,
} from "@/lib/extensions/registry";

const DEFAULT_PUBLIC_SOLUTION_EXTENSION_CATALOG = [
  {
    extensionKey: "case-management-sample-signals",
    kind: SolutionExtensionKind.TENANT_CUSTOM,
    nameZh: "案例管理样例 Signals",
    nameEn: "Case Management Sample Signals",
    descriptionZh: "公开样例的只读信号映射扩展，用于演示导入与事实整理链路。",
    descriptionEn:
      "Read-only signal mapping sample used to demonstrate import and fact distillation flows.",
  },
  {
    extensionKey: "case-management-sample-bi-report",
    kind: SolutionExtensionKind.TENANT_CUSTOM,
    nameZh: "案例管理样例 BI Report",
    nameEn: "Case Management Sample BI Report",
    descriptionZh: "公开样例的只读报表扩展，用于演示 reporting 与 review-first 输出。",
    descriptionEn:
      "Read-only reporting sample used to demonstrate reporting and review-first outputs.",
  },
  {
    extensionKey: "case-management-sample-workers",
    kind: SolutionExtensionKind.TENANT_CUSTOM,
    nameZh: "案例管理样例 Workers",
    nameEn: "Case Management Sample Workers",
    descriptionZh: "公开样例的 review-first worker 扩展，不包含高风险自动执行。",
    descriptionEn:
      "Review-first worker sample with no high-risk autonomous execution capabilities.",
  },
] satisfies ReadonlyArray<RegistrySolutionExtensionCatalogEntry>;

const registryCatalog = listSolutionExtensionCatalog();

export const SOLUTION_EXTENSION_CATALOG =
  registryCatalog.length > 0
    ? registryCatalog
    : DEFAULT_PUBLIC_SOLUTION_EXTENSION_CATALOG;

export type SolutionExtensionCatalogEntry = RegistrySolutionExtensionCatalogEntry;
