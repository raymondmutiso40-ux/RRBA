import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges an email-link code for a session.
 *
 * Supabase redirects here after email confirmation and password reset. The
 * `code` is single-use and exchanged server-side so the resulting session
 * cookie is set with HttpOnly.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  // Only same-origin relative paths — otherwise this endpoint becomes an
  // open redirect that lends RRBA's domain to a phishing link.
  const destination =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (!code) {
    // Supabase reports a failed verify in the fragment, which never reaches the
    // server — AuthErrorNotice reads that in the browser. Some flows put it in
    // the query instead, and that much can be carried over so the reason
    // survives this hop rather than being flattened to "missing_code".
    const reported = searchParams.get("error_code") ?? searchParams.get("error");

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(reported ?? "missing_code")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=invalid_code`);
  }

  return NextResponse.redirect(`${origin}${destination}`);
}
