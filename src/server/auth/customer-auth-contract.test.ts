import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const auth = readFileSync(new URL("./local-customer.ts", import.meta.url), "utf8");
const accountPage = readFileSync(new URL("../../app/account/customer-page.tsx", import.meta.url), "utf8");
const registerAction = readFileSync(new URL("../../app/register/actions.ts", import.meta.url), "utf8");
const cartSync = readFileSync(new URL("../../app/api/cart/sync/route.ts", import.meta.url), "utf8");
const wishlistSync = readFileSync(new URL("../../app/api/wishlist/sync/route.ts", import.meta.url), "utf8");
const checkoutPage = readFileSync(new URL("../../app/checkout/page.tsx", import.meta.url), "utf8");
const orderRoute = readFileSync(new URL("../../app/api/checkout/orders/route.ts", import.meta.url), "utf8");

describe("MySQL customer identity contract", () => {
  it("keeps customer mode opt-in and dependent on the MySQL catalogue database", () => {
    expect(auth).toContain('MYSQL_CUSTOMER_AUTH_ENABLED?.trim().toLowerCase() === "true"');
    expect(auth).toContain('MYSQL_CATALOGUE_ENABLED?.trim().toLowerCase() !== "true"');
    expect(auth).toContain("DATABASE_URL");
  });

  it("enforces the feature flag inside customer auth services and serializes failed-login lockout updates", () => {
    expect(auth).toContain("function requireCustomerAuthEnabled()");
    expect(auth.match(/requireCustomerAuthEnabled\(\);/g)?.length).toBeGreaterThanOrEqual(2);
    expect(auth).toContain("if (!isMySqlCustomerAuthEnabled()) return null;");
    const login = auth.slice(
      auth.indexOf("export async function createLocalCustomerSession"),
      auth.indexOf("export async function getCurrentCustomer"),
    );
    expect(login).toContain("getMySqlDb().transaction(async (tx)");
    expect(login).toContain('.for("update")');
    expect(login).toContain("return { status: \"invalid\" as const };");
    expect(login).toContain('throw new Error("Email or password is incorrect.");');
    expect(login).not.toContain("Sign-in is temporarily locked");
  });

  it("hashes passwords and stores only digests of random, expiring browser sessions", () => {
    expect(auth).toContain("hashOwnerPassword(input.password)");
    expect(auth).toContain('createHash("sha256")');
    expect(auth).toContain('randomBytes(32).toString("base64url")');
    expect(auth).toContain("httpOnly: true");
    expect(auth).toContain('sameSite: "lax"');
    expect(auth).toContain("SESSION_LIFETIME_SECONDS");
    expect(auth).toContain("MAX_FAILED_LOGIN_ATTEMPTS");
  });

  it("requires a signed-in customer for profile and address workspace rendering", () => {
    expect(accountPage).toContain("getCurrentCustomer()");
    expect(accountPage).toContain('redirect("/login")');
    expect(accountPage).toContain("listCustomerAddresses(customer.id)");
  });

  it("does not claim email verification or recovery is enabled", () => {
    expect(registerAction).toContain("createLocalCustomerAccount");
    expect(auth).not.toContain("sendEmail");
  });

  it("uses customer-owned MySQL storage for saved cart and wishlist when enabled", () => {
    expect(cartSync).toContain("syncCustomerCart(customer.id");
    expect(wishlistSync).toContain("syncCustomerWishlist(customer.id");
    expect(cartSync).toContain("accountSwitch");
    expect(wishlistSync).toContain("guestWishlist");
  });

  it("fails closed instead of sending MySQL customer checkout through the legacy Supabase order path", () => {
    expect(checkoutPage).toContain("isMySqlCustomerAuthEnabled()");
    expect(checkoutPage).toContain("listMySqlCheckoutConfiguration()");
    expect(checkoutPage).toContain("<CheckoutForm addresses={addresses}");
    expect(orderRoute).toContain("isMySqlCustomerAuthEnabled()");
    expect(orderRoute).toContain("createMySqlOrderDraft");
    const mysqlBranch = orderRoute.indexOf("if (isMySqlCustomerAuthEnabled())");
    const legacySupabaseCall = orderRoute.indexOf("const supabase = await createSupabaseServerClient()");
    expect(mysqlBranch).toBeGreaterThanOrEqual(0);
    expect(legacySupabaseCall).toBeGreaterThan(mysqlBranch);
  });
});
