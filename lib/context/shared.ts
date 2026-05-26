import { ObjectType } from "@prisma/client";

export type ContextFact = {
  id: string;
  title: string;
  content: string;
  confidence: number;
};

export type ContextCommitment = {
  id: string;
  title: string;
  commitmentText: string;
  dueDate: Date | null;
  status: string;
  overdueFlag: boolean;
};

export type ContextBlocker = {
  id: string;
  title: string;
  blockerText: string;
  severity: number;
  status: string;
};

export type ContextMeeting = {
  id: string;
  title: string;
  startsAt: Date;
  summary?: string | null;
};

export type ContextThread = {
  id: string;
  subject: string;
  status: string;
  snippet?: string | null;
};

export type LLMObjectContext = {
  objectType: ObjectType;
  objectId: string;
  objectLabel: string;
  currentStage?: string | null;
  facts: ContextFact[];
  commitments: ContextCommitment[];
  blockers: ContextBlocker[];
  recentMeetings: ContextMeeting[];
  recentThreads: ContextThread[];
};
