import { requireAdminPage } from "@/lib/auth-guards";
import { TwistTestClient } from "./twist-test-client";

export default async function TwistTestPage() {
  await requireAdminPage();
  return <TwistTestClient />;
}
