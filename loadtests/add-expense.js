import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const TEST_JWT = __ENV.TEST_JWT;
const flowErrors = new Rate('add_expense_flow_errors');

const EXPENSE_TEXTS = [
  'Spent ₹450 at Swiggy on food via UPI today',
  'Paid ₹1,850 at DMart for groceries using card today',
  'Spent ₹720 on petrol at IndianOil via UPI today',
  'Bought clothes from Myntra for ₹2,499 using card today',
  'Paid ₹350 to PVR INOX for entertainment today',
  'Spent ₹280 on an Uber ride via UPI today',
];

export const options = {
  scenarios: {
    add_expense_flow: {
      executor: 'constant-vus',
      vus: 200,
      duration: '3m',
      gracefulStop: '30s',
    },
  },
  thresholds: {
    add_expense_flow_errors: ['rate<0.01'],
  },
};

function authHeaders() {
  return {
    Authorization: `Bearer ${TEST_JWT}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export function setup() {
  if (!TEST_JWT) {
    fail('TEST_JWT is required. Example: TEST_JWT=<jwt> k6 run loadtests/add-expense.js');
  }

  const response = http.get(`${BASE_URL}/categories`, {
    headers: authHeaders(),
    tags: { name: 'setup-categories' },
  });
  if (response.status !== 200) {
    fail(`Unable to load categories: HTTP ${response.status} ${response.body}`);
  }

  const body = response.json();
  const categories = body && Array.isArray(body.categories) ? body.categories : [];
  if (categories.length === 0) {
    fail('The test user has no available categories. Run database migrations first.');
  }

  return {
    categoriesByName: categories.reduce((result, category) => {
      result[String(category.name).toLowerCase()] = category.id;
      return result;
    }, {}),
    fallbackCategoryId: categories[0].id,
  };
}

export default function (data) {
  const text = EXPENSE_TEXTS[Math.floor(Math.random() * EXPENSE_TEXTS.length)];
  const parseResponse = http.post(
    `${BASE_URL}/expenses/parse`,
    JSON.stringify({ text }),
    {
      headers: authHeaders(),
      tags: { name: 'expense-parse' },
    },
  );

  const parseOk = check(parseResponse, {
    'parse returned 2xx': (response) => response.status >= 200 && response.status < 300,
    'parse returned a preview': (response) => {
      try {
        return Boolean(response.json().preview);
      } catch (_) {
        return false;
      }
    },
  });

  if (!parseOk) {
    flowErrors.add(true);
    sleep(1);
    return;
  }

  let preview;
  try {
    preview = parseResponse.json().preview;
  } catch (_) {
    flowErrors.add(true);
    sleep(1);
    return;
  }

  const categoryName = String(preview.categoryName || '').toLowerCase();
  const categoryId =
    (preview.category && preview.category.id) ||
    data.categoriesByName[categoryName] ||
    data.fallbackCategoryId;
  const createPayload = {
    amount: preview.amount,
    merchant: preview.merchant,
    categoryId,
    paymentMethod: preview.paymentMethod || null,
    date: preview.date,
    note: preview.note || null,
    source: preview.source || 'text',
    rawInput: preview.rawInput || text,
  };

  const createResponse = http.post(
    `${BASE_URL}/expenses`,
    JSON.stringify(createPayload),
    {
      headers: authHeaders(),
      tags: { name: 'expense-create' },
    },
  );
  const createOk = check(createResponse, {
    'create returned 2xx': (response) => response.status >= 200 && response.status < 300,
    'create returned an expense': (response) => {
      try {
        return Boolean(response.json().expense && response.json().expense.id);
      } catch (_) {
        return false;
      }
    },
  });

  flowErrors.add(!createOk);
  sleep(Math.random() + 0.5);
}
