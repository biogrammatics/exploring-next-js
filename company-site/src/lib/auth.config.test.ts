import { describe, it, expect } from "vitest";
import { authConfig } from "./auth.config";
import { makeSession } from "@/test/session-fixtures";

// Exercise the `authorized` callback in isolation. Note (finding #6): this
// callback is NOT currently wired into a middleware.ts, so these guarantees
// only hold once it is. The tests document the intended contract.
const authorized = authConfig.callbacks!.authorized!;

function run(pathname: string, authed: boolean) {
  return authorized({
    auth: authed ? (makeSession("USER") as never) : null,
    request: { nextUrl: { pathname } } as never,
  } as never);
}

describe("authorized() route protection", () => {
  it.each(["/admin", "/admin/products", "/account", "/account/orders"])(
    "blocks anonymous access to protected path %s",
    (path) => {
      expect(run(path, false)).toBe(false);
    }
  );

  it.each(["/admin", "/account/orders"])(
    "allows authenticated access to protected path %s",
    (path) => {
      expect(run(path, true)).toBe(true);
    }
  );

  it.each(["/", "/vectors", "/checkout", "/strains/abc"])(
    "leaves public path %s open",
    (path) => {
      expect(run(path, false)).toBe(true);
    }
  );
});
