// Thin fetch wrapper. Auth uses an httpOnly cookie set by the API, so no token handling here.
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const DEMO = import.meta.env.VITE_DEMO === 'true';

/** URL for viewing an attachment (demo mode serves in-memory blob URLs). */
export const fileUrl = (grievanceId, attachmentId) =>
  (DEMO ? (window.__cmkDemoFiles || {})[attachmentId] || '#' : `/api/grievances/${grievanceId}/attachments/${attachmentId}`);

async function request(method, url, body) {
  if (DEMO) {
    const { mockRequest } = await import('../demo/mockApi.js');
    const r = await mockRequest(method, url, body);
    if (!r.ok) throw new ApiError(r.status, r.data?.error || 'Request failed', r.data?.details);
    return r.data;
  }
  const opts = { method, credentials: 'include', headers: {} };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`/api${url}`, opts);
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, data?.details);
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body ?? {}),
  patch: (url, body) => request('PATCH', url, body),
};

/** Map zod field errors → { field: message } for inline form errors. */
export const fieldErrors = (err) =>
  Object.fromEntries((err?.details || []).map((d) => [d.field, d.message]));

export const qs = (obj) => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (v !== '' && v !== undefined && v !== null && v !== false) p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};
