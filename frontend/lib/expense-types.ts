export type Category = {
  id: string;
  userId: string | null;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean;
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
  lineItems?: Array<{
    name: string;
    quantity?: string | null;
    price?: string | null;
  }>;
};

export type ExpenseRecord = {
  id: string;
  householdId: string | null;
  amount: string;
  merchant: string;
  categoryId: string | null;
  paymentMethod: 'upi' | 'card' | 'cash' | 'netbanking' | null;
  date: string;
  note: string | null;
  source: 'text' | 'voice' | 'ocr' | 'manual';
  rawInput: string | null;
  receiptUrl: string | null;
  createdAt: string;
  tags: ExpenseTag[];
};

export type ExpenseTag = {
  id: string;
  name: string;
};

export type AttachmentRecord = {
  id: string;
  expenseId: string;
  fileUrl: string;
  fileName: string;
  fileType: 'image' | 'pdf';
  label: 'receipt' | 'invoice' | 'warranty' | 'other';
  uploadedAt: string;
};
