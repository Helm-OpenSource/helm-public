ALTER TABLE "ConversationTranscript" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'FALLBACK_DEMO';
ALTER TABLE "ConversationTranscript" ADD COLUMN "provider" TEXT;
ALTER TABLE "ConversationTranscript" ADD COLUMN "model" TEXT;
