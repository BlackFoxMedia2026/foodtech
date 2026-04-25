import { Resend } from "resend";

type EmailRecipient = {
  email: string;
  name?: string | null;
};

export type SendEmailInput = {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; reason: "no_api_key" | "invalid_input" | "send_error"; error?: string };

const FROM = process.env.RESEND_FROM || "Tavolo <noreply@tavolo.local>";

let _client: Resend | null = null;
function client() {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _client = new Resend(key);
  return _client;
}

export function isEmailEnabled() {
  return Boolean(process.env.RESEND_API_KEY);
}

function format(r: EmailRecipient) {
  return r.name ? `${r.name} <${r.email}>` : r.email;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const c = client();
  if (!c) {
    console.log(
      `[email:noop] would send "${input.subject}" → ${
        Array.isArray(input.to)
          ? input.to.map((t) => t.email).join(", ")
          : input.to.email
      }`,
    );
    return { ok: false, reason: "no_api_key" };
  }
  try {
    const to = Array.isArray(input.to) ? input.to.map(format) : [format(input.to)];
    const { data, error } = await c.emails.send({
      from: FROM,
      to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    });
    if (error) {
      console.error("[email:error]", error);
      return { ok: false, reason: "send_error", error: error.message };
    }
    return { ok: true, id: data?.id ?? "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email:exception]", msg);
    return { ok: false, reason: "send_error", error: msg };
  }
}
