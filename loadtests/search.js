import http from 'k6/http';
import { check, fail, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const TEST_JWT = __ENV.TEST_JWT;

export const options = {
  scenarios: {
    expense_search: {
      executor: 'constant-vus',
      vus: 300,
      duration: '3m',
      gracefulStop: '30s',
    },
  },
  thresholds: {
    'http_req_duration{name:expense-search}': ['p(95)<500'],
    'http_req_failed{name:expense-search}': ['rate<0.01'],
  },
};

function authHeaders() {
  return {
    Authorization: `Bearer ${TEST_JWT}`,
    Accept: 'application/json',
  };
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function dateDaysAgo(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return isoDate(date);
}

function queryString(parameters) {
  return Object.keys(parameters)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(parameters[key])}`)
    .join('&');
}

export function setup() {
  if (!TEST_JWT) {
    fail('TEST_JWT is required. Example: TEST_JWT=<jwt> k6 run loadtests/search.js');
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
  return { categoryIds: categories.map((category) => category.id) };
}

export default function (data) {
  // A non-zero bit mask produces every combination of amount/category/date
  // filters instead of testing each filter only in isolation.
  const filterMask = Math.floor(Math.random() * 7) + 1;
  const parameters = {
    page: Math.floor(Math.random() * 5) + 1,
    limit: 20,
  };

  if (filterMask & 1) {
    const minimum = [0, 100, 500, 1_000, 5_000][Math.floor(Math.random() * 5)];
    const maximum = minimum + [500, 1_000, 5_000, 20_000][Math.floor(Math.random() * 4)];
    parameters.min_amount = minimum.toFixed(2);
    parameters.max_amount = maximum.toFixed(2);
  }

  if (filterMask & 2) {
    parameters.category_id =
      data.categoryIds[Math.floor(Math.random() * data.categoryIds.length)];
  }

  if (filterMask & 4) {
    const endDaysAgo = Math.floor(Math.random() * 300);
    const windowDays = [7, 30, 90][Math.floor(Math.random() * 3)];
    parameters.date_from = dateDaysAgo(Math.min(365, endDaysAgo + windowDays));
    parameters.date_to = dateDaysAgo(endDaysAgo);
  }

  const response = http.get(
    `${BASE_URL}/expenses/search?${queryString(parameters)}`,
    {
      headers: authHeaders(),
      tags: { name: 'expense-search' },
    },
  );

  check(response, {
    'search returned 200': (result) => result.status === 200,
    'search returned pagination': (result) => {
      try {
        return Boolean(result.json().pagination);
      } catch (_) {
        return false;
      }
    },
  });

  sleep(Math.random() * 0.8 + 0.2);
}
