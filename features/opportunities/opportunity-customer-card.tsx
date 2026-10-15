"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CustomerFirstContact } from "@/features/opportunities/customer-first";

const NO_COMPANY = "__none__";

export type OpportunityCustomerCardProps = {
  english: boolean;
  anchorId: string;
  contacts: CustomerFirstContact[];
  companies: Array<{ id: string; name: string }>;
  /** Company currently chosen in the unsaved draft ("" when none). */
  companyId: string;
  onCompanyChange: (companyId: string) => void;
  sourceLabel: string;
  sourceDetail: string | null;
  firstContactAt: string;
  ownerName: string | null;
  onEditOwner: () => void;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-[color:var(--muted-foreground)]">{label}</span>
      <div className="min-w-0 break-words text-sm text-[color:var(--foreground)]">
        {children}
      </div>
    </div>
  );
}

/** 客户 card: who the customer is and how they reached us. */
export function OpportunityCustomerCard({
  english,
  anchorId,
  contacts,
  companies,
  companyId,
  onCompanyChange,
  sourceLabel,
  sourceDetail,
  firstContactAt,
  ownerName,
  onEditOwner,
}: OpportunityCustomerCardProps) {
  const [pickingCompany, setPickingCompany] = useState(false);
  const primary = contacts[0] ?? null;
  const others = contacts.slice(1);
  const company = companies.find((item) => item.id === companyId) ?? null;
  const notSet = english ? "Not recorded" : "未记录";

  return (
    <section
      id={anchorId}
      data-opportunity-customer-card
      className="space-y-3 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
    >
      <h3 className="text-xs font-medium tracking-[0.04em] text-[color:var(--muted-foreground)]">
        {english ? "Customer" : "客户"}
      </h3>
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Field label={english ? "Contact" : "联系人"}>
          {primary ? (
            <Link
              href={`/contacts/${primary.id}`}
              className="text-base font-semibold hover:underline"
            >
              {primary.name}
            </Link>
          ) : (
            <span className="text-[color:var(--muted-foreground)]">
              {english ? "No linked contact" : "未关联联系人"}
            </span>
          )}
          {others.length ? (
            <span className="mt-1 block text-xs text-[color:var(--muted-foreground)]">
              {english ? "Also: " : "其他联系人："}
              {others.map((contact) => contact.name).join(english ? ", " : "、")}
            </span>
          ) : null}
        </Field>
        <Field label={english ? "Phone" : "手机"}>
          <span className="font-mono">{primary?.phone || notSet}</span>
        </Field>
        <Field label={english ? "Email" : "邮箱"}>
          <span className="break-all font-mono">{primary?.email || notSet}</span>
        </Field>
        <Field label={english ? "Company" : "公司"}>
          <span className="inline-flex flex-wrap items-center gap-2">
            {company ? (
              <Link href={`/companies/${company.id}`} className="hover:underline">
                {company.name}
              </Link>
            ) : (
              <span>{english ? "Not linked" : "未关联"}</span>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 px-2 text-xs"
              aria-expanded={pickingCompany}
              onClick={() => setPickingCompany((value) => !value)}
            >
              {company ? (english ? "Change" : "改") : english ? "Link" : "关联"}
            </Button>
          </span>
          {pickingCompany ? (
            <div className="mt-2">
              <Select
                value={companyId || NO_COMPANY}
                onValueChange={(value) => {
                  onCompanyChange(value === NO_COMPANY ? "" : value);
                  setPickingCompany(false);
                }}
              >
                <SelectTrigger aria-label={english ? "Linked company" : "关联公司"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_COMPANY}>
                    {english ? "No linked company" : "未关联公司"}
                  </SelectItem>
                  {companies.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </Field>
        <Field label={english ? "Source" : "来源"}>
          {sourceDetail ? `${sourceLabel} · ${sourceDetail}` : sourceLabel}
        </Field>
        <Field label={english ? "First contact" : "首次咨询"}>{firstContactAt}</Field>
        <Field label={english ? "Owner" : "负责人"}>
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>{ownerName ?? (english ? "Unassigned" : "未分配")}</span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 px-2 text-xs"
              onClick={onEditOwner}
            >
              {english ? "Change" : "改"}
            </Button>
          </span>
        </Field>
      </div>
    </section>
  );
}
