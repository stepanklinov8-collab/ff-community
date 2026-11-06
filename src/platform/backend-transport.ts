export const backendProxyPrefix = '/api/backend';
export type BackendTransport = 'direct' | 'proxy';

export function websiteRequestOrigin(request: Request): string {
  const url=new URL(request.url);
  return new URL(url.protocol+'//'+(request.headers.get('host')??url.host)).origin;
}

/** Explicit release flag. Keeping the canonical project URL preserves SDK cookies. */
export function backendTransport(value = process.env.NEXT_PUBLIC_SUPABASE_TRANSPORT): BackendTransport {
  if (!value || value === 'direct') return 'direct';
  if (value === 'proxy') return 'proxy';
  throw new Error('Unknown Supabase transport');
}

const authMethods: Record<string, readonly string[]> = {
  signup: ['POST'], token: ['POST'], verify: ['POST', 'GET'], recover: ['POST'],
  resend: ['POST'], logout: ['POST'], user: ['GET', 'PUT'], settings: ['GET'],
  reauthenticate: ['GET'],
};

export function allowedBackendRequest(path: string, method: string): boolean {
  if (!path.startsWith('/') || /[\\\x00-\x20]/.test(path) || /%2f|%5c|%2e|%00/i.test(path)) return false;
  const parts = path.slice(1).split('/');
  if (parts.some(p => !p || p === '.' || p === '..')) return false;
  if (parts[0] === 'auth' && parts[1] === 'v1' && parts.length === 3) return !!authMethods[parts[2]]?.includes(method);
  if (parts[0] === 'rest' && parts[1] === 'v1') {
    const valid = parts.length === 3 || parts.length === 4 && parts[2] === 'rpc';
    return valid && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parts.at(-1)!) && ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
  }
  return parts[0] === 'storage' && parts[1] === 'v1' && parts[2] === 'object' && parts[3] === 'public'
    && ['avatars', 'event-images'].includes(parts[4]) && parts.length > 5 && ['GET', 'HEAD'].includes(method);
}

export function proxyBackendUrl(raw: string, endpoint: string, origin: string): string {
  const url = new URL(raw), backend = new URL(endpoint);
  if (url.origin !== backend.origin || url.username || url.password) throw new Error('Unexpected backend destination');
  return new URL(backendProxyPrefix + url.pathname + url.search, origin).href;
}

/** Public image URLs in stored records stay canonical: rollback needs no data rewrite. */
export function backendImageUrl(src: string, endpoint = process.env.NEXT_PUBLIC_SUPABASE_URL, mode = backendTransport()): string {
  if (mode !== 'proxy' || !endpoint) return src;
  try {
    const url = new URL(src);
    return url.origin === new URL(endpoint).origin && allowedBackendRequest(url.pathname, 'GET') && url.pathname.startsWith('/storage/v1/')
      ? backendProxyPrefix + url.pathname + url.search : src;
  } catch { return src; }
}
