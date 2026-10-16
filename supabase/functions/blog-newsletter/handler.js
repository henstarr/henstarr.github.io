const SITE = "https://www.henryjstarr.com";
const OWNER = "henry.j.starr@gmail.com";
const FROM = "Henry Starr <noreply@henryjstarr.com>";
const WORKFLOW = "henstarr/henstarr.github.io/.github/workflows/notify-posts.yml@refs/heads/main";
const encoder = new TextEncoder();
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function authorizedClaims(claims) {
  return claims.repository_id === "1353002292" && claims.repository_owner_id === "123694490" &&
    claims.repository === "henstarr/henstarr.github.io" && claims.ref === "refs/heads/main" &&
    claims.workflow_ref === WORKFLOW && ["workflow_run", "workflow_dispatch", "schedule"].includes(claims.event_name);
}

export function publishedPosts(manifest, now = Date.now()) {
  if (!Array.isArray(manifest.posts)) throw new Error("Invalid published manifest");
  return manifest.posts.map(post => {
    const url = new URL(post.url);
    if (url.origin !== SITE || !/^\/\d{4}\/\d{2}\/\d{2}\/[\w-]+\/$/.test(url.pathname) || url.search || url.hash ||
        typeof post.title !== "string" || !post.title.trim() || post.title.length > 250 ||
        !Number.isFinite(Date.parse(post.published_at))) throw new Error("Invalid published post");
    return { url: url.href, title: post.title, description: String(post.description || "").slice(0, 300), published_at: post.published_at };
  }).filter(post => Date.parse(post.published_at) <= now);
}

async function hmac(secret, value, signature) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  if (signature) {
    if (!/^[a-f0-9]{64}$/.test(signature)) return false;
    return crypto.subtle.verify("HMAC", key, Uint8Array.from(signature.match(/../g), byte => parseInt(byte, 16)), encoder.encode(value));
  }
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export function emailContent(post, unsubscribe, test = false) {
  const subject = `${test ? "[Test] " : ""}New post: ${post.title}`;
  const ending = unsubscribe ? `You subscribed to Henry Starr’s blog. Unsubscribe: ${unsubscribe}` : "This delivery test was requested by the blog owner. No subscriber mailing was sent.";
  const text = `${post.title}\n\n${post.description}\n\nRead the post: ${post.url}\n\n${ending}`;
  const html = `<div style="background:#f5f1e9;padding:36px 20px;font-family:Georgia,serif;color:#2b2925"><div style="max-width:580px;margin:auto"><p style="font:12px Arial,sans-serif;letter-spacing:2px;color:#7a2e3e">HENRY STARR · NEW WRITING</p><h1 style="font-weight:normal;font-size:34px;line-height:1.2">${escape(post.title)}</h1><p style="font-size:18px;line-height:1.7">${escape(post.description)}</p><p style="margin:28px 0"><a style="color:#7a2e3e" href="${escape(post.url)}">Read the post →</a></p><hr style="border:0;border-top:1px solid #d8d2c7;margin:32px 0"><p style="font:12px/1.7 Arial,sans-serif;color:#6e685f">${unsubscribe ? `You subscribed to Henry Starr’s blog. <a href="${escape(unsubscribe)}">Unsubscribe</a>.` : escape(ending)}</p></div></div>`;
  return { subject, text, html };
}

