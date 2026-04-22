const SESSION_KEY = "harley-raffle-session-id";

export const getOrCreateSessionId = (): string => {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const generated = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(SESSION_KEY, generated);
  return generated;
};
