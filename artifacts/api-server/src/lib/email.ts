import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Set RESEND_FROM_EMAIL to a verified sender domain address.
// Defaults to Resend's shared test sender (delivers only to the Resend account owner).
export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail({
  from,
  to,
  subject,
  body,
  bodyHtml,
}: {
  from?: string;
  to: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
}): Promise<string> {
  if (!emailEnabled()) throw new Error("RESEND_API_KEY not configured");

  const { data, error } = await resend.emails.send({
    from: from ?? FROM_EMAIL,
    to,
    subject,
    text: body,
    html: bodyHtml ?? `<p style="white-space:pre-wrap">${body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
  return data?.id ?? "";
}
