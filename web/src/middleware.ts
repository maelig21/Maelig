import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      console.error('[middleware] MISSING SUPABASE ENV VARS')
      return response
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(toSet) {
          for (const { name, value } of toSet) request.cookies.set(name, value)
          response = NextResponse.next({ request: { headers: request.headers } })
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, {
              ...options,
              maxAge: 12 * 60 * 60,
              sameSite: "lax",
            })
          }
        },
      },
    })

    const { data: { user } } = await supabase.auth.getUser()
    const path = request.nextUrl.pathname
    const isAuthRoute = path.startsWith("/connexion") || path.startsWith("/inscription") || path.startsWith("/oubli")
    const isAppRoute = path.startsWith("/app")

    if (isAppRoute && !user) {
      const url = request.nextUrl.clone()
      url.pathname = "/connexion"
      url.searchParams.set("redirect_to", path)
      return NextResponse.redirect(url)
    }

    if (isAuthRoute && user) {
      const url = request.nextUrl.clone()
      url.pathname = "/app"
      return NextResponse.redirect(url)
    }
  } catch (e) {
    console.error('[middleware] Supabase auth error:', e instanceof Error ? e.message : String(e))
    // Continue without auth — user will get redirected when they try to access protected pages
  }

  // Security headers
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("X-DNS-Prefetch-Control", "off")
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=(), interest-cohort=()"
  )

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|dep-logo|api/public).*)",
  ],
}
