import { z } from 'zod';

const paymentMethods = ['upi', 'card', 'cash', 'netbanking'] as const;
const uuidList = z.string().refine(
  (value) => value.split(',').every((item) => z.string().uuid().safeParse(item.trim()).success),
  'Must be a comma-separated list of UUIDs',
);
const paymentMethodList = z.string().refine(
  (value) =>
    value
      .split(',')
      .every((item) => paymentMethods.includes(item.trim() as (typeof paymentMethods)[number])),
  'Invalid payment method',
);
const amount = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid positive amount');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must use YYYY-MM-DD');

export const searchExpensesSchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    min_amount: amount.optional(),
    max_amount: amount.optional(),
    category_id: uuidList.optional(),
    payment_method: paymentMethodList.optional(),
    date_from: isoDate.optional(),
    date_to: isoDate.optional(),
    tag_id: uuidList.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .superRefine((value, context) => {
    if (
      value.min_amount !== undefined &&
      value.max_amount !== undefined &&
      Number(value.min_amount) > Number(value.max_amount)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'min_amount cannot exceed max_amount',
        path: ['min_amount'],
      });
    }

    if (value.date_from && value.date_to && value.date_from > value.date_to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'date_from cannot be after date_to',
        path: ['date_from'],
      });
    }
  });

export type SearchExpensesDto = z.infer<typeof searchExpensesSchema>;
