import { Category } from '../../database/schema';

export type ParsedExpenseDraft = {
  merchant: string | null;
  amount: string | null;
  category: string | null;
  payment_method: 'upi' | 'card' | 'cash' | 'netbanking' | null;
  date: string | null;
  note?: string | null;
};

export type ParsedReceiptDraft = {
  store: string | null;
  date: string | null;
  gst_amount: string | null;
  total_amount: string | null;
  line_items: Array<{
    name: string;
    quantity?: string | null;
    price?: string | null;
  }>;
  category: string | null;
};

export type ExpensePreview = {
  merchant: string;
  amount: string | null;
  category: Category | null;
  categoryName: string | null;
  paymentMethod: 'upi' | 'card' | 'cash' | 'netbanking' | null;
  date: string;
  note: string | null;
  source: 'text' | 'voice' | 'ocr' | 'manual';
  rawInput: string;
  receiptUrl?: string | null;
  gstAmount?: string | null;
  lineItems?: ParsedReceiptDraft['line_items'];
};
