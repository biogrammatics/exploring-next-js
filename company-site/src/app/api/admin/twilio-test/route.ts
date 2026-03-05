import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTwilioStatus, sendTestSms } from "@/lib/twilio";
import { sendTestSmsSchema, formatZodError } from "@/lib/validations";

/**
 * GET /api/admin/twilio-test — Check Twilio configuration status
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = getTwilioStatus();
  return NextResponse.json({ status });
}

/**
 * POST /api/admin/twilio-test — Send a test SMS
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = sendTestSmsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(formatZodError(parsed.error), { status: 400 });
    }

    const { phone, message } = parsed.data;
    const result = await sendTestSms(phone, message);

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageSid: result.messageSid,
        status: result.status,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        code: result.code,
        details: result.details,
      }, { status: 400 });
    }
  } catch (error) {
    console.error("Twilio test error:", error);
    return NextResponse.json(
      { error: "Failed to send test SMS" },
      { status: 500 }
    );
  }
}
