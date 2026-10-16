import { mkdir, writeFile } from 'node:fs/promises';
import { emailDocument } from '../supabase/functions/blog-newsletter/email-layout.js';

const html = emailDocument({
  preheader: 'Your one-time link to Henry Starr’s blog. Confirm your email to continue.',
  label: 'ONE LAST STEP',
  title: 'Confirm your email',
  description: 'Use the button below to verify your email and return to the blog.',
  buttonLabel: 'Confirm email',
  buttonUrl: '{{ .ConfirmationURL }}',
  note: 'Joining the email list? You’ll confirm your subscription on the site. You can also use this link to sign in and comment.',
  footer: 'This link can be used once and expires soon. If you didn’t request it, you can safely ignore this email.',
  footerLink: { label: 'Button not working? Open this link.', url: '{{ .ConfirmationURL }}' },
});
await mkdir(new URL('../supabase/templates/', import.meta.url), { recursive: true });
await writeFile(new URL('../supabase/templates/confirm-email.html', import.meta.url), html);
console.log('Rendered supabase/templates/confirm-email.html');
