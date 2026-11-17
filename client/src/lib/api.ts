import { getTabToken } from './identity';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public errors?: { card?: number; name?: string; message: string }[],
  ) {
    super(message);
  }
}

export async function api<T = any>(method: string, url: string, body?: unknown, token = getTabToken()): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, { method, headers, body: payload });
  const ct = res.headers.get('content-type') ?? '';
  const data = ct.includes('json') ? await res.json() : await res.blob();
  if (!res.ok) throw new ApiError(res.status, (data as any)?.code ?? 'ERROR', (data as any)?.error ?? res.statusText, (data as any)?.errors);
  return data as T;
}

/** Downloads a file from an authenticated endpoint. */
export async function download(url: string, fallbackName: string) {
  const token = getTabToken();
  const res = await fetch(url, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, 'ERROR', 'Download failed');
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

let imageKey = '';
export function setImageKey(k: string) {
  imageKey = k;
}
export function imageUrl(id: string, thumb = false, share?: string) {
  const q = new URLSearchParams();
  if (imageKey) q.set('k', imageKey);
  if (share) q.set('share', share);
  return `/api/images/${id}${thumb ? '.thumb' : ''}.webp?${q}`;
}
