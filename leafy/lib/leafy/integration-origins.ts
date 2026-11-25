const configuredOrigins = () => new Set(
  (process.env.LEAFY_INTEGRATION_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
)

export function isLeafyIntegrationOrigin(origin: string | null) {
  return Boolean(origin && configuredOrigins().has(origin.replace(/\/$/, '')))
}

export function checkLeafyIntegrationOrigin(request: Request) {
  const origin = request.headers.get('origin')
  const ownOrigin = new URL(request.url).origin
  if (origin && origin !== ownOrigin && !isLeafyIntegrationOrigin(origin)) {
    throw new Error('Ugyldig oprindelse.')
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site' && origin !== ownOrigin && !isLeafyIntegrationOrigin(origin)) {
    throw new Error('Ugyldig oprindelse.')
  }
}

export function leafyIntegrationCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin')
  if (!isLeafyIntegrationOrigin(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin!,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

export function leafyIntegrationOptions(request: Request, methods = 'GET, POST, OPTIONS') {
  try {
    checkLeafyIntegrationOrigin(request)
    const cors = leafyIntegrationCorsHeaders(request)
    return new Response(null, {
      status: 204,
      headers: { ...cors, 'Access-Control-Allow-Methods': methods, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' },
    })
  } catch {
    return Response.json({ error: 'Ugyldig oprindelse.' }, { status: 403 })
  }
}
