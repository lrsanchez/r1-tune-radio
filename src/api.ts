const TOKEN = (import.meta.env['VITE_TOKEN'] as string | undefined) ?? '';

export type Station = { id: string; name: string; logo: string | null; nowPlaying: string | null };
export type BrowseResult = { links: { id: string; title: string }[]; stations: Station[] };
export type TuneResult = { stream: string; codec: string; bitrate: number };

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path, window.location.origin);
  url.searchParams.set('token', TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  browse: (id?: string) => get<BrowseResult>('/browse', id ? { id } : {}),
  search: (q: string) => get<{ stations: Station[] }>('/search', { q }),
  tune: (id: string) => get<TuneResult>('/tune', { id }),
};
