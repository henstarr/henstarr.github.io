# henryjstarr.com

Personal blog, built with Jekyll and hosted on GitHub Pages.

## Writing a post

Add a Markdown file to `_posts/` named `YYYY-MM-DD-title.md`:

```
---
title: Some Title
---

Body in Markdown.
```

Push to `main` — GitHub Pages rebuilds automatically, no local build required.

## Local preview (optional)

```
bundle install
bundle exec jekyll serve
```

## Email subscriptions

The footer subscribe form writes directly to a Supabase table (`subscribers`)
via a client-side publishable key restricted by row-level security to inserts
only. See the [How This Blog Works](/_posts/2026-08-30-how-this-blog-works.md)
post for details.
