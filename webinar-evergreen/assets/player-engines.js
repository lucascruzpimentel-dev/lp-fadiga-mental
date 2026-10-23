// Motores de reprodução do webinar: arquivo direto (.mp4/.webm) e Vimeo.
// Ambos expõem a mesma interface para a sala controlar o "ao vivo":
//   el, time, paused, rate, play(), pause(), seek(t), setRate(r), setVolume(v), setMuted(m),
//   requestFullscreen(), destroy()  e  hooks.enforce() / hooks.onError() chamados pelo motor.

/** Aceita URL de arquivo, links do Vimeo (público, não listado, player) ou o código <iframe> colado. */
export function parseVideoSource(raw) {
  let s = String(raw || '').trim();
  const iframe = /<iframe[^>]*\ssrc=["']([^"']+)["']/i.exec(s);
  if (iframe) s = iframe[1];
  s = s.replace(/&amp;/g, '&');

  let m = /^https?:\/\/player\.vimeo\.com\/video\/(\d+)(?:\?([^#]*))?/i.exec(s);
  if (m) {
    const q = new URLSearchParams(m[2] || '');
    return { type: 'vimeo', id: m[1], hash: q.get('h') || q.get('unlisted_hash') || '', url: s };
  }
  m = /^https?:\/\/(?:www\.)?vimeo\.com\/(?:manage\/videos\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/|showcase\/\d+\/video\/)?(\d+)(?:\/([0-9a-f]{6,}))?/i.exec(s);
  if (m) {
    const q = new URLSearchParams(s.split('?')[1] || '');
    return { type: 'vimeo', id: m[1], hash: m[2] || q.get('h') || q.get('unlisted_hash') || '', url: s };
  }
  return { type: 'file', src: s, url: s };
}

// ---------- SDK do Vimeo ----------
let sdkPromise;
function loadVimeoSdk() {
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      if (window.Vimeo && window.Vimeo.Player) return resolve(window.Vimeo.Player);
      const s = document.createElement('script');
      s.src = 'https://player.vimeo.com/api/player.js';
      s.async = true;
      s.onload = () => (window.Vimeo && window.Vimeo.Player ? resolve(window.Vimeo.Player) : reject(new Error('Vimeo SDK')));
      s.onerror = () => { sdkPromise = null; reject(new Error('Vimeo SDK')); };
      document.head.append(s);
    });
  }
  return sdkPromise;
}

const LOAD_TIMEOUT_MS = 25000;

// ---------- motor: arquivo direto ----------
function fileEngine(src, hooks) {
  const v = document.createElement('video');
  v.setAttribute('playsinline', '');
  v.setAttribute('disablepictureinpicture', '');
  v.setAttribute('disableremoteplayback', '');
  v.setAttribute('controlslist', 'nodownload noplaybackrate noremoteplayback');
  v.preload = 'auto';
  v.controls = false;
  v.src = src;
  const enforce = () => hooks.enforce && hooks.enforce();
  ['seeking', 'pause', 'ratechange'].forEach((ev) => v.addEventListener(ev, enforce));
  v.addEventListener('error', () => hooks.onError && hooks.onError());

  return {
    el: v,
    get time() { return v.currentTime; },
    get paused() { return v.paused; },
    get rate() { return v.playbackRate; },
    play: () => Promise.resolve(v.play()),
    pause: () => v.pause(),
    seek: (t) => { v.currentTime = t; },
    setRate: (r) => { v.playbackRate = r; },
    setVolume: (x) => { v.volume = x; },
    setMuted: (m) => { v.muted = m; },
    requestFullscreen: () => (v.webkitEnterFullscreen ? v.webkitEnterFullscreen() : undefined), // iPhone
    destroy: () => { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); },
  };
}

