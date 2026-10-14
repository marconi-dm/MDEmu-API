import { Emulator, SNES_CONTROL, defaultInputMap } from './snes2005.js';

// Laboratório independente. Não modifica EmulatorJS, seus saves ou a biblioteca.
export function initLab({apiBase, libraryUrl}) {
  const base = String(apiBase || '').replace(/\/$/, '');
  const canvas = document.getElementById('snes');
  const status = document.getElementById('msg');
  const stats = document.getElementById('stats');
  const startButton = document.getElementById('start');
  const muteButton = document.getElementById('mute');
  const backButton = document.getElementById('back');
  const search = new URLSearchParams(location.search);
  const requestedId = search.get('id');
  let game = null, emulator = null, starting = false, done = false;
  let audio = true, lastButtons = new Map();
  let pollCount = 0, badFrames = 0, worst = 0, measuredAt = performance.now();
  let coreFrames = 0, coreTimeMs = 0; // chamadas reais ao _mainLoop e tempo dentro do núcleo WASM
  let previousFrame = performance.now();
  let raf = 0, chordFrom = 0, chordDone = false, backFrom = 0;
  let xboxStartLatch = false, keyboardHandlers = null;

  function message(s) { status.textContent = s; console.log('[MDEmu LAB]', s); }
  function fail(e) { const m = e && e.message ? e.message : String(e); status.textContent = 'ERRO: ' + m; console.error('[MDEmu LAB]', e); }
  function firstPad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    for (let i=0;i<pads.length;i++) if (pads[i] && pads[i].connected) return pads[i];
    return null;
  }
  function pressed(p, index) { return !!(p && p.buttons && p.buttons[index] && p.buttons[index].pressed); }
  function goBack() {
    if (emulator) { try { emulator.destroy(); } catch (_) {} }
    if (libraryUrl) location.href=libraryUrl;
    else if (history.length>1) history.back();
    else location.href='/';
  }
  backButton.addEventListener('click',goBack);
  document.addEventListener('keydown',event=>{
    if (event.key==='Escape'||event.key==='BrowserBack') {event.preventDefault();goBack();return;}
    if (keyboardHandlers) keyboardHandlers.onkeydown(event);
  });
  document.addEventListener('keyup',event=>{ if(keyboardHandlers) keyboardHandlers.onkeyup(event); });

  async function loadCatalog() {
    if (!/^https:\/\//.test(base)) throw Error('apiBase precisa ser uma URL HTTPS.');
    const response=await fetch(base+'/api/games',{cache:'no-store'});
    if(!response.ok) throw Error('Falha /api/games (HTTP '+response.status+').');
    const data=await response.json();
    const games=Array.isArray(data.games)?data.games:[];
    if(!games.length) throw Error('Nenhum jogo encontrado em /api/games.');
    game = (requestedId && games.find(g=>String(g.id)===requestedId)) || games[0];
    if (!game || !/^https:\/\//.test(game.romUrl)) throw Error('Jogo sem romUrl HTTPS.');
    message('Pronto: '+game.title+'. Clique INICIAR ou pressione A no Xbox.');
  }

  // Parte do código distribuído pode usar URL.canParse, ausente em alguns navegadores Tizen.
  if (typeof URL.canParse !== 'function') URL.canParse = function(s, baseURL) {
    try { new URL(s, baseURL); return true; } catch (_) { return false; }
  };

  async function start() {
    if (starting||done||!game) return;
    starting=true; startButton.disabled=true;
    message('Baixando ROM e inicializando Snes9x 2005 (WebAssembly)…');
    try {
      // A versão WASM e a biblioteca JS precisam estar publicadas no mesmo diretório.
      const romRes=await fetch(game.romUrl);
      if(!romRes.ok) throw Error('Falha ao baixar a ROM (HTTP '+romRes.status+').');
      const rom=new Uint8Array(await romRes.arrayBuffer());
      if(!rom.length) throw Error('ROM vazia.');
      emulator=await Emulator.create(canvas, {
        wasmPath:base+'/lab-snes2005/snes9x_2005.wasm', audioOn:true
      });
      // O motor fornece quadro RGBA de 512x448. Ele cria canvas 256x224 e
      // usa putImageData, que NAO redimensiona: sem isso a imagem seria cortada.
      canvas.width = 512;
      canvas.height = 448;
      // Medição leve das chamadas reais do núcleo, separada dos callbacks rAF.
      // É intencionalmente uma instrumentação APENAS deste laboratório.
      const wasm=emulator.WASM;
      const mainLoop=wasm._mainLoop;
      if(typeof mainLoop==='function') {
        wasm._mainLoop=function(){
          const t=performance.now();
          try { return mainLoop.apply(wasm,arguments); }
          finally { coreFrames++;coreTimeMs+=performance.now()-t; }
        };
      }
      // A velocidade deve continuar 1. 'Acelerar' 2x causa distorção de áudio.
      emulator.setEmulationSpeed(1);
      keyboardHandlers=emulator.createKeyboardHandles(defaultInputMap, false);
      emulator.loadRom(rom);
      done=true;
      muteButton.disabled=false;
      startButton.style.display='none';
      message('Executando '+game.title+' · compare áudio e fluidez com o EmulatorJS.');
      // O AudioContext pode depender de interação explícita da TV/navegador.
      try { await emulator.audioNode.context.resume(); } catch (e) { console.warn('AudioContext:',e); }
    } catch(e) {
      fail(e);
      startButton.disabled=false;
      if(emulator){try{emulator.destroy()}catch(_){} emulator=null;}
    } finally {starting=false;}
  }
  startButton.addEventListener('click',start);
  function changeAudio() {
    if(!emulator) return;
    audio = !audio;
    emulator.audioOn=audio;
    muteButton.textContent='Áudio: '+(audio?'ligado':'desligado');
    message('Áudio '+(audio?'ligado':'desligado')+' · confira se as travadas da imagem mudam.');
    if(audio) {try{emulator.audioNode.context.resume()}catch(_) {}}
  }
  muteButton.addEventListener('click',changeAudio);

  const map=[
    [0,SNES_CONTROL.B],[1,SNES_CONTROL.A],[2,SNES_CONTROL.Y],[3,SNES_CONTROL.X],
    [4,SNES_CONTROL.L],[5,SNES_CONTROL.R],[8,SNES_CONTROL.SELECT],[9,SNES_CONTROL.START]
  ];
  function syncXbox(gp, disabledChord) {
    if(!emulator) return;
    const wanted=new Map();
    for(const [btn,code] of map) {
      const chordButton=disabledChord&&(btn===4||btn===5||btn===3||btn===8);
      wanted.set(code,pressed(gp,btn)&&!chordButton);
    }
    const ax=(gp&&gp.axes)||[];
    const x=Number(ax[0]||0),y=Number(ax[1]||0);
    wanted.set(SNES_CONTROL.UP,pressed(gp,12)||y<-.3);
    wanted.set(SNES_CONTROL.DOWN,pressed(gp,13)||y>.3);
    wanted.set(SNES_CONTROL.LEFT,pressed(gp,14)||x<-.3);
    wanted.set(SNES_CONTROL.RIGHT,pressed(gp,15)||x>.3);
    wanted.forEach((on,code)=>{
      if(lastButtons.get(code)!==on){emulator.inputHandle(code,on);lastButtons.set(code,on);}
    });
  }
  function poll(now) {
    const diff=now-previousFrame;
    if(diff>0&&diff<500){pollCount++;if(diff>25)badFrames++;worst=Math.max(diff,worst);}
    previousFrame=now;
    const gp=firstPad();
    const audioChord=pressed(gp,4)&&pressed(gp,5)&&pressed(gp,3);
    const backChord=pressed(gp,4)&&pressed(gp,5)&&pressed(gp,8);
    if(audioChord){
      if(!chordFrom)chordFrom=now;
      if(!chordDone&&now-chordFrom>700){chordDone=true;changeAudio();}
    }else{chordFrom=0;chordDone=false;}
    if(backChord){
      if(!backFrom)backFrom=now;
      if(now-backFrom>1000){goBack();return;}
    }else backFrom=0;
    if(!done && game && pressed(gp,0)&&!xboxStartLatch) start();
    xboxStartLatch=pressed(gp,0);
    syncXbox(gp,audioChord||backChord);
    if(now-measuredAt>=1200){
      const seconds=(now-measuredAt)/1000;
      const fps=Math.round(pollCount/seconds);
      const emulationFps=Math.round(coreFrames/seconds);
      const averageCoreMs=coreFrames? (coreTimeMs/coreFrames).toFixed(1) : '--';
      const audioState=emulator&&emulator.audioNode&&emulator.audioNode.context&&emulator.audioNode.context.state;
      stats.textContent='Núcleo: '+emulationFps+' q/s · CPU por quadro: '+averageCoreMs+'ms · rAF: '+fps+' Hz · atrasos >25ms: '+badFrames+' · pior: '+Math.round(worst)+'ms · Xbox: '+(gp?'conectado':'não detectado')+' · áudio: '+(audioState||'aguardando');
      pollCount=0;badFrames=0;worst=0;coreFrames=0;coreTimeMs=0;measuredAt=now;
    }
    raf=requestAnimationFrame(poll);
  }
  raf=requestAnimationFrame(poll);
  loadCatalog().catch(fail);
  window.addEventListener('pagehide',()=>{
    cancelAnimationFrame(raf);
    if(emulator){try{emulator.destroy()}catch(_) {}}
  },{once:true});
}
