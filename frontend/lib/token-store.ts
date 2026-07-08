export type SessionUser = {
  sub: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  authProvider: 'local' | 'google';
};

type Session = {
  accessToken: string | null;
  user: SessionUser | null;
};

let session: Session = {
  accessToken: null,
  user: null,
};

let onSessionChange: ((nextSession: Session) => void) | null = null;

export function getAccessToken() {
  return session.accessToken;
}

export function getSession() {
  return session;
}

export function setSession(nextSession: Session) {
  session = nextSession;
  onSessionChange?.(session);
}

export function clearSession() {
  setSession({ accessToken: null, user: null });
}

export function subscribeToSession(callback: (nextSession: Session) => void) {
  onSessionChange = callback;
  return () => {
    if (onSessionChange === callback) {
      onSessionChange = null;
    }
  };
}

export function userFromAccessToken(accessToken: string): SessionUser | null {
  try {
    const [, payload] = accessToken.split('.');
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const json = JSON.parse(atob(padded));
    return {
      sub: json.sub,
      email: json.email,
      name: json.name,
      avatarUrl: json.avatarUrl ?? null,
      authProvider: json.authProvider,
    };
  } catch {
    return null;
  }
}