export function createHandler({ env, verifyToken, fetch: request = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = () => Date.now() }) {
  function serverKey() {
    const keys = env("SUPABASE_SECRET_KEYS");
    return (keys && Object.values(JSON.parse(keys))[0]) || env("SUPABASE_SERVICE_ROLE_KEY");
  }
  const endpoint = () => env("SUPABASE_URL") + "/functions/v1/blog-newsletter";
  async function db(path, method = "GET", body, prefer) {
    const key = serverKey();
    if (!key) throw new Error("Database credentials unavailable");
    const headers = { apikey: key, "Content-Type": "application/json" };
    if (key.startsWith("eyJ")) headers.Authorization = "Bearer " + key;
    if (prefer) headers.Prefer = prefer;
    const response = await request(env("SUPABASE_URL") + "/rest/v1/" + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error("Database request failed: " + response.status);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  async function allRows(path) {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const batch = await db(path + "&limit=500&offset=" + offset);
      rows.push(...batch);
      if (batch.length < 500) return rows;
    }
  }
  async function send(post, address, idempotency, unsubscribe, test) {
    const key = env("RESEND_API_KEY");
    if (!key) throw new Error("RESEND_API_KEY is not configured");
    const content = emailContent(post, unsubscribe, test);
    const response = await request("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", "Idempotency-Key": idempotency },
      body: JSON.stringify({ from: FROM, to: [address], reply_to: OWNER, ...content, ...(unsubscribe ? { headers: { "List-Unsubscribe": "<" + unsubscribe + ">", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}) }),
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok || !result.id) throw new Error("Email provider rejected the request: " + response.status);
    return result.id;
  }
  async function unsubscribe(req, url) {
    const token = url.searchParams.get("token") || "";
    const [id, signature] = token.split(".");
    if (!/^[a-f0-9-]{36}$/.test(id || "") || !signature || !(await hmac(serverKey(), "unsubscribe:" + id, signature))) return json({ error: "Invalid unsubscribe link" }, 403);
    if (req.method === "POST") {
      await db("subscribers?id=eq." + id, "DELETE");
      return new Response("You have been unsubscribed from Henry Starr’s blog.", { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
    }
    if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
    return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unsubscribe · Henry Starr</title><body style="background:#f5f1e9;color:#2b2925;font:18px/1.7 Georgia,serif;max-width:560px;margin:12vh auto;padding:24px"><h1>Leave the email list?</h1><p>Confirm below to stop new-post emails from Henry Starr’s blog.</p><form method="post"><button style="background:#7a2e3e;color:white;border:0;padding:14px 24px;font:16px Arial,sans-serif">Unsubscribe</button></form><p><a href="${SITE}">Back to the blog</a></p></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" } });
  }
  return async req => {
    try {
      const url = new URL(req.url);
      if (url.searchParams.get("action") === "unsubscribe") return await unsubscribe(req, url);
      if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
      const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
      let claims;
      try { claims = token && await verifyToken(token, endpoint()); } catch { return json({ error: "Unauthorized" }, 401); }
      if (!claims || !authorizedClaims(claims)) return json({ error: "Unauthorized" }, 401);
      const { mode = "preview" } = await req.json();
      if (!["preview", "test", "sync"].includes(mode)) return json({ error: "Invalid mode" }, 400);
      const response = await request(SITE + "/newsletter.json", { headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error("Published post manifest is unavailable");
      const posts = publishedPosts(await response.json(), now());
      if (mode === "test") {
        if (!posts.length) return json({ error: "No published post to test" }, 409);
        const id = await send(posts[0], OWNER, "newsletter-test-" + claims.run_id + "-" + claims.run_attempt, null, true);
        return json({ test: true, recipient: OWNER, provider_id: id, subject: emailContent(posts[0], null, true).subject });
      }
      const existing = await allRows("newsletter_posts?select=*");
      const subscribers = await allRows("subscribers?select=id,email,created_at");
      if (mode === "preview") return json({ published_posts: posts.length, subscribers: subscribers.length, unseen_posts: posts.filter(post => !existing.some(row => row.url === post.url)).length, email_ready: !!env("RESEND_API_KEY") });
      const states = new Map(existing.map(row => [row.url, row]));
      let sent = 0;
      for (const post of posts.slice().reverse()) {
        let state = states.get(post.url);
        if (state && state.status !== "pending") continue;
        if (!state) {
          await db("newsletter_posts?on_conflict=url", "POST", { url: post.url, title: post.title, published_at: post.published_at }, "resolution=ignore-duplicates,return=minimal");
          [state] = await db("newsletter_posts?url=eq." + encodeURIComponent(post.url));
          if (state.status !== "pending") continue;
        }
        const deliveries = await allRows("newsletter_deliveries?select=subscriber_id&post_url=eq." + encodeURIComponent(post.url));
        const alreadySent = new Set(deliveries.map(row => row.subscriber_id));
        const recipients = subscribers.filter(subscriber => Date.parse(subscriber.created_at) <= Date.parse(state.first_seen_at) && !alreadySent.has(subscriber.id));
        for (const subscriber of recipients) {
          // Recheck consent immediately before sending; an earlier unsubscribe wins.
          const [active] = await db("subscribers?select=id&id=eq." + subscriber.id);
          if (!active) continue;
          const signature = await hmac(serverKey(), "unsubscribe:" + subscriber.id);
          const unsubscribeUrl = endpoint() + "?action=unsubscribe&token=" + subscriber.id + "." + signature;
          const idempotency = await hmac(serverKey(), post.url + ":" + subscriber.id);
          const providerId = await send(post, subscriber.email, "blog-post-" + idempotency, unsubscribeUrl, false);
          await db("newsletter_deliveries?on_conflict=post_url,subscriber_id", "POST", { post_url: post.url, subscriber_id: subscriber.id, provider_id: providerId }, "resolution=ignore-duplicates,return=minimal");
          sent++;
          if (sent >= 40) return json({ sent, more: true });
          await sleep(650);
        }
        await db("newsletter_posts?url=eq." + encodeURIComponent(post.url), "PATCH", { status: "complete", completed_at: new Date(now()).toISOString() });
      }
      return json({ sent, more: false });
    } catch (error) {
      console.error("Newsletter job failed:", error.message);
      return json({ error: "Newsletter delivery failed. Check the function logs before retrying." }, 503);
    }
  };
}
