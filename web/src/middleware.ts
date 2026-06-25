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
    const isAuthRoute = path.startsWith("/connexion") || path.startsWith("/inscription") || path.startsWith("/oubli") || path.startsWith("/accepter-invitation")
    const isPublicRoute = path.startsWith("/signer/") || path.startsWith("/api/") || path === "/" || isAuthRoute

    // Redirection mobile
    const ua = request.headers.get("user-agent") ?? ""
    const isMobile = /iPhone|Android|iPad|Mobile/i.test(ua)

    if (!user && !isPublicRoute) {
      return NextResponse.redirect(new URL("/connexion", request.url))
    }

    if (user && isAuthRoute) {
      // Rediriger vers mobile si sur téléphone
      if (isMobile) {
        return NextResponse.redirect(new URL("/mobile", request.url))
      }
      return NextResponse.redirect(new URL("/app", request.url))
    }

    // Si connecté et sur /app ou /, rediriger mobile vers /mobile
    if (user && isMobile && (path === "/app" || path === "/")) {
      return NextResponse.redirect(new URL("/mobile", request.url))
    }

  } catch (e) {
    console.error('[middleware] error:', e)
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
