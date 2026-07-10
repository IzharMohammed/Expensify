'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LoaderCircle, MessageSquareText, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
      });
  }, [conversationId, user]);

  const emptyState = useMemo(
    () => (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-white/40 px-6 py-10 text-center">
        <MessageSquareText className="mb-4 h-10 w-10 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Ask about your spending</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Questions are answered from your actual expense data through a safe function layer, not raw model guesses.
        </p>
      </div>
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
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Restoring session...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-xl border-white/70 bg-white/90 backdrop-blur">
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fef3c7,transparent_35%),linear-gradient(180deg,#fff7ed_0%,#f8fafc_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-amber-600">
                Spending Q&A
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">Chat with your money</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Ask natural questions about trends, merchants, categories, and whether your current spending still leaves room for savings.
              </p>
            </div>
            <DashboardNav />
          </div>

          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 transition hover:bg-amber-100"
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
        </div>

        <Card className="border-white/70 bg-white/85 shadow-sm backdrop-blur">
          <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
            <div className="max-h-[58vh] space-y-3 overflow-y-auto pr-1">
              {messages.length === 0 ? (
                emptyState
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[75%] ${
                        message.role === 'user'
                          ? 'bg-slate-900 text-white'
                          : 'border border-amber-100 bg-amber-50 text-slate-900'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <Input
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask something like: Compare food spending this month with last month"
                value={input}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-h-5 text-sm text-red-600">{error}</div>
                <Button disabled={submitting || !input.trim() || !conversationId} type="submit">
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Thinking...
                    </span>
                  ) : (
                    'Send'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
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
