import { requireAdminPage } from "@/lib/auth-guards";
import { TwilioTestClient } from "./twilio-test-client";

export default async function TwilioTestPage() {
  await requireAdminPage();
  return <TwilioTestClient />;
}
