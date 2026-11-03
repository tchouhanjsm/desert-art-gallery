import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const middleware = readFileSync(
  new URL("../../middleware.ts", import.meta.url),
  "utf8",
);
const adminLayout = readFileSync(
  new URL("../../app/admin/layout.tsx", import.meta.url),
  "utf8",
);

describe("protected route authentication contract", () => {
  it("fails closed for legacy admin and customer routes when Supabase identity is missing", () => {
    expect(middleware).toContain('const protectedRoute = path.startsWith("/account") || path.startsWith("/admin")');
    expect(middleware).toContain("if (!url || !anonKey)");
    expect(middleware).toContain('target.searchParams.set("error", "auth_unavailable")');
    expect(middleware).toContain("if (!protectedRoute) return NextResponse.next({ request })");
  });

  it("validates local owner sessions before rendering MySQL admin routes", () => {
    expect(middleware).toContain('if (mysqlAdminMode && path.startsWith("/admin")) return NextResponse.next({ request })');
    expect(adminLayout).toContain("getCurrentLocalAdmin()");
    expect(adminLayout).toContain('redirect("/owner/login?next=/admin")');
  });

  it("routes MySQL customer accounts to server-validated hashed sessions", () => {
    expect(middleware).toContain("const mysqlCustomerMode");
    expect(middleware).toContain('if (mysqlCustomerMode && path.startsWith("/account")) return NextResponse.next({ request })');
    expect(middleware).toContain("supabase.auth.getUser()");
  });

  it("continues validating the user and administrator role for legacy Supabase routes", () => {
    expect(middleware).toContain("supabase.auth.getUser()");
    expect(middleware).toContain("profile.role)");
    expect(middleware).toContain('["admin", "owner"]');
  });
});
