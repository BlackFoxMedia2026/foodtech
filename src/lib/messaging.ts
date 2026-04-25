// Provider-agnostic SMS / WhatsApp adapter.
// Currently supports Twilio (HTTP REST API, no SDK) and falls back to a
// no-op logger when credentials are missing. Add more providers by
// implementing the same `MessagingProvider` interface.

export type MessageChannel = "SMS" | "WHATSAPP";

export type SendMessageInput = {
  to: string; // E.164 number (+39...)
  body: string;
  channel: MessageChannel;
};

export type SendMessageResult =
  | { ok: true; id: string; provider: string }
  | { ok: false; reason: "no_provider" | "send_error"; provider: string; error?: string };

interface MessagingProvider {
  name: string;
  send(input: SendMessageInput): Promise<SendMessageResult>;
}

class TwilioProvider implements MessagingProvider {
  name = "twilio";
  constructor(
    private accountSid: string,
    private authToken: string,
    private fromSms?: string,
    private fromWa?: string,
  ) {}
  async send(input: SendMessageInput): Promise<SendMessageResult> {
    const from =
      input.channel === "WHATSAPP"
        ? this.fromWa
        : this.fromSms;
    if (!from) {
      return { ok: false, reason: "no_provider", provider: this.name, error: "no from number" };
    }
    const to = input.channel === "WHATSAPP" ? `whatsapp:${input.to}` : input.to;
    const fromValue = input.channel === "WHATSAPP" ? `whatsapp:${from}` : from;
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: to, From: fromValue, Body: input.body }).toString(),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, reason: "send_error", provider: this.name, error: text.slice(0, 200) };
      }
      const data = (await res.json()) as { sid?: string };
      return { ok: true, id: data.sid ?? "", provider: this.name };
    } catch (err) {
      return {
        ok: false,
        reason: "send_error",
        provider: this.name,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

class NoopProvider implements MessagingProvider {
  name = "noop";
  async send(input: SendMessageInput): Promise<SendMessageResult> {
    console.log(`[messaging:noop] ${input.channel} to ${input.to}: ${input.body.slice(0, 80)}…`);
    return { ok: false, reason: "no_provider", provider: this.name };
  }
}

let _provider: MessagingProvider | null = null;
function provider(): MessagingProvider {
  if (_provider) return _provider;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (sid && token) {
    _provider = new TwilioProvider(
      sid,
      token,
      process.env.TWILIO_FROM_SMS,
      process.env.TWILIO_FROM_WHATSAPP,
    );
  } else {
    _provider = new NoopProvider();
  }
  return _provider;
}

export function isMessagingEnabled() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

export function whichMessagingProvider() {
  return isMessagingEnabled() ? "twilio" : "noop";
}

export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  return provider().send(input);
}
