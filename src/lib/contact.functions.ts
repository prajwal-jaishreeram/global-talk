import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  subject: z.string().trim().min(1, "Subject is required").max(160),
  message: z.string().trim().min(1, "Message is required").max(4000),
});

type ContactPayload = z.infer<typeof contactSchema>;

function envValue(key: string) {
  return process.env[key] ?? (import.meta.env as Record<string, string | undefined>)[key];
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function supportEmail() {
  return envValue("SUPPORT_EMAIL") ?? "support@eginta.com";
}

function resendFromEmail() {
  return envValue("RESEND_FROM_EMAIL") ?? "Eginta <noreply@eginta.com>";
}

function resendApiKey() {
  const key = envValue("RESEND_API_KEY");
  if (!key) throw new Error("Support email is not configured on the server.");
  return key;
}

function messageText(data: ContactPayload) {
  return [
    data.message,
    "",
    "Sender",
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Subject: ${data.subject}`,
  ].join("\n");
}

function messageHtml(data: ContactPayload) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111827">
      <h2 style="margin:0 0 16px">New Eginta support message</h2>
      <p style="white-space:pre-wrap;margin:0 0 20px">${escapeHtml(data.message)}</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Name</td><td>${escapeHtml(data.name)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Email</td><td>${escapeHtml(data.email)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Subject</td><td>${escapeHtml(data.subject)}</td></tr>
      </table>
    </div>
  `;
}

export const sendContactSupportEmail = createServerFn({ method: "POST" })
  .inputValidator((input) => contactSchema.parse(input))
  .handler(async ({ data }) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey()}`,
        "Content-Type": "application/json",
        "User-Agent": "eginta-contact-form/1.0",
      },
      body: JSON.stringify({
        from: resendFromEmail(),
        to: [supportEmail()],
        reply_to: data.email,
        subject: `[Eginta Support] ${data.subject}`,
        text: messageText(data),
        html: messageHtml(data),
      }),
    });

    const json = (await res.json().catch(() => null)) as
      | { id?: string; message?: string; error?: string | { message?: string } }
      | null;

    if (!res.ok) {
      const detail =
        typeof json?.error === "string"
          ? json.error
          : json?.error?.message ?? json?.message ?? `Resend returned ${res.status}`;
      throw new Error(detail);
    }

    return { id: json?.id ?? null };
  });
