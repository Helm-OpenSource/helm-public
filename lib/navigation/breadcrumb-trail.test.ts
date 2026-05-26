import { describe, expect, it } from "vitest";
import { buildBreadcrumbCrumbs } from "@/lib/navigation/breadcrumb-trail";

describe("buildBreadcrumbCrumbs", () => {
  it("keeps contact and company list parents navigable now that list pages exist", () => {
    expect(buildBreadcrumbCrumbs("/contacts/contact_123456789012", false)).toEqual([
      {
        href: "/contacts",
        label: "联系人",
        isDynamic: false,
        isNavigable: true,
      },
      {
        href: "/contacts/contact_123456789012",
        label: "详情",
        isDynamic: true,
        isNavigable: false,
      },
    ]);

    expect(buildBreadcrumbCrumbs("/companies/company_123456789012", true)).toEqual([
      {
        href: "/companies",
        label: "Companies",
        isDynamic: false,
        isNavigable: true,
      },
      {
        href: "/companies/company_123456789012",
        label: "Detail",
        isDynamic: true,
        isNavigable: false,
      },
    ]);
  });

  it("keeps only real list parents navigable for supported routes", () => {
    expect(buildBreadcrumbCrumbs("/customer-success/cmncqkpo500141yinbfdvnlnc", true)).toEqual([
      {
        href: "/customer-success",
        label: "Customer success",
        isDynamic: false,
        isNavigable: true,
      },
      {
        href: "/customer-success/cmncqkpo500141yinbfdvnlnc",
        label: "Detail",
        isDynamic: true,
        isNavigable: false,
      },
    ]);
  });

  it("keeps thin shared-agent routes readable instead of leaking raw slugs", () => {
    expect(buildBreadcrumbCrumbs("/review-requests/review_123456789012", true)).toEqual([
      {
        href: "/review-requests",
        label: "Review requests",
        isDynamic: false,
        isNavigable: false,
      },
      {
        href: "/review-requests/review_123456789012",
        label: "Detail",
        isDynamic: true,
        isNavigable: false,
      },
    ]);

    expect(buildBreadcrumbCrumbs("/success-checks/check_123456789012", false)).toEqual([
      {
        href: "/success-checks",
        label: "成功复盘",
        isDynamic: false,
        isNavigable: false,
      },
      {
        href: "/success-checks/check_123456789012",
        label: "详情",
        isDynamic: true,
        isNavigable: false,
      },
    ]);

    expect(
      buildBreadcrumbCrumbs("/expansion-reviews/review_123456789012", true),
    ).toEqual([
      {
        href: "/expansion-reviews",
        label: "Expansion reviews",
        isDynamic: false,
        isNavigable: false,
      },
      {
        href: "/expansion-reviews/review_123456789012",
        label: "Detail",
        isDynamic: true,
        isNavigable: false,
      },
    ]);

    expect(buildBreadcrumbCrumbs("/follow-ups/follow_123456789012", false)).toEqual([
      {
        href: "/follow-ups",
        label: "跟进详情",
        isDynamic: false,
        isNavigable: false,
      },
      {
        href: "/follow-ups/follow_123456789012",
        label: "详情",
        isDynamic: true,
        isNavigable: false,
      },
    ]);

    expect(buildBreadcrumbCrumbs("/sendability/send_123456789012", false)).toEqual([
      {
        href: "/sendability",
        label: "发送边界",
        isDynamic: false,
        isNavigable: false,
      },
      {
        href: "/sendability/send_123456789012",
        label: "详情",
        isDynamic: true,
        isNavigable: false,
      },
    ]);
  });

  it("keeps nested detail-only import parents readable but non-navigable", () => {
    expect(buildBreadcrumbCrumbs("/imports/jobs/job_123456789012", true)).toEqual([
      {
        href: "/imports",
        label: "Connections",
        isDynamic: false,
        isNavigable: true,
      },
      {
        href: "/imports/jobs",
        label: "Jobs",
        isDynamic: false,
        isNavigable: false,
      },
      {
        href: "/imports/jobs/job_123456789012",
        label: "Detail",
        isDynamic: true,
        isNavigable: false,
      },
    ]);
  });

  it("uses workspace settings language instead of the old intelligence label", () => {
    expect(buildBreadcrumbCrumbs("/settings", false)).toEqual([
      {
        href: "/settings",
        label: "工作区设置",
        isDynamic: false,
        isNavigable: true,
      },
    ]);

    expect(buildBreadcrumbCrumbs("/settings", true)).toEqual([
      {
        href: "/settings",
        label: "Workspace settings",
        isDynamic: false,
        isNavigable: true,
      },
    ]);
  });

  it("keeps reports named as a report surface instead of a bare role", () => {
    expect(buildBreadcrumbCrumbs("/reports", false)).toEqual([
      {
        href: "/reports",
        label: "本周经营复盘",
        isDynamic: false,
        isNavigable: true,
      },
    ]);

    expect(buildBreadcrumbCrumbs("/reports", true)).toEqual([
      {
        href: "/reports",
        label: "Weekly operating review",
        isDynamic: false,
        isNavigable: true,
      },
    ]);
  });
});
