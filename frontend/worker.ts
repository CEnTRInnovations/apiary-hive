export interface Env {
  ASSETS: Fetcher
  API_ORIGIN: string
}

function apiRequest(request: Request, apiOrigin: string): Request {
  const incoming = new URL(request.url)
  const target = new URL(incoming.pathname + incoming.search, apiOrigin)
  return new Request(target, request)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname === '/api' || pathname.startsWith('/api/')) {
      if (!env.API_ORIGIN) {
        return new Response('API origin is not configured', { status: 503 })
      }
      return fetch(apiRequest(request, env.API_ORIGIN))
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
