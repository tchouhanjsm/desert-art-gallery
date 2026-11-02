import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const middleware = readFileSync(
  new URL("../../middleware.ts", import.meta.url),
  "utf8",
);

describe("protected route authentication contract", () => {
  it("fails closed for admin and account routes when Supabase identity configuration is missing", () => {
    expect(middleware).toContain("const protectedRoute = path.startsWith(\"/admin\") || path.startsWith(\"/account\")");
    expect(middleware).toContain("if (!url || !anonKey)");
    expect(middleware).toContain('target.searchParams.set("error", "auth_unavailable")');
    expect(middleware).toContain("if (!protectedRoute) return NextResponse.next({ request })");
  });

  it("continues validating the user and the administrator role when identity is configured", () => {
    expect(middleware).toContain("supabase.auth.getUser()");
    expect(middleware).toContain('profile.role)');
    expect(middleware).toContain('[\"admin\", \"owner\"]');
  });
});
