'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Mic, Paperclip, LoaderCircle } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { BudgetAlertToast } from '@/components/dashboard/budget-alert-toast';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { SummaryCards } from '@/components/dashboard/summary-cards';
import { InsightsPanel } from '@/components/insights/insights-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/text-area';
import { api } from '@/lib/api';
import { DASHBOARD_STREAM_URL } from '@/lib/config';
import { BudgetAlert, DashboardSummary } from '@/lib/dashboard-types';
import { Category, ExpensePreview, ExpenseRecord } from '@/lib/expense-types';

import { CategoryPicker } from '../expenses/category-picker';
import { ExpenseSearch } from '../expenses/expense-search';

type DashboardState = {
  categories: Category[];
  expenses: ExpenseRecord[];
  preview: ExpensePreview | null;
  entryText: string;
  status: '' | 'parsing' | 'saving' | 'recording' | 'transcribing' | 'scanning';
  error: string | null;
  summary: DashboardSummary | null;
};

const DEFAULT_ICONS = ['Wallet', 'Tag', 'CircleDollarSign', 'BadgeIndianRupee'];
const DEFAULT_COLORS = ['#2563EB', '#16A34A', '#D97706', '#7C3AED', '#DB2777'];

export function ExpenseDashboard() {
  const { accessToken, logout, user } = useAuth();
  const [state, setState] = useState<DashboardState>({
    categories: [],
    expenses: [],
    preview: null,
    entryText: '',
    status: '',
    error: null,
    summary: null,
  });
  const [alerts, setAlerts] = useState<Array<BudgetAlert & { id: string }>>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const [categoriesResponse, expensesResponse, summaryResponse] = await Promise.all([
        api.get('/categories'),
        api.get('/expenses'),
        api.get('/dashboard/summary'),
      ]);

      setState((current) => ({
        ...current,
        categories: categoriesResponse.data.categories,
        expenses: expensesResponse.data.expenses,
        summary: summaryResponse.data,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        error: getError(error, 'Failed to load dashboard'),
      }));
    }
  }

  async function handleParseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state.entryText.trim()) {
      return;
    }

    setState((current) => ({ ...current, status: 'parsing', error: null }));
    try {
      
      const response = await api.post('/expenses/parse', {
        text: state.entryText.trim(),
      });
      setState((current) => ({
        ...current,
        preview: response.data.preview,
        status: '',
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        status: '',
        error: getError(error, 'Failed to parse expense'),
      }));
    }
  }

  async function createCategory(name: string) {
    try {
      const response = await api.post('/categories', {
        name,
        icon: DEFAULT_ICONS[Math.floor(Math.random() * DEFAULT_ICONS.length)],
        color: DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
      });
      const category = response.data.category as Category;
      setState((current) => ({
        ...current,
        categories: [...current.categories, category].sort((a, b) => a.name.localeCompare(b.name)),
      }));
      return category;
    } catch (error) {
      setState((current) => ({
        ...current,
        error: getError(error, 'Failed to create category'),
      }));
      return null;
    }
  }

  async function confirmExpense() {
    if (!state.preview) {
      return;
    }

    setState((current) => ({ ...current, status: 'saving', error: null }));
    try {
      const response = await api.post('/expenses', {
        amount: state.preview.amount ?? '0',
        merchant: state.preview.merchant,
        categoryId: state.preview.category?.id ?? null,
        paymentMethod: state.preview.paymentMethod,
        date: state.preview.date,
        note: state.preview.note,
        source: state.preview.source,
        rawInput: state.preview.rawInput,
        receiptUrl: state.preview.receiptUrl ?? null,
      });

      const expense = response.data.expense as ExpenseRecord;
      setState((current) => ({
        ...current,
        expenses: [expense, ...current.expenses],
        preview: null,
        entryText: '',
        status: '',
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        status: '',
        error: getError(error, 'Failed to save expense'),
      }));
    }
  }

  async function toggleRecording() {
    if (state.status === 'recording') {
      mediaRecorderRef.current?.stop();
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    audioChunksRef.current = [];
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      setState((current) => ({ ...current, status: 'transcribing' }));

      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        const response = await api.post('/expenses/voice', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        setState((current) => ({
          ...current,
          entryText: response.data.transcript,
          preview: response.data.preview,
          status: '',
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          status: '',
          error: getError(error, 'Voice parsing failed'),
        }));
      }
    };

    recorder.start();
    setState((current) => ({ ...current, status: 'recording', error: null }));
  }

  async function handleReceiptUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setState((current) => ({ ...current, status: 'scanning', error: null }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/expenses/ocr', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setState((current) => ({
        ...current,
        preview: response.data.preview,
        entryText: response.data.extractedText,
        status: '',
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        status: '',
        error: getError(error, 'Receipt scanning failed'),
      }));
    } finally {
      event.target.value = '';
    }
  }

  const isBusy = ['parsing', 'saving', 'transcribing', 'scanning'].includes(state.status);
  const canConfirm =
    !!state.preview?.amount && Number(state.preview.amount) > 0 && !!state.preview.category?.id;

  useEffect(() => {
    if (!user || !accessToken) {
      return;
    }

    const stream = new EventSource(
      `${DASHBOARD_STREAM_URL}?token=${encodeURIComponent(accessToken)}`,
    );

    stream.addEventListener('summary', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as DashboardSummary;
      setState((current) => ({ ...current, summary: payload }));
    });

    stream.addEventListener('budget_alert', (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as BudgetAlert;
      setAlerts((current) => [
        { ...payload, id: `${payload.categoryId}-${payload.threshold}-${Date.now()}` },
        ...current,
      ]);
    });

    return () => {
      stream.close();
    };
  }, [accessToken, user]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.22),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.58),rgba(250,247,242,1))] p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <DashboardNav />
            <div>
              <h1 className="text-3xl font-semibold">Live expense dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Parse quickly, confirm deliberately, and watch the monthly summary update live.
              </p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium">{user?.name}</p>
            <button
              className="text-muted-foreground underline underline-offset-4"
              onClick={() => logout()}
              type="button"
            >
              Logout
            </button>
          </div>
        </div>

        <SummaryCards summary={state.summary} />

        {alerts.length ? (
          <div className="space-y-3">
            {alerts.slice(0, 3).map((alert) => (
              <BudgetAlertToast
                alert={alert}
                key={alert.id}
                onDismiss={() =>
                  setAlerts((current) => current.filter((currentAlert) => currentAlert.id !== alert.id))
                }
              />
            ))}
          </div>
        ) : null}

        <InsightsPanel />

        <section className="grid gap-6">
          <Card className="border-white/60 bg-white/88 shadow-xl backdrop-blur">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-3xl">Quick expense capture</CardTitle>
                  <CardDescription>
                    Type, speak, or upload a receipt. We parse first, you confirm second.
                  </CardDescription>
                </div>
                <Link className="text-sm text-muted-foreground underline underline-offset-4" href="/budgets">
                  Manage budgets
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <form className="space-y-3" onSubmit={handleParseSubmit}>
                <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-secondary/40 p-3 md:flex-row">
                  <Input
                    className="h-12 flex-1 border-0 bg-white/90 text-base shadow-sm"
                    disabled={isBusy}
                    onChange={(event) =>
                      setState((current) => ({ ...current, entryText: event.target.value }))
                    }
                    placeholder='Try "Swiggy 420", "makaan ka rent 15000 diya", or "Paid electricity bill 1850"'
                    value={state.entryText}
                  />
                  <div className="flex gap-2">
                    <Button disabled={isBusy || !state.entryText.trim()} size="lg" type="submit">
                      {state.status === 'parsing' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : 'Parse'}
                    </Button>
                    <Button
                      disabled={isBusy && state.status !== 'recording'}
                      onClick={() => void toggleRecording()}
                      size="lg"
                      type="button"
                      variant={state.status === 'recording' ? 'default' : 'outline'}
                    >
                      <Mic className={`h-4 w-4 ${state.status === 'recording' ? 'animate-pulse' : ''}`} />
                    </Button>
                    <Button
                      disabled={isBusy}
                      onClick={() => fileInputRef.current?.click()}
                      size="lg"
                      type="button"
                      variant="outline"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <input
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(event) => void handleReceiptUpload(event)}
                      ref={fileInputRef}
                      type="file"
                    />
                  </div>
                </div>
                <div className="flex min-h-8 items-center gap-3 text-sm text-muted-foreground">
                  {state.status === 'recording' ? <WaveformIndicator /> : null}
                  {state.status === 'transcribing' ? 'Transcribing voice note...' : null}
                  {state.status === 'scanning' ? 'Reading receipt and extracting fields...' : null}
                </div>
              </form>

              {state.error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {state.error}
                </div>
              ) : null}

              {state.preview ? (
                <ConfirmationCard
                  categories={state.categories}
                  isSaving={state.status === 'saving'}
                  onCancel={() =>
                    setState((current) => ({
                      ...current,
                      preview: null,
                      status: '',
                    }))
                  }
                  onCategoryCreate={createCategory}
                  onCategorySelect={(category) =>
                    setState((current) => ({
                      ...current,
                      preview: current.preview
                        ? {
                            ...current.preview,
                            category,
                            categoryName: category?.name ?? current.preview.categoryName,
                          }
                        : null,
                    }))
                  }
                  onConfirm={() => void confirmExpense()}
                  onPreviewChange={(nextPreview) =>
                    setState((current) => ({
                      ...current,
                      preview: current.preview ? { ...current.preview, ...nextPreview } : null,
                    }))
                  }
                  preview={state.preview}
                  canConfirm={canConfirm}
                />
              ) : null}
            </CardContent>
          </Card>

          <ExpenseSearch categories={state.categories} initialExpenses={state.expenses} />
        </section>
      </div>
    </main>
  );
}

