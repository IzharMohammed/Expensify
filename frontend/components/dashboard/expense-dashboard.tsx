'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, LoaderCircle, Mic, Paperclip, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { BudgetAlertToast } from '@/components/dashboard/budget-alert-toast';
import { SummaryCards } from '@/components/dashboard/summary-cards';
import { InsightsPanel } from '@/components/insights/insights-panel';
import { AppShell } from '@/components/layout/app-shell';
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
import { SharedSplitSelector, SharingDraft } from '../expenses/shared-split-selector';
import { ExpenseSplitDraft, Household } from '@/lib/household-types';

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
const DEFAULT_COLORS = ['#32705B', '#C2883B', '#B45F4D', '#477F88', '#7C7652', '#D08B72'];

export function ExpenseDashboard() {
  const { accessToken, user } = useAuth();
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
  const [savedMerchant, setSavedMerchant] = useState<string | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [sharing, setSharing] = useState<SharingDraft>({ householdId: '', mode: 'equal', values: {} });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const [categoriesResponse, expensesResponse, summaryResponse, householdsResponse] = await Promise.all([
        api.get('/categories'),
        api.get('/expenses'),
        api.get('/dashboard/summary'),
        api.get('/households'),
      ]);

      setState((current) => ({
        ...current,
        categories: categoriesResponse.data.categories,
        expenses: expensesResponse.data.expenses,
        summary: summaryResponse.data,
      }));
      setHouseholds(householdsResponse.data.households);
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
        householdId: sharing.householdId || null,
        split: buildSplit(sharing, households),
      });

      const expense = response.data.expense as ExpenseRecord;
      setSavedMerchant(expense.merchant);
      setSharing({ householdId: '', mode: 'equal', values: {} });
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
    !!state.preview?.amount && Number(state.preview.amount) > 0 && !!state.preview.category?.id &&
    isSplitValid(sharing, households, state.preview?.amount ?? null);

  useEffect(() => {
    if (!savedMerchant) return;
    const timeout = window.setTimeout(() => setSavedMerchant(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [savedMerchant]);

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
    <AppShell
      actions={(
        <Link href="/budgets">
          <Button variant="outline">Review budgets <ArrowRight className="h-4 w-4" /></Button>
        </Link>
      )}
      description="A live view of what moved, what remains, and where your money is heading."
      eyebrow="Overview"
      title={`Hello${user?.name ? `, ${user.name.split(' ')[0]}` : ''}.`}
    >
      <div className="space-y-6 sm:space-y-8">
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

        <section className="grid gap-6">
          <Card className="overflow-hidden border-border/50 bg-card">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                    <Sparkles className="h-3.5 w-3.5" /> Smart capture
                  </div>
                  <CardTitle className="font-display text-3xl sm:text-4xl">Add an expense</CardTitle>
                  <CardDescription>
                    Write it naturally, speak it, or scan the receipt. You always confirm before saving.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <form className="space-y-3" onSubmit={handleParseSubmit}>
                <div className="flex flex-col gap-3 rounded-2xl bg-secondary/55 p-2.5 sm:p-3 md:flex-row">
                  <Input
                    className="h-14 flex-1 border-0 bg-card px-4 text-base shadow-sm focus-visible:ring-2"
                    disabled={isBusy}
                    onChange={(event) =>
                      setState((current) => ({ ...current, entryText: event.target.value }))
                    }
                    placeholder='Try “Swiggy 420” or “makaan ka rent 15000 diya”'
                    value={state.entryText}
                  />
                  <div className="grid grid-cols-[1fr_auto_auto] gap-2 md:flex">
                    <Button className="md:min-w-28" disabled={isBusy || !state.entryText.trim()} size="lg" type="submit">
                      {state.status === 'parsing' ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Reading</> : <>Review <ArrowRight className="h-4 w-4" /></>}
                    </Button>
                    <Button
                      disabled={isBusy && state.status !== 'recording'}
                      onClick={() => void toggleRecording()}
                      className="h-12 w-12 px-0"
                      type="button"
                      variant={state.status === 'recording' ? 'default' : 'outline'}
                    >
                      <Mic className={`h-4 w-4 ${state.status === 'recording' ? 'animate-pulse' : ''}`} />
                    </Button>
                    <Button
                      disabled={isBusy}
                      onClick={() => fileInputRef.current?.click()}
                      className="h-12 w-12 px-0"
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
                <div className="flex min-h-7 items-center gap-3 px-1 text-xs font-medium text-muted-foreground">
                  {state.status === 'recording' ? <WaveformIndicator /> : null}
                  {state.status === 'transcribing' ? 'Transcribing voice note...' : null}
                  {state.status === 'scanning' ? 'Reading receipt and extracting fields...' : null}
                </div>
              </form>

              {state.error ? (
                <div className="rounded-xl border border-danger/15 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {state.error}
                </div>
              ) : null}

              {savedMerchant ? (
                <div className="success-pop flex items-center gap-3 rounded-2xl bg-accent px-4 py-4 text-accent-foreground">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-5 w-5" /></span>
                  <div><p className="font-semibold">Expense added</p><p className="text-sm opacity-75">{savedMerchant} is now in your ledger.</p></div>
                </div>
              ) : null}

              {state.preview ? (
                <ConfirmationCard
                  categories={state.categories}
                  households={households}
                  isSaving={state.status === 'saving'}
                  onCancel={() =>
                    {
                      setState((current) => ({
                        ...current,
                        preview: null,
                        status: '',
                      }));
                      setSharing({ householdId: '', mode: 'equal', values: {} });
                    }
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
                  sharing={sharing}
                  onSharingChange={setSharing}
                />
              ) : null}
            </CardContent>
          </Card>
        </section>
        <InsightsPanel />
        <ExpenseSearch categories={state.categories} initialExpenses={state.expenses} />
      </div>
    </AppShell>
  );
}

function ConfirmationCard(props: {
  canConfirm: boolean;
  categories: Category[];
  households: Household[];
  isSaving: boolean;
  onCancel: () => void;
  onCategoryCreate: (name: string) => Promise<Category | null>;
  onCategorySelect: (category: Category | null) => void;
  onConfirm: () => void;
  onPreviewChange: (preview: Partial<ExpensePreview>) => void;
  preview: ExpensePreview;
  sharing: SharingDraft;
  onSharingChange: (value: SharingDraft) => void;
}) {
  const { preview } = props;

  return (
    <>
    <button aria-label="Close expense confirmation" className="fixed inset-0 z-[65] bg-foreground/25 backdrop-blur-sm md:hidden" onClick={props.onCancel} type="button" />
    <div className="fixed inset-x-2 bottom-3 z-[70] max-h-[90vh] space-y-4 overflow-y-auto rounded-3xl border border-border/70 bg-card p-5 shadow-lift sm:inset-x-5 md:static md:max-h-none md:rounded-2xl md:shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl">Confirm expense</h3>
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
            className="flex h-11 w-full rounded-[10px] border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-ring/10"
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

      <SharedSplitSelector amount={preview.amount} disabled={props.isSaving} households={props.households} onChange={props.onSharingChange} value={props.sharing} />

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
          <div className="rounded-xl border border-border/70 bg-raised p-3 text-sm">
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
    </>
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

function buildSplit(sharing: SharingDraft, households: Household[]): ExpenseSplitDraft | null {
  if (!sharing.householdId) return null;
  const members = households.find((item) => item.id === sharing.householdId)?.members ?? [];
  if (sharing.mode === 'equal') return { type: 'equal', memberIds: members.map((member) => member.userId) };
  if (sharing.mode === 'custom') return { type: 'custom', shares: members.map((member) => ({ userId: member.userId, amount: sharing.values[member.userId] ?? '0' })) };
  return { type: 'percentage', shares: members.map((member) => ({ userId: member.userId, percentage: Number(sharing.values[member.userId] || 0) })) };
}

function isSplitValid(sharing: SharingDraft, households: Household[], amount: string | null) {
  if (!sharing.householdId) return true;
  const members = households.find((item) => item.id === sharing.householdId)?.members ?? [];
  if (!members.length) return false;
  if (sharing.mode === 'equal') return true;
  const total = members.reduce((sum, member) => sum + Number(sharing.values[member.userId] || 0), 0);
  const expected = sharing.mode === 'percentage' ? 100 : Number(amount || 0);
  return members.every((member) => sharing.values[member.userId] !== '') && Math.abs(total - expected) < 0.005;
}
