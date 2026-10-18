/* ==========================================================================
   RHINE LAB LIVE UI — 状态定义 / URL 快照 / 计时器
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'rhine-live-state-v1';
  var LAYOUTS = ['terminal', 'immersive', 'cockpit'];
  var ACCENTS = ['amber', 'brown', 'red', 'ink'];

  var DEFAULTS = {
    v: 1,
    host: '研究员 07',
    title: '今晚的观测记录',
    sub: '莱茵生命 · 内部资料档案 · 观测记录',
    code: 'X-031',
    op: '7-18 · 观测',
    room: '7355608',
    layout: 'terminal',
    accent: 'amber',
    live: true,
    showGame: true,
    demo: true,
    boot: true,
    scanlines: true,
    alerts: true,
    motion: true,
    notice:
      '实验室通知：本场直播由莱茵生命资料库辅助记录 · 请遵守实验室规范 · 理性消费，适度游戏',
    timer: { base: 0, startedAt: 0, running: true },
    np: {
      on: true,
      title: '生命流',
      artist: '塞壬唱片 · MSR',
      progress: 0.34
    },
    stats: { viewers: 12480, ping: 12, originium: 0.03 },
    version: 'RHINE LAB v1.0'
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function str(value, fallback, max) {
    if (typeof value !== 'string') return fallback;
    var out = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    if (!out) return fallback;
    return out.slice(0, max || 120);
  }

  function num(value, fallback, min, max) {
    var n = Number(value);
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function pick(value, list, fallback) {
    return list.indexOf(value) >= 0 ? value : fallback;
  }

  function bool(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
  }

  function normalize(raw) {
    var src = raw && typeof raw === 'object' ? raw : {};
    var now = Date.now();
    var timer = src.timer && typeof src.timer === 'object' ? src.timer : {};
    var np = src.np && typeof src.np === 'object' ? src.np : {};
    var stats = src.stats && typeof src.stats === 'object' ? src.stats : {};
    var running = bool(timer.running, true);
    return {
      v: 1,
      host: str(src.host, DEFAULTS.host, 30),
      title: str(src.title, DEFAULTS.title, 80),
      sub: str(src.sub, DEFAULTS.sub, 100),
      code: str(src.code, DEFAULTS.code, 16),
      op: str(src.op, DEFAULTS.op, 40),
      room: str(src.room, DEFAULTS.room, 32),
      layout: pick(src.layout, LAYOUTS, DEFAULTS.layout),
      accent: pick(src.accent, ACCENTS, DEFAULTS.accent),
      live: bool(src.live, DEFAULTS.live),
      showGame: bool(src.showGame, DEFAULTS.showGame),
      demo: bool(src.demo, DEFAULTS.demo),
      boot: bool(src.boot, DEFAULTS.boot),
      scanlines: bool(src.scanlines, DEFAULTS.scanlines),
      alerts: bool(src.alerts, DEFAULTS.alerts),
      motion: bool(src.motion, DEFAULTS.motion),
      notice: str(src.notice, DEFAULTS.notice, 240),
      timer: {
        base: num(timer.base, 0, 0, 359999),
        startedAt: num(timer.startedAt, now, 0, 9999999999999),
        running: running
      },
      np: {
        on: bool(np.on, true),
        style: np.style === 'card' ? 'card' : 'bar',
        cover: str(np.cover, '', 2048),
        title: str(np.title, DEFAULTS.np.title, 60),
        artist: str(np.artist, DEFAULTS.np.artist, 60),
        progress: num(np.progress, 0.34, 0, 1)
      },
      stats: {
        viewers: Math.round(num(stats.viewers, 12480, 0, 99999999)),
        ping: Math.round(num(stats.ping, 12, 0, 9999)),
        fans: Math.round(num(stats.fans, 0, 0, 999999999)),
        plays: Math.round(num(stats.plays, 0, 0, 999999999)),
        likes: Math.round(num(stats.likes, 0, 0, 999999999)),
        popularity: Math.round(num(stats.popularity, 0, 0, 999999999)),
        originium: num(stats.originium, 0.03, 0, 9.99)
      },
      version: str(src.version, DEFAULTS.version, 24)
    };
  }

  function defaults() {
    var d = clone(DEFAULTS);
    d.timer.startedAt = Date.now();
    return d;
  }

  function elapsed(state) {
    var t = state.timer || DEFAULTS.timer;
    var seconds = Number(t.base) || 0;
    if (t.running) {
      seconds += Math.max(0, (Date.now() - (Number(t.startedAt) || Date.now())) / 1000);
    }
    return Math.max(0, Math.floor(seconds));
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function formatDuration(total) {
    var s = Math.max(0, Math.floor(total));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    return pad(h) + ':' + pad(m) + ':' + pad(sec);
  }

  function formatClock(date) {
    var d = date || new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function formatCount(value) {
    return Math.max(0, Math.round(Number(value) || 0))
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function toBase64Url(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function fromBase64Url(token) {
    var text = String(token || '').replace(/-/g, '+').replace(/_/g, '/');
    while (text.length % 4) text += '=';
    var binary = atob(text);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function encode(state) {
    return toBase64Url(JSON.stringify(normalize(state)));
  }

  function decode(token) {
    try {
      return normalize(JSON.parse(fromBase64Url(token)));
    } catch (error) {
      return null;
    }
  }

  function snapshot(state) {
    var next = normalize(state);
    next.timer = {
      base: elapsed(state),
      startedAt: Date.now(),
      running: true
    };
    return next;
  }

  function readURL() {
    try {
      var params = new URLSearchParams(location.search);
      var token = params.get('s');
      if (!token) return null;
      return decode(token);
    } catch (error) {
      return null;
    }
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return normalize(JSON.parse(raw));
    } catch (error) {
      return null;
    }
  }

  function saveLocal(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(normalize(state)));
    } catch (error) {
      /* 存储不可用时静默降级 */
    }
  }

  function clearLocal() {
    try {
      localStorage.removeItem(KEY);
    } catch (error) {
      /* ignore */
    }
  }

  function toggleTimer(state) {
    var next = normalize(state);
    var now = Date.now();
    if (next.timer.running) {
      next.timer.base = elapsed(next);
      next.timer.running = false;
    } else {
      next.timer.running = true;
    }
    next.timer.startedAt = now;
    return next;
  }

  function resetTimer(state) {
    var next = normalize(state);
    next.timer = { base: 0, startedAt: Date.now(), running: true };
    return next;
  }

  function setTimer(state, seconds, running) {
    var next = normalize(state);
    next.timer = {
      base: Math.max(0, Math.floor(seconds)),
      startedAt: Date.now(),
      running: running === undefined ? next.timer.running : !!running
    };
    return next;
  }

  window.RhineState = {
    KEY: KEY,
    LAYOUTS: LAYOUTS,
    ACCENTS: ACCENTS,
    defaults: defaults,
    normalize: normalize,
    clone: clone,
    encode: encode,
    decode: decode,
    snapshot: snapshot,
    readURL: readURL,
    loadLocal: loadLocal,
    saveLocal: saveLocal,
    clearLocal: clearLocal,
    elapsed: elapsed,
    formatDuration: formatDuration,
    formatClock: formatClock,
    formatCount: formatCount,
    toggleTimer: toggleTimer,
    resetTimer: resetTimer,
    setTimer: setTimer
  };
})();
