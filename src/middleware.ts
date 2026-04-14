import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit/basic'

export async function middleware(request: NextRequest) {
  // Rate limit API routes: 100 req/min per IP (skips webhooks since those are trusted upstream)
  const path = request.nextUrl.pathname
  if (path.startsWith('/api/') && !path.startsWith('/api/webhooks/')) {
    const ip = getClientIp(request)
    const { allowed, remaining, resetAt } = checkRateLimit(`api:${ip}`, 100, 60_000)
    if (!allowed) {
      return new NextResponse(JSON.stringify({ error: 'Too many requests', resetAt }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((resetAt - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetAt.toString(),
        },
      })
    }
    const response = NextResponse.next({ request })
    response.headers.set('X-RateLimit-Limit', '100')
    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    return response
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks/.*|api/payments/webhook|api/quotes/track|api/v1/.*|api/store|api/portal|api/auth/demo|api/sign|api/forms|q/.*|sign/.*|f/.*|store/.*|portal/.*|pricing|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
