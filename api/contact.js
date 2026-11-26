// Edge serverless function that handles the Zambia Lobito Railway
// website enquiry form. It accepts a multipart/form-data POST,
// validates the input, and sends a notification via the Resend API.
//
// Required environment variables (Vercel Project Settings):
//   RESEND_API_KEY  - the Resend secret, starting "re_..."
//   MAIL_TO         - destination address(es), comma-separated
//   MAIL_FROM       - verified sender, e.g. "ZLR Website <noreply@zambialobitorail.com>"

export const config = { runtime: "edge" };

const SUBJECT = "New enquiry — Zambia Lobito Railway website";
const CORS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function clean(v) {
  return (v == null ? "" : String(v))
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function cleanMultiline(v) {
  return (v == null ? "" : String(v)).trim();
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

export default async function handler(req) {
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  let form;
  try {
    form = await req.formData();
  } catch {
    return json(400, { ok: false, error: "Invalid body" });
  }

  const name = clean(form.get("name")).slice(0, 200);
  const email = clean(form.get("email")).slice(0, 254);
  const org = clean(form.get("organisation")).slice(0, 200);
  const message = cleanMultiline(form.get("message")).slice(0, 5000);
  const honeypot = clean(form.get("website"));

  // Honeypot: accept silently, do nothing
  if (honeypot) return json(200, { ok: true });

  if (!name || !email || !message) {
    return json(400, { ok: false, error: "Missing required fields" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { ok: false, error: "Invalid email address" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toRaw = process.env.MAIL_TO;
  const from = process.env.MAIL_FROM;

  if (!apiKey || !toRaw || !from) {
    return json(500, { ok: false, error: "Mailer not configured" });
  }

  const to = toRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const now = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

  const text =
    `A new enquiry has been submitted via the Zambia Lobito Railway website.\n\n` +
    `Name:         ${name}\n` +
    `Email:        ${email}\n` +
    `Organisation: ${org || "—"}\n` +
    `----------------------------------------\n` +
    `Message:\n${message}\n` +
    `----------------------------------------\n` +
    `Submitted:    ${now}\n`;

  const hName = esc(name);
  const hEmail = esc(email);
  const hOrg = esc(org || "—");
  const hMsg = esc(message).replace(/\n/g, "<br>");

  const html =
    `<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#eef1f5;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f5;padding:28px 12px;">` +
    `<tr><td align="center">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">` +
    `<tr><td style="background-color:#0a1628;padding:22px 30px;" align="left">` +
    `<img src="https://zambialobitorail.com/assets/img/zlr-logo.png" alt="Zambia Lobito Railway" height="42" style="display:block;height:42px;border:0;">` +
    `</td></tr>` +
    `<tr><td style="background-color:#fcc00c;height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>` +
    `<tr><td style="padding:28px 30px 8px 30px;">` +
    `<div style="font-size:20px;font-weight:bold;color:#0a1628;">New website enquiry</div>` +
    `<div style="font-size:13px;color:#6b7280;padding-top:6px;">Submitted via the Zambia Lobito Railway website contact form</div>` +
    `</td></tr>` +
    `<tr><td style="padding:18px 30px 0 30px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;">` +
    `<tr><td style="padding:8px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;width:130px;vertical-align:top;">Name</td><td style="padding:8px 0;font-size:15px;color:#111827;">${hName}</td></tr>` +
    `<tr><td style="padding:8px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;vertical-align:top;">Email</td><td style="padding:8px 0;font-size:15px;"><a href="mailto:${hEmail}" style="color:#0a5bd3;text-decoration:none;">${hEmail}</a></td></tr>` +
    `<tr><td style="padding:8px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;vertical-align:top;">Organisation</td><td style="padding:8px 0;font-size:15px;color:#111827;">${hOrg}</td></tr>` +
    `</table></td></tr>` +
    `<tr><td style="padding:16px 30px 0 30px;">` +
    `<div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;padding-bottom:8px;">Message</div>` +
    `<div style="background-color:#f6f8fa;border-left:3px solid #fcc00c;padding:16px 18px;font-size:15px;line-height:1.6;color:#1f2937;">${hMsg}</div>` +
    `</td></tr>` +
    `<tr><td style="padding:18px 30px 26px 30px;"><div style="font-size:13px;color:#6b7280;">Reply to this email to respond directly to ${hName}.</div></td></tr>` +
    `<tr><td style="background-color:#f2f4f7;padding:14px 30px;"><div style="font-size:12px;color:#8a94a3;">${esc(now)}</div></td></tr>` +
    `</table></td></tr></table></body></html>`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to,
        subject: SUBJECT,
        reply_to: email,
        text,
        html
      })
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      console.error("Resend send failed", r.status, detail);
      return json(500, { ok: false, error: "Mail send failed" });
    }
  } catch (e) {
    console.error("Resend send threw", e && e.message);
    return json(500, { ok: false, error: "Mail send failed" });
  }

  // ---- Auto-responder to the sender ----
  // Best-effort: a failure here does NOT fail the request, because the
  // enquiry itself has already been delivered to the team above.
  const ackSubject = "We've received your enquiry — Zambia Lobito Railway";

  const ackText =
    `Dear ${name},\n\n` +
    `Thank you for contacting the Zambia Lobito Railway team. We have received your enquiry and a member of our team will be in touch shortly.\n\n` +
    `For your records, a copy of the details you submitted is below.\n\n` +
    `----------------------------------------\n` +
    `Name:         ${name}\n` +
    `Email:        ${email}\n` +
    `Organisation: ${org || "—"}\n` +
    `----------------------------------------\n` +
    `Message:\n${message}\n` +
    `----------------------------------------\n\n` +
    `Kind regards,\n` +
    `Zambia Lobito Railway\n` +
    `Africa Finance Corporation\n` +
    `info@zambialobitorail.com\n` +
    `www.zambialobitorail.com\n`;

  const ackHtml =
    `<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#eef1f5;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f5;padding:28px 12px;">` +
    `<tr><td align="center">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">` +
    `<tr><td style="background-color:#0a1628;padding:22px 30px;" align="left">` +
    `<img src="https://zambialobitorail.com/assets/img/zlr-logo.png" alt="Zambia Lobito Railway" height="42" style="display:block;height:42px;border:0;">` +
    `</td></tr>` +
    `<tr><td style="background-color:#fcc00c;height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>` +
    `<tr><td style="padding:28px 30px 8px 30px;">` +
    `<div style="font-size:20px;font-weight:bold;color:#0a1628;">Thank you for your enquiry</div>` +
    `<div style="font-size:15px;color:#1f2937;padding-top:12px;line-height:1.6;">Dear ${hName},</div>` +
    `<div style="font-size:15px;color:#1f2937;padding-top:10px;line-height:1.6;">We have received your enquiry regarding the Zambia Lobito Railway Project. A member of our team will be in touch shortly.</div>` +
    `<div style="font-size:15px;color:#1f2937;padding-top:10px;line-height:1.6;">For your records, a copy of the details you submitted is included below.</div>` +
    `</td></tr>` +
    `<tr><td style="padding:22px 30px 0 30px;">` +
    `<div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;padding-bottom:10px;">Your enquiry</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;">` +
    `<tr><td style="padding:8px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;width:130px;vertical-align:top;">Name</td><td style="padding:8px 0;font-size:15px;color:#111827;">${hName}</td></tr>` +
    `<tr><td style="padding:8px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;vertical-align:top;">Email</td><td style="padding:8px 0;font-size:15px;color:#111827;">${hEmail}</td></tr>` +
    `<tr><td style="padding:8px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;vertical-align:top;">Organisation</td><td style="padding:8px 0;font-size:15px;color:#111827;">${hOrg}</td></tr>` +
    `</table></td></tr>` +
    `<tr><td style="padding:16px 30px 0 30px;">` +
    `<div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;padding-bottom:8px;">Message</div>` +
    `<div style="background-color:#f6f8fa;border-left:3px solid #fcc00c;padding:16px 18px;font-size:15px;line-height:1.6;color:#1f2937;">${hMsg}</div>` +
    `</td></tr>` +
    `<tr><td style="padding:22px 30px 6px 30px;">` +
    `<div style="font-size:15px;color:#1f2937;line-height:1.6;">Kind regards,</div>` +
    `<div style="font-size:15px;color:#0a1628;font-weight:bold;padding-top:4px;">Zambia Lobito Railway</div>` +
    `</td></tr>` +
    `<tr><td style="padding:14px 30px 26px 30px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:top;padding-right:16px;">` +
    `<img src="https://zambialobitorail.com/assets/img/logos/afc.svg" alt="Africa Finance Corporation" height="36" style="display:block;height:36px;border:0;">` +
    `</td><td style="vertical-align:top;font-size:13px;color:#4b5563;line-height:1.6;">` +
    `<div style="font-weight:bold;color:#0a1628;">Africa Finance Corporation</div>` +
    `<div><a href="mailto:info@zambialobitorail.com" style="color:#0a5bd3;text-decoration:none;">info@zambialobitorail.com</a></div>` +
    `<div><a href="https://www.zambialobitorail.com" style="color:#0a5bd3;text-decoration:none;">www.zambialobitorail.com</a></div>` +
    `</td></tr></table>` +
    `</td></tr>` +
    `<tr><td style="background-color:#f2f4f7;padding:14px 30px;">` +
    `<div style="font-size:11px;color:#8a94a3;line-height:1.5;">This is an automated confirmation that your enquiry has been received. Please do not reply to this message; a member of the team will respond directly.</div>` +
    `</td></tr>` +
    `</table></td></tr></table></body></html>`;

  try {
    const ackRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: ackSubject,
        reply_to: to,
        text: ackText,
        html: ackHtml
      })
    });

    if (!ackRes.ok) {
      const detail = await ackRes.text().catch(() => "");
      console.error("Resend auto-responder failed", ackRes.status, detail);
    }
  } catch (e) {
    console.error("Resend auto-responder threw", e && e.message);
  }

  return json(200, { ok: true });
}
