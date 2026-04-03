const AUTH_SESSION_STORAGE_KEY = "seamphore-auth-session-v1";
export const AUTH_SESSION_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

type PersistedAuthSession = {
  lastActiveAt?: string;
  signedAt: string;
  welcomeCompleted?: boolean;
  walletAddress: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeWalletAddress(walletAddress: string) {
  return walletAddress.trim().toLowerCase();
}

function parseSessionTimestamp(value: string | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isExpiredSession(session: PersistedAuthSession) {
  const lastActiveAt =
    parseSessionTimestamp(session.lastActiveAt) ?? parseSessionTimestamp(session.signedAt);

  if (lastActiveAt === null) {
    return true;
  }

  return Date.now() - lastActiveAt > AUTH_SESSION_INACTIVITY_TIMEOUT_MS;
}

export function readAuthSession() {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as PersistedAuthSession;

    if (typeof parsed.walletAddress !== "string" || !parsed.walletAddress.trim()) {
      return null;
    }

    if (typeof parsed.signedAt !== "string" || !parsed.signedAt.trim()) {
      return null;
    }

    if (isExpiredSession(parsed)) {
      window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return null;
    }

    return {
      lastActiveAt: parsed.lastActiveAt,
      signedAt: parsed.signedAt,
      welcomeCompleted: parsed.welcomeCompleted === true,
      walletAddress: parsed.walletAddress,
    };
  } catch {
    return null;
  }
}

export function hasPersistedAuthSession(walletAddress: string | null | undefined) {
  if (!walletAddress) {
    return false;
  }

  const session = readAuthSession();

  if (!session) {
    return false;
  }

  return normalizeWalletAddress(session.walletAddress) === normalizeWalletAddress(walletAddress);
}

export function persistAuthSession(walletAddress: string) {
  if (!canUseStorage()) {
    return;
  }

  const existingSession = readAuthSession();
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress);
  const now = new Date().toISOString();
  const nextSession: PersistedAuthSession = {
    lastActiveAt: now,
    signedAt: now,
    welcomeCompleted:
      existingSession?.welcomeCompleted === true &&
      normalizeWalletAddress(existingSession.walletAddress) === normalizedWalletAddress,
    walletAddress,
  };

  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(nextSession));
}

export function touchAuthSession(walletAddress: string | null | undefined) {
  if (!canUseStorage() || !walletAddress) {
    return;
  }

  const session = readAuthSession();

  if (!session || normalizeWalletAddress(session.walletAddress) !== normalizeWalletAddress(walletAddress)) {
    return;
  }

  window.localStorage.setItem(
    AUTH_SESSION_STORAGE_KEY,
    JSON.stringify({
      ...session,
      lastActiveAt: new Date().toISOString(),
    } satisfies PersistedAuthSession),
  );
}

export function hasCompletedWelcome(walletAddress: string | null | undefined) {
  if (!walletAddress) {
    return false;
  }

  const session = readAuthSession();

  if (!session) {
    return false;
  }

  return (
    normalizeWalletAddress(session.walletAddress) === normalizeWalletAddress(walletAddress) &&
    session.welcomeCompleted === true
  );
}

export function markWelcomeCompleted(walletAddress: string) {
  if (!canUseStorage()) {
    return;
  }

  const session = readAuthSession();

  if (!session || normalizeWalletAddress(session.walletAddress) !== normalizeWalletAddress(walletAddress)) {
    return;
  }

  window.localStorage.setItem(
    AUTH_SESSION_STORAGE_KEY,
    JSON.stringify({
      ...session,
      welcomeCompleted: true,
    } satisfies PersistedAuthSession),
  );
}

export function clearAuthSession() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}
