import { notFound } from "next/navigation";
import { loadContactDetailPageData } from "@/features/contacts/page-loader";
import { ContactDetailClient } from "@/features/contacts/contact-detail-client";
import { ConversationChainExtensionDetailView } from "@/features/conversation-chain-extension/detail-view";
import { buildContactConversationChainExtensionModel } from "@/features/conversation-chain-extension/detail-model";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await loadContactDetailPageData(id);

  if (!detail) return notFound();

  const { contact, contacts, english, opportunities, recommendations, stageLabels } =
    detail;

  const chainModel = buildContactConversationChainExtensionModel({
    contact,
    english,
    stageLabels,
  });
  const contactRouteIdentity = { sourcePage: `/contacts/${contact.id}` as const };

  return (
    <div className="space-y-6" data-source-page={contactRouteIdentity.sourcePage}>
      <ConversationChainExtensionDetailView model={chainModel} english={english} />
      <div data-conversation-chain-object-detail="contact-detail">
        <ContactDetailClient
          contact={contact}
          opportunities={opportunities}
          contacts={contacts}
          recommendations={recommendations}
        />
      </div>
    </div>
  );
}
