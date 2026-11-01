import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = safeNext(request.nextUrl.searchParams.get("next"));
  const supabase = await createSupabaseServerClient();

  if (!supabase || !code) {
    const target = new URL("/login?error=auth_callback", request.url);
    return NextResponse.redirect(target);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=auth_callback", request.url));

  return NextResponse.redirect(new URL(destination, request.url));
}
