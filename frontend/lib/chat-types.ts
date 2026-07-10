export type ChatMessage = {
  id: string;
  userId: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};
