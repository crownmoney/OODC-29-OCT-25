// Calls to the Netlify Functions in netlify/functions. Secrets (the app
// password, the Anthropic API key) stay on the server; the browser only
// holds an HttpOnly session cookie.

export const login = async (password: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error || 'Login failed. Please try again.' };
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again.' };
  }
};

export const checkSession = async (): Promise<boolean> => {
  try {
    return (await fetch('/api/session')).ok;
  } catch {
    return false;
  }
};

export const logout = async () => {
  await fetch('/api/logout', { method: 'POST' }).catch(() => undefined);
};

export const askAI = async (params: {
  mode: 'chat' | 'builder';
  context: string;
  question: string;
  target?: string;
}): Promise<string> => {
  const res = await fetch('/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.text !== 'string') {
    throw new Error(data.error || `Assistant request failed (${res.status})`);
  }
  return data.text;
};
