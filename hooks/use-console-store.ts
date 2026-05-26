"use client";

import { create } from "zustand";

type ConsoleState = {
  opportunityView: "board" | "list";
  selectedApprovalId: string | null;
  selectedThreadId: string | null;
  setOpportunityView: (view: "board" | "list") => void;
  setSelectedApprovalId: (id: string | null) => void;
  setSelectedThreadId: (id: string | null) => void;
};

export const useConsoleStore = create<ConsoleState>((set) => ({
  opportunityView: "board",
  selectedApprovalId: null,
  selectedThreadId: null,
  setOpportunityView: (opportunityView) => set({ opportunityView }),
  setSelectedApprovalId: (selectedApprovalId) => set({ selectedApprovalId }),
  setSelectedThreadId: (selectedThreadId) => set({ selectedThreadId }),
}));
