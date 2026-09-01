---
title: How This Blog Works
---

A short note to my future self on how this site is put together, since I'll inevitably forget.

## Writing a new post

Add a Markdown file to `_posts/` named `YYYY-MM-DD-some-title.md`, with front matter at the top:

```
---
title: Some Title
---

The rest is normal Markdown.
```

Commit it and push to `main`. GitHub Pages rebuilds the site automatically — nothing to run locally, no build step to remember. The post shows up on [/blog](/blog/), newest first, at `/YYYY/MM/DD/some-title/`.

## Editing a page

`index.md` is the front-page bio (layout `home`); `blog.md` is the post list (layout `blog`). Both work the same way — front matter, then Markdown. Nav links live in `_includes/nav.html`.

## How subscriptions work

The email box in the footer posts directly to a Supabase table (`subscribers`) using a publishable API key that's safe to expose client-side — it's restricted by row-level security to *inserting* new rows only, so it can't be used to read or export the list. Addresses live in the Supabase dashboard for that project. Actually emailing subscribers when a new post goes up isn't automated yet — that'd mean wiring up an email-sending service (Resend, Postmark, etc.) behind a Supabase edge function, triggered on new posts. Worth doing once there's an audience to email.
