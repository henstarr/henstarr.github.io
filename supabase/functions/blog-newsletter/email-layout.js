const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Inline styles and presentation tables keep the layout usable in email clients
// that strip stylesheets. The media query only improves the mobile spacing.
export function emailDocument({ preheader, label, title, description, buttonLabel, buttonUrl, note, footer, footerLink }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escape(title)} · Henry Starr</title>
  <style>
    @media only screen and (max-width: 620px) {
      .email-wrap { padding: 28px 16px !important; }
      .email-card { padding: 32px 24px !important; }
      .email-title { font-size: 32px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f5f1e9;color:#2b2925;-webkit-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;line-height:1px;color:#f5f1e9;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escape(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f5f1e9" style="width:100%;background-color:#f5f1e9;">
    <tr><td align="center" class="email-wrap" style="padding:40px 20px;">
      <!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
        <tr><td style="padding:0 0 24px;">
          <a href="https://www.henryjstarr.com" style="font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:32px;color:#2b2925;text-decoration:none;">Henry Starr<span style="color:#7a2e3e;">.</span></a>
          <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6e685f;">Software, AI, and things I’m building.</p>
        </td></tr>
        <tr><td bgcolor="#fcfaf6" class="email-card" style="padding:40px;background-color:#fcfaf6;border:1px solid #d8d2c7;border-top:3px solid #7a2e3e;border-radius:4px;">
          <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;line-height:18px;letter-spacing:2px;color:#7a2e3e;">${escape(label)}</p>
          <h1 class="email-title" style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:38px;font-weight:400;line-height:1.16;letter-spacing:-0.8px;color:#2b2925;">${escape(title)}</h1>
          <p style="margin:0 0 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:#514c44;">${escape(description)}</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 26px;">
            <tr><td align="center" bgcolor="#7a2e3e" style="background-color:#7a2e3e;border-radius:4px;mso-padding-alt:15px 24px;">
              <a href="${escape(buttonUrl)}" style="display:inline-block;padding:15px 24px;border:1px solid #7a2e3e;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;mso-padding-alt:0;">${escape(buttonLabel)} <span aria-hidden="true">&rarr;</span></a>
            </td></tr>
          </table>
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#6e685f;">${escape(note)}</p>
          <p style="margin:26px 0 0;padding-top:22px;border-top:1px solid #e3ddd2;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;color:#6e685f;">${escape(footer)}${footerLink ? ` <a href="${escape(footerLink.url)}" style="color:#7a2e3e;text-decoration:underline;">${escape(footerLink.label)}</a>` : ""}</p>
        </td></tr>
        <tr><td style="padding:22px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;color:#6e685f;">
          A note from <a href="https://www.henryjstarr.com" style="color:#6e685f;text-decoration:underline;">Henry Starr’s blog</a>.
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>
`;
}
