---
title: How This Blog Works
description: A look behind the scenes at the Markdown, Jekyll, and GitHub Pages setup that keeps this blog simple.
tags: [Building, Web]
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

`index.md` is the front page (layout `home`); `blog.md` is the searchable archive (layout `blog`); `about.md` contains the bio. Page copy goes after the front matter, while shared layouts live in `_layouts/`. Nav links live in `_includes/nav.html`.

## How subscriptions work

The email box in the footer uses Supabase to send a verification link. After opening that link, a reader confirms joining the list. The verified address is saved in the `subscribers` table using the reader’s session. Row-level security only allows a signed-in reader to subscribe their own address; it doesn’t allow readers to export the list. The publishable API key is safe to expose client-side, while the database enforces those permissions.

Addresses live in the Supabase dashboard for that project. Actually emailing subscribers when a new post goes up isn't automated yet — that'd mean wiring up an email-sending service (Resend, Postmark, etc.) behind a Supabase edge function, triggered on new posts. Worth doing once there's an audience to email.
