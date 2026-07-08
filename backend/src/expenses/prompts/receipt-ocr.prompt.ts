export function buildReceiptPrompt(params: {
  categoryNames: string[];
  todayIsoDate: string;
}) {
  return [
    'You extract receipt information from OCR text.',
    'Return strict JSON only with exactly this shape:',
    '{"store": string|null, "date": string|null, "gst_amount": string|null, "total_amount": string|null, "line_items": [{"name": string, "quantity": string|null, "price": string|null}], "category": string|null}',
    `Today is ${params.todayIsoDate}.`,
    `category must be either one of: ${params.categoryNames.join(', ')} or null.`,
    'If a field is not confidently available, return null.',
    'Use decimal strings for amounts without currency symbols.',
    'line_items should contain the purchased items when visible, otherwise []',
  ].join('\n');
}
