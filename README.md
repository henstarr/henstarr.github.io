# henryjstarr.com

Henry Starr’s personal blog, built with Jekyll and hosted on GitHub Pages.

## Local development

Use Ruby 3.3 (the macOS system Ruby is too old), then:

```sh
bundle install
bundle exec jekyll serve
```

Open `http://127.0.0.1:4000`. On a Mac with Homebrew Ruby 3.3 installed, prefix commands with `PATH="/opt/homebrew/opt/ruby@3.3/bin:$PATH"` if needed. Dependencies are locked in `Gemfile.lock`; generated output, local gems, and browser artifacts are ignored by Git.

## Writing a post

Add `_posts/YYYY-MM-DD-title.md`:

```yaml
---
title: Some Title
description: A short, useful summary for post lists and search previews.
tags: [Building, Web]
---
```

Write the body in Markdown below the front matter. Dates come from filenames. Reading times, topic links, archive year groups, RSS, and older/newer navigation are generated from the posts. Use existing tag names where possible to keep the archive consistent. Posts can use `description` for a deliberate preview; otherwise, the first paragraph is used.

The homepage features the newest post, followed by up to five older posts. The archive lists every post with full-text search and combined topic filters. Archive filters are preserved in the URL so filtered views can be shared. Posts remain readable and the archive remains browsable without JavaScript.

## Editing pages and styles

- `index.md`: selects the homepage layout.
- `about.md`: author biography and introduction.
- `blog.md`: selects the archive layout at `/blog/`.
- `_layouts/default.html`: shared document, navigation, main landmark, footer, and dialogs.
- `_includes/`: shared metadata, post listings, author card, navigation, and subscription form.
- `assets/css/style.css`: shared palette, typography, spacing, and responsive styles.
- `assets/js/blog.js`: archive filters, article contents, and copy-link behavior.

Keep the same navigation and footer across pages. There is no first-visit popup; sign-in dialogs open only when a reader requests them. Dialogs use native browser focus management, Escape support, and keyboard containment.

## Validate before publishing

```sh
bundle exec jekyll build --strict_front_matter
bundle exec ruby scripts/check_site.rb
node --check assets/js/blog.js
node --check assets/js/site.js
node --check assets/js/subscribe.js
node --check assets/js/post-engagement.js
node --test tests/newsletter.test.mjs
```

The site checker validates local URLs and anchors, unique IDs, page titles and descriptions, form labels, shared navigation, homepage post deduplication, RSS, and sitemap XML. Browser verification should also cover archive search, topic deep links, mobile widths, dialog focus, and form success/failure states. Mock subscription and authentication requests during browser tests to avoid creating accounts, sending email, or inserting test subscriber addresses.

Push reviewed changes to `main` to trigger the existing GitHub Pages build. `CNAME` retains the custom domain; post permalinks are unchanged.

## Email list and reader accounts

The footer verifies addresses using Supabase magic links, then asks the verified reader to confirm joining. It stores the verified address in the existing `subscribers` table using the reader’s access token. The existing insert policy only permits a signed-in user to subscribe their own email; anonymous inserts are intentionally blocked. The `?subscribe=1` return URL opens the confirmation state without automatically enrolling anyone. **This site does not send automated new-post emails.** The form and post copy state that addresses are saved for future updates. Readers can use `/feed.xml` to follow new posts immediately, or email the author to leave the list.

The pinned Supabase 2.118.0 browser bundle is served locally from `assets/vendor/` with its MIT license; its npm tarball integrity was verified before vendoring. Local asset URLs include a shared build version to avoid mixing old JavaScript with new page markup after a deployment.

Supabase also provides magic-link sign-in, comments and likes. `assets/js/site.js` initializes the client; `post-engagement.js` only runs on article pages. Display names fall back to “Reader” rather than revealing part of an email address. Database authorization belongs in RLS policies, never client state. Never add a secret or service-role key to the frontend.

The backend project must be active for subscriptions and reader interactions. Restore it in Supabase if paused. Failed calls show a readable error and retain comment/email input for retry; they do not block reading. Confirm that Supabase Auth’s allowed redirect URLs include the production domain before testing magic links.

Authentication and new-post emails share the inline HTML layout in `supabase/functions/blog-newsletter/email-layout.js`. Run `node scripts/render_emails.mjs` after changing that design. Paste the generated `supabase/templates/confirm-email.html` into both **Confirm sign up** and **Magic link or OTP** in Supabase Authentication → Emails, with subject **Confirm your email · Henry Starr**. Saving a file in this repository does not update Supabase’s hosted Auth templates. Keep `{{ .ConfirmationURL }}` intact so Supabase supplies each one-time link. The email correctly explains that joining the list requires confirmation on the site after email verification.

## Layout references

Familiar blog patterns informed the structure: [Josh W. Comeau](https://www.joshwcomeau.com/) for clear article summaries and topic browsing, and [Simon Willison](https://simonwillison.net/) for searchable archives, dated entries, and RSS. The blog retains its own warm paper palette and serif typography.

## New-post email workflow

`.github/workflows/notify-posts.yml` calls the deployed `blog-newsletter` Edge Function after the successful “pages build and deployment” GitHub Pages workflow. A twice-hourly retry catches delayed publications and failed deliveries. Manual dispatch supports `preview`, `test` (only the owner), and `sync`.

The function reads the **published** `/newsletter.json` manifest, so an email links to a live post. The current archive is recorded as a baseline. It emails only new posts, only to readers who subscribed before that post was first observed, and records each successful recipient delivery. Stable Resend idempotency keys prevent duplicates when a request is retried. An unfinished batch resumes on the next run.

Authentication uses short-lived GitHub Actions OIDC identities restricted to this repository ID, its owner ID, `main`, and the exact notification workflow. No long-lived GitHub-to-Supabase credential is needed. The function verifies these identities itself (`verify_jwt = false` disables only Supabase's legacy JWT gateway). All delivery-ledger tables have RLS enabled and no access for `anon` or `authenticated` roles.

`RESEND_API_KEY` must be configured in Supabase Edge Function secrets. Use a sending-only key restricted to `henryjstarr.com`. The sender is `Henry Starr <noreply@henryjstarr.com>` with replies routed to the author. Database credentials use Supabase's server-only default secrets. Never put either credential in a public file, workflow log, or browser bundle.

Each notification includes a signed unsubscribe link and one-click unsubscribe headers. Opening the link displays confirmation; a POST removes the subscriber. Link previews and email scanners making GET requests do not unsubscribe readers.

The function source lives in `supabase/functions/blog-newsletter/`. The SQL migration creates private delivery receipts and seeds the current archive without sending it. Deploy source changes with the Supabase function tooling, preserve the key, and run the Node tests before pushing. Use a manual `test` workflow run and check both Resend delivery status and the recipient inbox to verify the live pipeline.
