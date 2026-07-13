'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bot, MessageSquareText, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { ChatMessage } from '@/lib/chat-types';

const STORAGE_KEY = 'expensify-chat-conversation-id';
const SUGGESTIONS = [
  'Where am I wasting money?',
  'Compare this month with last month',
  'Can I afford 15000 next month?',
];

export function ChatPage() {
  const { loading, user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (existing) {
      setConversationId(existing);
      return;
    }

    const nextId = crypto.randomUUID();
    window.sessionStorage.setItem(STORAGE_KEY, nextId);
    setConversationId(nextId);
  }, []);

  useEffect(() => {
    if (!user || !conversationId) {
      return;
    }

    api
      .get(`/chat/${conversationId}`)
      .then((response) => {
        setMessages(response.data.messages ?? []);
      })
      .catch(() => {
        setError('Failed to load chat history');
      })
      .finally(() => setHistoryLoading(false));
  }, [conversationId, user]);

  const emptyState = useMemo(
    () => (
      <EmptyState description="Ask about merchants, categories, trends, or whether a purchase fits. Answers use your actual expense data." icon={MessageSquareText} title="Start with a money question" />
    ),
    [],
  );

  async function submitMessage(message: string) {
    if (!conversationId || !message.trim()) {
      return;
    }

    const trimmed = message.trim();
    const optimisticUserMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      userId: user?.sub ?? 'me',
      conversationId,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, optimisticUserMessage]);
    setInput('');
    setSubmitting(true);
    setError(null);

    try {
      const response = await api.post('/chat', {
        message: trimmed,
        conversation_id: conversationId,
      });

      const assistantMessage: ChatMessage = {
        id: `local-assistant-${Date.now()}`,
        userId: user?.sub ?? 'assistant',
        conversationId,
        role: 'assistant',
        content: response.data.answer as string,
        createdAt: new Date().toISOString(),
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (requestError) {
      setMessages((current) => current.filter((item) => item.id !== optimisticUserMessage.id));
      setError(getError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitMessage(input);
  }

  if (loading) {
    return (
      <AppShell title="AI Chat"><PageSkeleton /></AppShell>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Chat with your finances</CardTitle>
            <CardDescription>
              Sign in to ask questions grounded in your real spending data.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Link href="/login">
              <Button>Login</Button>
            </Link>
            <Link href="/register">
              <Button variant="outline">Register</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <AppShell description="Ask natural questions. Every answer is grounded in your expense data." eyebrow="Grounded answers" title="Chat with your money">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                className="rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition hover:-translate-y-px hover:border-primary/25 hover:text-foreground"
                onClick={() => void submitMessage(suggestion)}
                type="button"
              >
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  {suggestion}
                </span>
              </button>
            ))}
        </div>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/50 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-primary"><Bot className="h-5 w-5" /></span><div><p className="text-sm font-semibold">Ledger assistant</p><p className="flex items-center gap-1 text-[11px] text-muted-foreground"><ShieldCheck className="h-3 w-3" />Grounded in your data</p></div></div>
          </div>
          <CardContent className="flex min-h-[620px] flex-col p-0 sm:p-0">
            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-8">
              {historyLoading ? <div className="space-y-4"><Skeleton className="h-16 w-3/5 rounded-2xl" /><Skeleton className="ml-auto h-14 w-2/5 rounded-2xl" /><Skeleton className="h-20 w-4/5 rounded-2xl" /></div> : messages.length === 0 ? (
                emptyState
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[88%] px-4 py-3 text-sm leading-6 sm:max-w-[72%] ${
                        message.role === 'user'
                          ? 'rounded-[20px_20px_5px_20px] bg-primary text-primary-foreground'
                          : 'rounded-[20px_20px_20px_5px] bg-secondary/70 text-foreground'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))
              )}
              {submitting ? <div className="flex justify-start"><div className="flex items-center gap-1 rounded-[20px_20px_20px_5px] bg-secondary/70 px-5 py-4">{[0, 1, 2].map((item) => <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" key={item} style={{ animationDelay: `${item * 140}ms` }} />)}</div></div> : null}
            </div>

            <form className="border-t border-border/50 bg-raised p-3 sm:p-4" onSubmit={handleSubmit}>
              {error ? <div className="mb-3 rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}
              <div className="flex items-center gap-2 rounded-2xl border border-input bg-card p-1.5 shadow-sm focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-ring/10">
                <Input className="h-11 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0" onChange={(event) => setInput(event.target.value)} placeholder="Ask about your spending..." value={input} />
                <Button className="h-10 w-10 shrink-0 px-0" disabled={submitting || !input.trim() || !conversationId} type="submit"><Send className="h-4 w-4" /></Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function getError(error: unknown) {
  const maybeMessage =
    typeof error === 'object' && error && 'response' in error
      ? (error as { response?: { data?: { message?: unknown } } }).response?.data?.message
      : null;

  if (typeof maybeMessage === 'string') {
    return maybeMessage;
  }

  if (Array.isArray(maybeMessage)) {
    return maybeMessage.join(', ');
  }

  return 'Chat request failed';
}
