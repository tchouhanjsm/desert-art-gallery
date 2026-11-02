import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;
  const protectedRoute = path.startsWith("/admin") || path.startsWith("/account");

  // Fail closed for protected pages when the configured identity provider is unavailable.
  if (!url || !anonKey) {
    if (!protectedRoute) return NextResponse.next({ request });
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.search = "";
    target.searchParams.set("error", "auth_unavailable");
    target.searchParams.set("next", path);
    return NextResponse.redirect(target);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet: CookieToSet[]) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getUser() validates the access token against Supabase Auth; do not trust getSession() alone.
  const { data: { user } } = await supabase.auth.getUser();
  if (protectedRoute && !user) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.searchParams.set("next", path);
    return NextResponse.redirect(target);
  }

  if (path.startsWith("/admin") && user) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !profile || !["admin", "owner"].includes(profile.role)) {
      const target = request.nextUrl.clone();
      target.pathname = "/account";
      target.search = "";
      return NextResponse.redirect(target);
    }
  }

  return response;
}

export const config = { matcher: ["/admin/:path*", "/account/:path*"] };
