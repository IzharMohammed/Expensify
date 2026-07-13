'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Paperclip,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MoneyDisplay } from '@/components/ui/money-display';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { AttachmentRecord, ExpenseRecord } from '@/lib/expense-types';

const LABELS = ['receipt', 'invoice', 'warranty', 'other'] as const;
const MAX_SIZE = 10 * 1024 * 1024;

export function ExpenseAttachments({ expense, open, onClose }: {
  expense: ExpenseRecord;
  open: boolean;
  onClose: () => void;
}) {
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);
  const [label, setLabel] = useState<(typeof LABELS)[number]>('receipt');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AttachmentRecord | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    api
      .get(`/expenses/${expense.id}/attachments`)
      .then((response) => setAttachments(response.data.attachments ?? []))
      .catch((requestError) => setError(readError(requestError, 'Could not load attachments')))
      .finally(() => setLoading(false));
  }, [expense.id, open]);

  useEffect(() => {
    if (!open) setPreview(null);
  }, [open]);

  async function upload(file: File) {
    if (!isSupported(file)) {
      setError('Choose a JPG, PNG, WebP, GIF, or PDF file');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('Attachments must be 10 MB or smaller');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('label', label);
      const response = await api.post(`/expenses/${expense.id}/attachments`, formData);
      setAttachments((current) => [response.data.attachment, ...current]);
    } catch (requestError) {
      setError(readError(requestError, 'Could not upload attachment'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function remove(attachmentId: string) {
    setError(null);
    try {
      await api.delete(`/attachments/${attachmentId}`);
      setAttachments((current) => current.filter((item) => item.id !== attachmentId));
      if (preview?.id === attachmentId) setPreview(null);
    } catch (requestError) {
      setError(readError(requestError, 'Could not delete attachment'));
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void upload(file);
  }

  return (
    <>
      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              aria-label="Close expense details"
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[80] bg-foreground/30 backdrop-blur-sm"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={onClose}
              type="button"
            />
            <motion.aside
              animate={{ x: 0, y: 0 }}
              className="fixed inset-x-0 bottom-0 z-[90] flex max-h-[94vh] flex-col overflow-hidden rounded-t-3xl border border-border/60 bg-card shadow-lift md:inset-y-3 md:left-auto md:right-3 md:max-h-none md:w-[560px] md:rounded-3xl"
              exit={{ x: 24, y: 24, opacity: 0 }}
              initial={{ x: 24, y: 24, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <header className="flex items-start justify-between border-b border-border/50 p-5 sm:p-6">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Expense details</p>
                  <h2 className="mt-2 font-display text-3xl">{expense.merchant}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <MoneyDisplay amount={expense.amount} className="font-semibold text-foreground" decimals={2} />
                    <span>·</span><span>{formatDate(expense.date)}</span>
                    {expense.paymentMethod ? <><span>·</span><span className="capitalize">{expense.paymentMethod}</span></> : null}
                  </div>
                </div>
                <button className="rounded-[10px] p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground" onClick={onClose} type="button"><X className="h-5 w-5" /></button>
              </header>

              <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
                {expense.note ? <div className="rounded-2xl bg-secondary/40 p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Note</p><p className="mt-2 text-sm leading-6">{expense.note}</p></div> : null}

                <section className="space-y-3">
                  <div className="flex items-center justify-between"><div><h3 className="font-semibold">Add attachment</h3><p className="text-xs text-muted-foreground">Images or PDFs, up to 10 MB</p></div>
                    <select className="h-10 rounded-[10px] border border-input bg-card px-3 text-xs font-semibold capitalize" onChange={(event) => setLabel(event.target.value as (typeof LABELS)[number])} value={label}>{LABELS.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                  </div>
                  <div
                    className={`grid min-h-36 cursor-pointer place-items-center rounded-2xl border border-dashed p-5 text-center transition ${dragging ? 'border-primary bg-accent/70' : 'border-border bg-secondary/25 hover:border-primary/35 hover:bg-secondary/40'}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleDrop}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    {uploading ? <div><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-primary" /><p className="mt-3 text-sm font-semibold">Uploading securely...</p></div> : <div><UploadCloud className="mx-auto h-7 w-7 text-primary" strokeWidth={1.7} /><p className="mt-3 text-sm font-semibold">Drop a file here</p><p className="mt-1 text-xs text-muted-foreground">or tap to browse</p></div>}
                  </div>
                  <input accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" className="hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) void upload(file); }} ref={fileInputRef} type="file" />
                  {error ? <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between"><h3 className="font-semibold">Files</h3><span className="text-xs text-muted-foreground">{attachments.length} attached</span></div>
                  {loading ? [0, 1].map((item) => <Skeleton className="h-24 rounded-2xl" key={item} />) : null}
                  {!loading && attachments.length === 0 ? <EmptyState className="py-8" description="Keep receipts, invoices, and warranty documents with this expense." icon={Paperclip} title="No files attached" /> : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {attachments.map((attachment) => (
                      <AttachmentCard attachment={attachment} key={attachment.id} onDelete={() => void remove(attachment.id)} onPreview={() => setPreview(attachment)} />
                    ))}
                  </div>
                </section>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {preview ? (
          <motion.div animate={{ opacity: 1 }} className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-3 sm:p-8" exit={{ opacity: 0 }} initial={{ opacity: 0 }}>
            <div className="absolute right-4 top-4 flex gap-2">
              <a className="grid h-10 w-10 place-items-center rounded-[10px] bg-white/10 text-white hover:bg-white/20" href={preview.fileUrl} rel="noreferrer" target="_blank"><Download className="h-4 w-4" /></a>
              <button className="grid h-10 w-10 place-items-center rounded-[10px] bg-white/10 text-white hover:bg-white/20" onClick={() => setPreview(null)} type="button"><X className="h-5 w-5" /></button>
            </div>
            {preview.fileType === 'image' ? <img alt={preview.fileName} className="max-h-[88vh] max-w-full rounded-xl object-contain" src={preview.fileUrl} /> : <iframe className="h-[85vh] w-full max-w-5xl rounded-xl bg-white" src={preview.fileUrl} title={preview.fileName} />}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function AttachmentCard({ attachment, onPreview, onDelete }: { attachment: AttachmentRecord; onPreview: () => void; onDelete: () => void }) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-border/55 bg-raised">
      <button className="block h-32 w-full overflow-hidden bg-secondary/40" onClick={onPreview} type="button">
        {attachment.fileType === 'image' ? <img alt={attachment.fileName} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" src={attachment.fileUrl} /> : <span className="flex h-full flex-col items-center justify-center text-muted-foreground"><FileText className="h-9 w-9 text-danger" strokeWidth={1.5} /><span className="mt-2 max-w-[90%] truncate text-xs">{attachment.fileName}</span></span>}
      </button>
      <div className="flex items-center gap-2 p-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-accent text-primary">{attachment.fileType === 'image' ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{attachment.fileName}</p><p className="mt-0.5 text-[10px] capitalize text-muted-foreground">{attachment.label}</p></div>
        <button aria-label={`View ${attachment.fileName}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={onPreview} type="button"><Eye className="h-3.5 w-3.5" /></button>
        <button aria-label={`Delete ${attachment.fileName}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger" onClick={onDelete} type="button"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

function isSupported(file: File) {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'].includes(file.type);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function readError(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const message = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(', ');
  }
  return fallback;
}
