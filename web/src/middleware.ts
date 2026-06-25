import { NextRequest, NextResponse } from "next/server"

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const ua = req.headers.get("user-agent") ?? ""
  const isMobile = /iPhone|Android|iPad|Mobile/i.test(ua)

  // Si mobile et sur /app, rediriger vers /mobile
  if (isMobile && pathname === "/app") {
    return NextResponse.redirect(new URL("/mobile", req.url))
  }

  // Si mobile et sur /, rediriger vers /connexion
  if (isMobile && pathname === "/") {
    return NextResponse.redirect(new URL("/connexion", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/app"],
}
