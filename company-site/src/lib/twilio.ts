import Twilio from "twilio";

// ── Configuration ───────────────────────────────────────────────────

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

function getClient() {
  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)");
  }
  return Twilio(accountSid, authToken);
}

// ── Phone number formatting ─────────────────────────────────────────

/**
 * Normalize a phone number to E.164 format.
 * Assumes US (+1) if no country code is provided.
 */
export function formatPhoneNumber(phone: string): string {
  if (phone.startsWith("+")) return phone;

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "");

  // 10-digit US number → add +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // Already has country code digits
  return `+${cleaned}`;
}

// ── SMS sending functions ───────────────────────────────────────────

export interface SmsResult {
  success: boolean;
  messageSid?: string;
  status?: string;
  error?: string;
  code?: number;
  details?: string;
}

/**
 * Send a 2FA verification code via SMS.
 */
export async function sendOtpCode(toPhone: string, code: string): Promise<SmsResult> {
  if (!fromPhone) {
    return { success: false, error: "Twilio phone number not configured (TWILIO_PHONE_NUMBER)" };
  }

  const formattedTo = formatPhoneNumber(toPhone);

  try {
    const client = getClient();
    const message = await client.messages.create({
      from: fromPhone,
      to: formattedTo,
      body: `Your BioGrammatics verification code is: ${code}. This code expires in 10 minutes.`,
    });

    console.log(`Twilio SMS sent - SID: ${message.sid}, Status: ${message.status}`);
    return { success: true, messageSid: message.sid, status: message.status };
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err) {
      const twilioErr = err as { code: number; message: string; moreInfo?: string };
      console.error(`Twilio error - Code: ${twilioErr.code}, Message: ${twilioErr.message}`);
      return {
        success: false,
        error: twilioErr.message,
        code: twilioErr.code,
        details: twilioErr.moreInfo,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Unexpected SMS error: ${message}`);
    return { success: false, error: message };
  }
}

/**
 * Send a phone verification code (for initial phone setup).
 */
export async function sendPhoneVerification(toPhone: string, code: string): Promise<SmsResult> {
  if (!fromPhone) {
    return { success: false, error: "Twilio phone number not configured" };
  }

  const formattedTo = formatPhoneNumber(toPhone);

  try {
    const client = getClient();
    const message = await client.messages.create({
      from: fromPhone,
      to: formattedTo,
      body: `Your BioGrammatics phone verification code is: ${code}. Enter this code to verify your phone number.`,
    });

    return { success: true, messageSid: message.sid, status: message.status };
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err) {
      const twilioErr = err as { code: number; message: string; moreInfo?: string };
      return {
        success: false,
        error: twilioErr.message,
        code: twilioErr.code,
        details: twilioErr.moreInfo,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Send a generic test SMS (for admin testing).
 */
export async function sendTestSms(toPhone: string, messageBody: string): Promise<SmsResult> {
  if (!fromPhone) {
    return { success: false, error: "Twilio phone number not configured" };
  }

  const formattedTo = formatPhoneNumber(toPhone);

  try {
    const client = getClient();
    const message = await client.messages.create({
      from: fromPhone,
      to: formattedTo,
      body: messageBody,
    });

    return { success: true, messageSid: message.sid, status: message.status };
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err) {
      const twilioErr = err as { code: number; message: string; moreInfo?: string };
      return {
        success: false,
        error: twilioErr.message,
        code: twilioErr.code,
        details: twilioErr.moreInfo,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Check if Twilio credentials are configured.
 */
export function getTwilioStatus() {
  return {
    accountSid: accountSid ? `${accountSid.substring(0, 10)}...` : "NOT SET",
    authToken: authToken ? "configured" : "NOT SET",
    phoneNumber: fromPhone || "NOT SET",
    ready: !!(accountSid && authToken && fromPhone),
  };
}