function ConfirmationCard(props: {
  canConfirm: boolean;
  categories: Category[];
  isSaving: boolean;
  onCancel: () => void;
  onCategoryCreate: (name: string) => Promise<Category | null>;
  onCategorySelect: (category: Category | null) => void;
  onConfirm: () => void;
  onPreviewChange: (preview: Partial<ExpensePreview>) => void;
  preview: ExpensePreview;
}) {
  const { preview } = props;

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-[#fffaf3] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Confirm parsed expense</h3>
          <p className="text-sm text-muted-foreground">
            Review before saving. Nothing is auto-saved.
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium uppercase tracking-wide">
          {preview.source}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Merchant</label>
          <Input
            onChange={(event) => props.onPreviewChange({ merchant: event.target.value })}
            value={preview.merchant}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Amount</label>
          <Input
            onChange={(event) => props.onPreviewChange({ amount: event.target.value })}
            value={preview.amount ?? ''}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Payment method</label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            onChange={(event) =>
              props.onPreviewChange({
                paymentMethod:
                  event.target.value === '' ? null : (event.target.value as ExpensePreview['paymentMethod']),
              })
            }
            value={preview.paymentMethod ?? ''}
          >
            <option value="">Unknown</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
            <option value="netbanking">Netbanking</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Date</label>
          <Input
            onChange={(event) => props.onPreviewChange({ date: event.target.value })}
            type="date"
            value={preview.date.slice(0, 10)}
          />
        </div>
      </div>

      <CategoryPicker
        categories={props.categories}
        disabled={props.isSaving}
        onCreate={props.onCategoryCreate}
        onSelect={props.onCategorySelect}
        value={preview.category}
      />

      <div className="space-y-2">
        <label className="text-sm font-medium">Note</label>
        <Textarea
          onChange={(event) => props.onPreviewChange({ note: event.target.value })}
          placeholder="Add extra context if needed"
          value={preview.note ?? ''}
        />
      </div>

      {preview.lineItems?.length ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Receipt line items</p>
          <div className="rounded-xl border border-border/70 bg-white/70 p-3 text-sm">
            {preview.lineItems.map((item, index) => (
              <div className="flex items-center justify-between gap-3 py-1" key={`${item.name}-${index}`}>
                <span>{item.name}</span>
                <span className="text-muted-foreground">
                  {[item.quantity, item.price].filter(Boolean).join(' • ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-sm font-medium">Raw input</label>
        <Textarea
          onChange={(event) => props.onPreviewChange({ rawInput: event.target.value })}
          value={preview.rawInput}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button disabled={props.isSaving || !props.canConfirm} onClick={props.onConfirm} type="button">
          {props.isSaving ? 'Saving...' : 'Confirm'}
        </Button>
        <Button disabled={props.isSaving} onClick={props.onCancel} type="button" variant="outline">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function WaveformIndicator() {
  return (
    <div className="flex items-center gap-1">
      {[12, 20, 10, 18, 14].map((height, index) => (
        <span
          key={height + index}
          className="inline-block w-1 animate-pulse rounded-full bg-primary"
          style={{ height }}
        />
      ))}
      <span className="ml-2">Recording...</span>
    </div>
  );
}

function getError(error: unknown, fallback: string) {
  const message =
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { message?: string | string[] } } }).response?.data
      ?.message !== 'undefined'
      ? (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
      : null;

  if (Array.isArray(message)) {
    return message.join(', ');
  }

  if (message && typeof message === 'object') {
    try {
      return JSON.stringify(message);
    } catch {
      return fallback;
    }
  }

  return message ?? fallback;
}
