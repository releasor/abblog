import { escapeHtml } from "./highlight";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@billionaire.dev";

export async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.warn("[Mailer] RESEND_API_KEY not set, skipping email to", to);
    return null;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    if (!res.ok) {
      console.error("[Mailer] Failed:", await res.text());
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error("[Mailer] Error:", e);
    return null;
  }
}

export function notificationEmailTemplate(
  title: string,
  message: string,
  link?: string
) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeLink = link ? escapeHtml(link) : undefined;
  return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="font-size:18px;margin-bottom:16px;">${safeTitle}</h2>
      <p style="color:#52525b;line-height:1.6;">${safeMessage}</p>
      ${safeLink ? `<a href="${safeLink}" style="display:inline-block;margin-top:16px;padding:8px 20px;background:#18181b;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;">查看</a>` : ""}
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;" />
      <p style="color:#a1a1aa;font-size:12px;">billionaire — AI 与数字生活的无限可能</p>
    </div>
  `;
}
