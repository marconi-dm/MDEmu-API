// GET /api/health - teste independente de ROM ou EmulatorJS.
export function GET() {
  return Response.json({
    ok: true,
    app: 'MDEmu API',
    status: 'online',
    message: 'API respondeu por HTTPS. Teste /diagnostico.html para verificar arquivos.'
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    }
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
