import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, authorizedClaims, publishedPosts } from '../supabase/functions/blog-newsletter/handler.js';

const claims = { repository_id: '1353002292', repository_owner_id: '123694490', repository: 'henstarr/henstarr.github.io', ref: 'refs/heads/main', workflow_ref: 'henstarr/henstarr.github.io/.github/workflows/notify-posts.yml@refs/heads/main', event_name: 'workflow_dispatch', run_id: '12', run_attempt: '1' };
const old = { url: 'https://www.henryjstarr.com/2026/08/31/why-i-rebuilt-this-site/', title: 'Why I Rebuilt This Site', published_at: '2026-08-31T00:00:00Z', description: 'A place for writing.' };
const post = { url: 'https://www.henryjstarr.com/2026/10/15/a-new-post/', title: 'A <new> post', published_at: '2026-10-15T00:00:00Z', description: 'Notes & ideas.' };
const early = { id: '11111111-1111-4111-8111-111111111111', email: 'reader@example.test', created_at: '2026-10-01T00:00:00Z' };
const late = { id: '22222222-2222-4222-8222-222222222222', email: 'later@example.test', created_at: '2026-10-17T00:00:00Z' };
function fixture({ manifest = [old, post], subscribers = [early, late], providerFails = false } = {}) {
  const state = { posts: [{ ...old, status: 'baseline', first_seen_at: '2026-10-01T00:00:00Z' }], deliveries: [], subscribers: structuredClone(subscribers), emails: [], providerFails };
  const env = name => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEYS: '{"default":"sb_secret_test_only"}', RESEND_API_KEY: 're_test_only' })[name];
  const request = async (urlString, options = {}) => {
    const url = new URL(urlString);
    if (url.pathname === '/newsletter.json') return Response.json({ posts: manifest });
    const payload = options.body ? JSON.parse(options.body) : null;
    if (url.origin === 'https://api.resend.com') {
      state.emails.push({ body: payload, headers: options.headers });
      return state.providerFails ? Response.json({ error: 'temporarily unavailable' }, { status: 429 }) : Response.json({ id: 'email-' + state.emails.length });
    }
    const table = url.pathname.split('/').at(-1);
    const key = { newsletter_posts: 'posts', newsletter_deliveries: 'deliveries', subscribers: 'subscribers' }[table];
    assert.ok(key, 'Only expected database tables may be accessed');
    if (options.method === 'POST') {
      if (table === 'newsletter_posts') state.posts.push({ ...payload, status: 'pending', first_seen_at: '2026-10-16T00:00:00Z' });
      if (table === 'newsletter_deliveries') state.deliveries.push(payload);
      return new Response(null, { status: 201 });
    }
    let rows = state[key].filter(row => [...url.searchParams].every(([column, value]) => !value.startsWith('eq.') || row[column] === value.slice(3)));
    if (options.method === 'PATCH') { rows.forEach(row => Object.assign(row, payload)); return new Response(null, { status: 204 }); }
    if (options.method === 'DELETE') { state[key] = state[key].filter(row => !rows.includes(row)); return new Response(null, { status: 204 }); }
    const offset = Number(url.searchParams.get('offset') || 0);
    const limit = Number(url.searchParams.get('limit') || 500);
    return Response.json(rows.slice(offset, offset + limit));
  };
  const handler = createHandler({ env, fetch: request, verifyToken: async token => token === 'valid' ? claims : { ...claims, ref: 'refs/heads/untrusted' }, sleep: async () => {}, now: () => Date.parse('2026-10-16T00:00:00Z') });
  const invoke = (mode, token = 'valid') => handler(new Request('https://example.supabase.co/functions/v1/blog-newsletter', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) }));
  return { state, handler, invoke };
}

test('only the main-branch workflow can authorize email jobs', async () => {
  assert.equal(authorizedClaims(claims), true);
  for (const changed of [{ repository_id: 'wrong' }, { repository_owner_id: 'wrong' }, { workflow_ref: 'other' }, { event_name: 'pull_request' }, { ref: 'refs/heads/untrusted' }]) assert.equal(authorizedClaims({ ...claims, ...changed }), false);
  const { invoke, state } = fixture();
  assert.equal((await invoke('sync', 'invalid')).status, 401);
  assert.equal(state.emails.length, 0);
});
test('preview has no database writes or outgoing email', async () => {
  const { invoke, state } = fixture();
  assert.deepEqual(await (await invoke('preview')).json(), { published_posts: 2, subscribers: 2, unseen_posts: 1, email_ready: true });
  assert.equal(state.posts.length, 1);
  assert.equal(state.emails.length, 0);
});
test('a new post sends once, keeps the baseline quiet, and excludes later subscribers', async () => {
  const { invoke, state } = fixture();
  assert.deepEqual(await (await invoke('sync')).json(), { sent: 1, more: false });
  assert.equal(state.emails.length, 1);
  assert.deepEqual(state.emails[0].body.to, [early.email]);
  assert.match(state.emails[0].body.html, /A &lt;new&gt; post/);
  assert.ok(state.emails[0].headers['Idempotency-Key']);
  assert.ok(state.emails[0].body.headers['List-Unsubscribe']);
  assert.deepEqual(await (await invoke('sync')).json(), { sent: 0, more: false });
  assert.equal(state.emails.length, 1);
});
test('a provider failure never writes a sent receipt and can be retried', async () => {
  const { invoke, state } = fixture({ providerFails: true });
  assert.equal((await invoke('sync')).status, 503);
  assert.equal(state.deliveries.length, 0);
  const originalKey = state.emails[0].headers['Idempotency-Key'];
  state.providerFails = false;
  assert.equal((await invoke('sync')).status, 200);
  assert.equal(state.emails[1].headers['Idempotency-Key'], originalKey);
  assert.equal(state.deliveries.length, 1);
});
test('test mode is restricted to the owner and does not enroll or mail subscribers', async () => {
  const { invoke, state } = fixture();
  assert.equal((await invoke('test')).status, 200);
  assert.deepEqual(state.emails[0].body.to, ['henry.j.starr@gmail.com']);
  assert.match(state.emails[0].body.subject, /^\[Test\]/);
  assert.equal(state.deliveries.length, 0);
  assert.equal(state.posts.length, 1);
});
test('unsubscribe requires a valid signed link; scanning GET does not remove consent', async () => {
  const { invoke, state, handler } = fixture();
  await invoke('sync');
  const link = state.emails[0].body.headers['List-Unsubscribe'].slice(1, -1);
  assert.equal((await handler(new Request(link))).status, 200);
  assert.equal(state.subscribers.length, 2);
  assert.equal((await handler(new Request(link.replace(/.$/, 'z'), { method: 'POST' }))).status, 403);
  assert.equal(state.subscribers.length, 2);
  assert.equal((await handler(new Request(link, { method: 'POST' }))).status, 200);
  assert.equal(state.subscribers.some(row => row.id === early.id), false);
});
test('the published manifest rejects foreign links and defers future posts', () => {
  assert.throws(() => publishedPosts({ posts: [{ ...post, url: 'https://untrusted.example/post' }] }));
  assert.equal(publishedPosts({ posts: [post, { ...old, published_at: '2030-01-01' }] }, Date.parse('2026-10-16')).length, 1);
});
