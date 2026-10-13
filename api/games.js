// GET /api/games - catálogo inicial sem banco de dados.
// IMPORTANTE: só disponibilize publicamente ROMs que você tem direito de distribuir.
// O ID "metroid" foi mantido provisoriamente para ser compatível com o index.html
// já existente no MDEmu. O arquivo de teste NÃO acompanha este projeto.
// Para usar uma ROM de teste autorizada, adicione public/roms/teste.sfc.
const games = [
  {
    id: 'metroid',
    title: 'Jogo SNES de teste',
    system: 'snes',
    core: 'snes',
    gameId: 1001,
    romPath: '/roms/teste.sfc'
  }
];

export function GET(request) {
  const origin = new URL(request.url).origin;
  const dataUrl = origin + '/emulatorjs/data/';
  const result = games.map(({ romPath, ...game }) => ({
    ...game,
    romUrl: origin + romPath,
    emulatorDataUrl: dataUrl
  }));
  return Response.json({ games: result, count: result.length }, {
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
