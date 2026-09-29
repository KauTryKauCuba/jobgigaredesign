export type AssistantAction =
  | { type: "navigate"; path: string; label: string; openNow: boolean }
  | { type: "draft_job"; title: string }
  | { type: "close_posting"; postingId: string; title: string; resolution?: "closed" | "kept" };

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  action?: AssistantAction | null;
};

export type AssistantConversationSummary = { id: string; title: string; updatedAt: string };
