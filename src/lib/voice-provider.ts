// Voice assistant adapter — scaffold.
// Real providers (Twilio Voice, Vapi, Retell, etc.) plug in here by
// implementing the `VoiceProvider` interface. By default we use a no-op
// provider that simply logs the intent.

export type VoiceCallbackPayload = {
  fromNumber: string;
  transcript?: string;
  recordingUrl?: string;
  durationSec?: number;
};

export type CallbackResult = {
  ok: boolean;
  message?: string;
};

interface VoiceProvider {
  name: string;
  enabled: boolean;
  scheduleCallback(input: VoiceCallbackPayload): Promise<CallbackResult>;
}

class NoopVoiceProvider implements VoiceProvider {
  name = "noop";
  enabled = false;
  async scheduleCallback(input: VoiceCallbackPayload): Promise<CallbackResult> {
    console.log(
      `[voice:noop] callback queued for ${input.fromNumber} (transcript: ${input.transcript?.slice(0, 60) ?? "—"})`,
    );
    return { ok: true, message: "queued (noop)" };
  }
}

class TwilioVoiceProvider implements VoiceProvider {
  name = "twilio-voice";
  enabled = true;
  constructor(
    private accountSid: string,
    private authToken: string,
    private from: string,
  ) {}

  async scheduleCallback(input: VoiceCallbackPayload): Promise<CallbackResult> {
    // Real implementation would create a Twilio call with TwiML that says a
    // pre-recorded message + reads back the booking summary, or trigger a
    // Studio flow. We keep this as a stub that just returns ok so the rest of
    // the system can wire-in without a live account.
    void this.accountSid;
    void this.authToken;
    void this.from;
    void input;
    return { ok: true, message: "twilio callback scheduled (stub)" };
  }
}

let _voice: VoiceProvider | null = null;
export function voiceProvider(): VoiceProvider {
  if (_voice) return _voice;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_VOICE;
  if (sid && token && from) {
    _voice = new TwilioVoiceProvider(sid, token, from);
  } else {
    _voice = new NoopVoiceProvider();
  }
  return _voice;
}

export function isVoiceEnabled() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_VOICE,
  );
}
