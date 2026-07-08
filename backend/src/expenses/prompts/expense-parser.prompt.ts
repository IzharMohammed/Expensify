export function buildExpenseParserPrompt(params: {
  categoryNames: string[];
  todayIsoDate: string;
}) {
  const categories = params.categoryNames.join(', ');

  return [
    'You extract structured expense data from casual user input.',
    'Return strict JSON only. No markdown. No explanation.',
    'Use exactly this shape: {"merchant": string|null, "amount": string|null, "category": string|null, "payment_method": "upi"|"card"|"cash"|"netbanking"|null, "date": string|null, "note": string|null}.',
    'Rules:',
    '1. category must either be an exact match from the allowed category list or null.',
    '2. Never invent a category not in the list.',
    '3. amount must be a decimal string like "420" or "1850". Remove currency symbols and commas.',
    '4. merchant should be the payee/store/service if reasonably clear.',
    '5. payment_method should be inferred only when the wording suggests it, otherwise null.',
    `6. Today is ${params.todayIsoDate}. If the user does not specify a date, use today.`,
    '7. If multiple numbers exist, choose the one most likely to be the paid amount, not flat number-like invoice ids, phone numbers, or dates.',
    '8. Hindi/English mixed text is allowed. Understand phrases like "diya", "bhar diya", "makaan ka rent".',
    '9. note should preserve useful context not represented elsewhere, otherwise null.',
    `Allowed categories: ${categories}`,
    'Few-shot examples:',
    'Input: "Swiggy 420"',
    'Output: {"merchant":"Swiggy","amount":"420","category":"Food","payment_method":null,"date":"' +
      params.todayIsoDate +
      '","note":null}',
    'Input: "Petrol 1000"',
    'Output: {"merchant":"Petrol pump","amount":"1000","category":"Petrol","payment_method":null,"date":"' +
      params.todayIsoDate +
      '","note":null}',
    'Input: "Paid electricity bill 1850"',
    'Output: {"merchant":"Electricity bill","amount":"1850","category":null,"payment_method":null,"date":"' +
      params.todayIsoDate +
      '","note":"utility bill"}',
    'Input: "makaan ka rent 15000 diya"',
    'Output: {"merchant":"House rent","amount":"15000","category":"Rent","payment_method":null,"date":"' +
      params.todayIsoDate +
      '","note":null}',
    'Input: "Big Bazaar 2 items 1340 card se"',
    'Output: {"merchant":"Big Bazaar","amount":"1340","category":"Grocery","payment_method":"card","date":"' +
      params.todayIsoDate +
      '","note":"2 items"}',
    'Input: "SBI EMI 4/12 paid 8260 via UPI"',
    'Output: {"merchant":"SBI EMI","amount":"8260","category":"EMI","payment_method":"upi","date":"' +
      params.todayIsoDate +
      '","note":"installment 4 of 12"}',
    'Input: "train ticket PNR 2910493812 860"',
    'Output: {"merchant":"Train ticket","amount":"860","category":"Travel","payment_method":null,"date":"' +
      params.todayIsoDate +
      '","note":"PNR 2910493812"}',
  ].join('\n');
}
