import http from 'k6/http';
import { check, fail, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const TEST_JWT = __ENV.TEST_JWT;

export const options = {
  scenarios: {
    dashboard_summary: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 500 },
        { duration: '3m', target: 500 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_duration{name:dashboard-summary}': ['p(95)<500'],
    'http_req_failed{name:dashboard-summary}': ['rate<0.01'],
  },
};

export function setup() {
  if (!TEST_JWT) {
    fail('TEST_JWT is required. Example: TEST_JWT=<jwt> k6 run loadtests/dashboard.js');
  }
}

export default function () {
  const response = http.get(`${BASE_URL}/dashboard/summary`, {
    headers: {
      Authorization: `Bearer ${TEST_JWT}`,
      Accept: 'application/json',
    },
    tags: { name: 'dashboard-summary' },
  });

  check(response, {
    'dashboard returned 200': (result) => result.status === 200,
    'dashboard returned JSON': (result) =>
      (result.headers['Content-Type'] || '').includes('application/json'),
  });

  sleep(Math.random() * 1.5 + 0.5);
}
