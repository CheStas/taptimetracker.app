// The site's Cloudflare Worker. Cloudflare serves dist/ as static assets without running this; only /api/* comes here
// (assets.run_worker_first in wrangler.jsonc).
import { onRequestPost } from './feedback.ts';

type Env = Parameters<typeof onRequestPost>[0]['env'];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname !== '/api/feedback') return new Response('Not found', { status: 404 });
    if (request.method !== 'POST') return new Response('POST only', { status: 405, headers: { allow: 'POST' } });
    return onRequestPost({ request, env });
  },
};