// ---------- motor: Vimeo ----------
function vimeoEngine(source, hooks) {
  const params = new URLSearchParams({
    controls: '0', title: '0', byline: '0', portrait: '0', badge: '0', autopause: '0',
    keyboard: '0', pip: '0', playsinline: '1', dnt: '1', transparent: '0',
  });
  if (source.hash) params.set('h', source.hash);

  const iframe = document.createElement('iframe');
  iframe.src = `https://player.vimeo.com/video/${source.id}?${params}`;
  iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
  iframe.setAttribute('tabindex', '-1');
  iframe.setAttribute('title', 'Transmissão');
  iframe.setAttribute('frameborder', '0');

  // Estado em cache: a API do Vimeo é assíncrona, a sala precisa de leituras síncronas.
  const st = { t: 0, paused: true, rate: 1, loaded: false, volume: 1, muted: false };
  let player = null;
  let dead = false;
  const enforce = () => hooks.enforce && hooks.enforce();
  const fail = () => { if (!dead) hooks.onError && hooks.onError(); };

  const ready = loadVimeoSdk().then((Player) => {
    player = new Player(iframe);
    player.on('loaded', () => { st.loaded = true; });
    player.on('timeupdate', (d) => { st.t = d.seconds; enforce(); });
    player.on('play', () => { st.paused = false; });
    player.on('playing', () => { st.paused = false; });
    player.on('pause', () => { st.paused = true; enforce(); });
    player.on('ended', () => { st.paused = true; });
    player.on('seeked', (d) => { st.t = d.seconds; enforce(); });
    player.on('playbackratechange', (d) => { st.rate = d.playbackRate; enforce(); });
    player.on('error', fail);
    player.setVolume(st.volume).catch(() => {});
    player.setMuted(st.muted).catch(() => {});
  });
  ready.catch(fail);
  // O Vimeo mostra a própria tela de erro (vídeo privado, domínio não permitido…) sem avisar a API.
  const timer = setTimeout(() => { if (!st.loaded) fail(); }, LOAD_TIMEOUT_MS);
  const safe = (fn) => ready.then(() => fn(player)).catch(() => {});

  return {
    el: iframe,
    get time() { return st.t; },
    get paused() { return st.paused; },
    get rate() { return st.rate; },
    play: () => ready.then(() => player.play()),
    pause: () => { safe((p) => p.pause()); },
    seek: (t) => { st.t = t; safe((p) => p.setCurrentTime(t)); },
    setRate: (r) => { st.rate = r; safe((p) => p.setPlaybackRate(r)); },
    setVolume: (x) => { st.volume = x; safe((p) => p.setVolume(x)); },
    setMuted: (m) => { st.muted = m; safe((p) => p.setMuted(m)); },
    requestFullscreen: () => { safe((p) => p.requestFullscreen()); },
    destroy: () => { dead = true; clearTimeout(timer); safe((p) => p.destroy()); iframe.remove(); },
  };
}

export function createEngine(source, hooks) {
  return source.type === 'vimeo' ? vimeoEngine(source, hooks) : fileEngine(source.src, hooks);
}

/** Descobre a duração (segundos) sem exibir nada. Rejeita se o vídeo não abrir. */
export function probeDuration(source) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(new Error('timeout')), LOAD_TIMEOUT_MS);
    let cleanup = () => {};
    const done = (err, value) => { clearTimeout(timer); cleanup(); err ? reject(err) : resolve(value); };

    if (source.type === 'vimeo') {
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:-9999px;top:0;width:320px;height:180px;overflow:hidden';
      const iframe = document.createElement('iframe');
      iframe.src = `https://player.vimeo.com/video/${source.id}?${new URLSearchParams(Object.assign({ dnt: '1' }, source.hash ? { h: source.hash } : {}))}`;
      iframe.setAttribute('allow', 'autoplay');
      box.append(iframe);
      document.body.append(box);
      let player;
      cleanup = () => { try { player && player.destroy(); } catch (e) { /* ignora */ } box.remove(); };
      loadVimeoSdk()
        .then((Player) => { player = new Player(iframe); return player.getDuration(); })
        .then((d) => (Number.isFinite(d) && d > 0 ? done(null, Math.floor(d)) : done(new Error('duração'))))
        .catch((e) => done(e));
    } else {
      const v = document.createElement('video');
      v.preload = 'metadata';
      cleanup = () => { v.removeAttribute('src'); v.load(); };
      v.onloadedmetadata = () => (Number.isFinite(v.duration) ? done(null, Math.floor(v.duration)) : done(new Error('duração')));
      v.onerror = () => done(new Error('erro'));
      v.src = source.src;
    }
  });
}
