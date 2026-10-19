/* ==========================================================================
   RHINE LAB — 工作室 → 莱茵直播画面 桥接
   1. 把主播名 / 标题 / 计时 / 莱茵画面设置写进 /api/rhine/state
   2. 把 B 站、模拟、手动发送的弹幕转成莱茵场景的消息格式
   场景页面自己通过 /api/rhine/events 读取，OBS 与主题编辑器画布因此完全一致。
   ========================================================================== */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const obs = params.has('obs') || document.documentElement.classList.contains('obs');
  const editor = params.has('editor');
  const writer = !obs && !editor;
  const frame = $('rhineScene');
  const SC_AMOUNTS = [2, 30, 50, 100, 500, 1000, 2000];
  const SC_TIERS = ['0', '1', '2', '3', '4', '5', '6'];
  let pending = 0;
  let last = '';
  // 音乐皮肤服务里的实时曲目（Now Playing）。
  const musicBase = window.ThemeServices?.music || 'http://127.0.0.1:8795';
  let track = { hasSong: false, title: '', artist: '', position: 0, duration: 0, paused: true, stamp: Date.now() };
  let lastTrackKey = '';
  let lastTrackPost = 0;

  const text = (value, max = 300) =>
    typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';

  function sceneMessage() {
    return () => {
      try {
        return frame?.contentWindow;
      } catch {
        return null;
      }
    };
  }
  const target = sceneMessage();

  function direct(message) {
    const win = target();
    if (!win) return false;
    try {
      win.postMessage(message, location.origin);
      return true;
    } catch {
      return false;
    }
  }

  function timerState() {
    const timer = window.ThemeLiveBridge?.timer;
    if (!timer) return { base: 0, startedAt: Date.now(), running: false };
    return {
      base: Math.max(0, Math.floor(Number(timer.elapsedMs) / 1000)),
      startedAt: timer.startedAt === null ? Date.now() : Number(timer.startedAt) || Date.now(),
      running: timer.startedAt !== null,
    };
  }

  // 三套基础画面在场景里的标准区块坐标（与项目库预设一致）。
  const DEFAULT_PARTS = {
    terminal: {
      topbar: { x: 0, y: 0, w: 1920, h: 90, visible: true },
      brand: { x: 40, y: 14, w: 360, h: 62, visible: true },
      host: { x: 420, y: 16, w: 250, h: 58, visible: true },
      plate: { x: 600, y: 21, w: 520, h: 48, visible: true },
      live: { x: 1440, y: 14, w: 300, h: 62, visible: true },
      timer: { x: 1740, y: 34, w: 140, h: 44, visible: true },
      feed: { x: 40, y: 110, w: 1376, h: 774, visible: true },
      comms: { x: 1440, y: 110, w: 440, h: 874, visible: true },
      commshead: { x: 1440, y: 110, w: 440, h: 112, visible: true },
      commsfeed: { x: 1440, y: 222, w: 440, h: 730, visible: true },
      commsfoot: { x: 1440, y: 952, w: 440, h: 32, visible: true },
      telemetry: { x: 40, y: 896, w: 1376, h: 88, visible: true },
      op: { x: 40, y: 896, w: 267, h: 88, visible: true },
      env: { x: 307, y: 896, w: 267, h: 88, visible: true },
      uplink: { x: 574, y: 896, w: 267, h: 88, visible: true },
      visitors: { x: 841, y: 896, w: 267, h: 88, visible: true },
      wave: { x: 1108, y: 896, w: 308, h: 88, visible: true },
      briefing: { x: 40, y: 788, w: 1152, h: 196, visible: false },
      briefcopy: { x: 68, y: 810, w: 700, h: 152, visible: false },
      briefstats: { x: 798, y: 810, w: 326, h: 152, visible: false },
      briefdeco: { x: 1072, y: 788, w: 120, h: 196, visible: false },
      nowplaying: { x: 40, y: 1008, w: 432, h: 56, visible: true },
      ticker: { x: 492, y: 1018, w: 800, h: 36, visible: true },
      sysline: { x: 1372, y: 1010, w: 508, h: 52, visible: true },
    },
    immersive: {
      topbar: { x: 0, y: 0, w: 1920, h: 108, visible: true },
      brand: { x: 40, y: 18, w: 360, h: 62, visible: true },
      host: { x: 420, y: 20, w: 250, h: 58, visible: true },
      plate: { x: 600, y: 25, w: 520, h: 48, visible: true },
      live: { x: 1440, y: 18, w: 300, h: 62, visible: true },
      timer: { x: 1740, y: 38, w: 140, h: 44, visible: true },
      feed: { x: 0, y: 0, w: 1920, h: 1080, visible: true },
      comms: { x: 1336, y: 556, w: 544, h: 420, visible: true },
      commshead: { x: 1336, y: 556, w: 544, h: 96, visible: true },
      commsfeed: { x: 1336, y: 652, w: 544, h: 302, visible: true },
      commsfoot: { x: 1336, y: 954, w: 544, h: 22, visible: true },
      telemetry: { x: 40, y: 896, w: 1376, h: 88, visible: false },
      op: { x: 40, y: 896, w: 267, h: 88, visible: false },
      env: { x: 307, y: 896, w: 267, h: 88, visible: false },
      uplink: { x: 574, y: 896, w: 267, h: 88, visible: false },
      visitors: { x: 841, y: 896, w: 267, h: 88, visible: false },
      wave: { x: 1108, y: 896, w: 308, h: 88, visible: false },
      briefing: { x: 40, y: 788, w: 1152, h: 196, visible: false },
      briefcopy: { x: 68, y: 810, w: 700, h: 152, visible: false },
      briefstats: { x: 798, y: 810, w: 326, h: 152, visible: false },
      briefdeco: { x: 1072, y: 788, w: 120, h: 196, visible: false },
      nowplaying: { x: 44, y: 1004, w: 432, h: 56, visible: true },
      ticker: { x: 496, y: 1012, w: 770, h: 36, visible: true },
      sysline: { x: 1368, y: 1002, w: 508, h: 52, visible: true },
    },
    cockpit: {
      topbar: { x: 0, y: 0, w: 1920, h: 90, visible: true },
      brand: { x: 40, y: 14, w: 360, h: 62, visible: true },
      host: { x: 420, y: 16, w: 250, h: 58, visible: true },
      plate: { x: 600, y: 21, w: 520, h: 48, visible: true },
      live: { x: 1440, y: 14, w: 300, h: 62, visible: true },
      timer: { x: 1740, y: 34, w: 140, h: 44, visible: true },
      feed: { x: 40, y: 126, w: 1152, h: 648, visible: true },
      comms: { x: 1232, y: 126, w: 648, h: 858, visible: true },
      commshead: { x: 1232, y: 126, w: 648, h: 112, visible: true },
      commsfeed: { x: 1232, y: 238, w: 648, h: 714, visible: true },
      commsfoot: { x: 1232, y: 952, w: 648, h: 32, visible: true },
      telemetry: { x: 40, y: 896, w: 1376, h: 88, visible: false },
      op: { x: 40, y: 896, w: 267, h: 88, visible: false },
      env: { x: 307, y: 896, w: 267, h: 88, visible: false },
      uplink: { x: 574, y: 896, w: 267, h: 88, visible: false },
      visitors: { x: 841, y: 896, w: 267, h: 88, visible: false },
      wave: { x: 1108, y: 896, w: 308, h: 88, visible: false },
      briefing: { x: 40, y: 788, w: 1152, h: 196, visible: true },
      briefcopy: { x: 68, y: 810, w: 700, h: 152, visible: true },
      briefstats: { x: 798, y: 810, w: 326, h: 152, visible: true },
      briefdeco: { x: 1072, y: 788, w: 120, h: 196, visible: true },
      nowplaying: { x: 40, y: 1010, w: 432, h: 56, visible: true },
      ticker: { x: 492, y: 1020, w: 1000, h: 36, visible: true },
      sysline: { x: 1500, y: 1012, w: 380, h: 52, visible: true },
    },
  };
  let layoutOverride = false;

  function npStyle() {
    const value = $('rhineNpStyle')?.value;
    return value === 'card' ? 'card' : 'bar';
  }

  // 音乐卡按三套画布预设缩小，并放进游戏画面内，避免遮挡右侧栏、遥测、简报等组件。
  const NP_CARD = {
    terminal: { w: 360, h: 105, bottom: 876 },
    immersive: { w: 420, h: 123, bottom: 1060 },
    cockpit: { w: 480, h: 140, bottom: 766 },
  };
  function withNpStyle(parts) {
    if (!parts || npStyle() !== 'card' || !parts.nowplaying) return parts;
    const rect = parts.nowplaying;
    const card = NP_CARD[layout()] || NP_CARD.terminal;
    return {
      ...parts,
      nowplaying: {
        ...rect,
        w: card.w,
        h: card.h,
        y: card.bottom - card.h,
      },
    };
  }

  // 主题文档里的「部件 · …」代理图层就是莱茵场景的 24 个区块（rhine/js/parts.js）。
  // 主题编辑器画布和已发布输出都以当前主题为准：坐标、显隐、质感与文字都要
  // 同步给场景，否则画布里隐藏的部件仍然留在底图上。工作室直播预览没有主题
  // 时仍使用当前布局的标准坐标；旧主题缺少代理图层时也自动用标准坐标补齐。
  const PART_KEYS = Object.keys(DEFAULT_PARTS.terminal);
  function themeParts() {
    const doc = window.ThemeRenderer?.value;
    if (!doc || !Array.isArray(doc.layers)) return null;
    const themeLayout = doc.settings?.rhineLayout;
    if (['terminal', 'immersive', 'cockpit'].includes(themeLayout) && themeLayout !== layout()) return null;
    const base = DEFAULT_PARTS[layout()];
    if (!base) return null;
    const layers = new Map(doc.layers.map((layer) => [layer.id, layer])),
      parts = {};
    let themed = 0;
    for (const key of PART_KEYS) {
      const layer = layers.get('part-' + key);
      if (!layer) {
        parts[key] = { ...base[key] };
        continue;
      }
      themed++;
      const group = layer.parent ? layers.get(layer.parent) : null,
        opacity = Number.isFinite(layer.opacity) ? layer.opacity : 1,
        groupOpacity = group && Number.isFinite(group.opacity) ? group.opacity : 1;
      parts[key] = {
        x: layer.x,
        y: layer.y,
        w: layer.w,
        h: layer.h,
        visible: layer.visible !== false && group?.visible !== false,
        opacity: Math.max(0, Math.min(1, opacity * groupOpacity)),
        brightness: layer.brightness,
        shadow: layer.shadow,
        radius: layer.radius,
        panelOpacity: layer.panelOpacity,
        // 只同步文字内容，不同步图层颜色：场景里的标题等文字有各自的底色与
        // 配色（例如沉浸式标题栏是深底浅字），套用图层默认墨色会看不清。
        text: typeof layer.text === 'string' ? layer.text : '',
      };
    }
    return themed ? withNpStyle(parts) : null;
  }

  function applyParts() {
    const win = target();
    if (!win) return;
    const themed = themeParts();
    try {
      win.postMessage(
        { type: 'rhine:parts', parts: themed || withNpStyle(DEFAULT_PARTS[layout()]) },
        location.origin,
      );
    } catch {}
  }

  // 主题每次重绘（拖动、改文字、隐藏）都会通知场景；合并到同一帧发送。
  let partsFrame = 0;
  function scheduleParts() {
    if (partsFrame) return;
    partsFrame = requestAnimationFrame(() => {
      partsFrame = 0;
      applyParts();
    });
  }
  window.addEventListener('theme-applied', scheduleParts);

  function layout() {
    const value = $('rhineLayout')?.value;
    return ['terminal', 'immersive', 'cockpit'].includes(value) ? value : 'terminal';
  }

  function geometryText() {
    const boxes = {
      terminal: '40, 110 · 1376 × 774',
      immersive: '0, 0 · 1920 × 1080',
      cockpit: '40, 126 · 1152 × 648',
    };
    return 'OBS 游戏采集位置 ' + (boxes[layout()] || boxes.terminal);
  }

  function nowPlaying() {
    const enabled = $('rhineNp') ? $('rhineNp').checked : true;
    const hasSong = !!track.hasSong;
    const duration = Number(track.duration) || 0;
    const elapsed =
      (Number(track.position) || 0) +
      (hasSong && !track.paused && track.stamp
        ? Math.max(0, Date.now() - Number(track.stamp)) / 1000
        : 0);
    const cover =
      hasSong && track.cover && track.id
        ? musicBase + '/api/cover?v=' + encodeURIComponent(track.id + '|' + track.cover)
        : '';
    return {
      on: enabled,
      style: npStyle(),
      cover,
      title: hasSong ? track.title : '暂无曲目',
      artist: hasSong ? track.artist : '等待播放器',
      progress: duration ? Math.min(1, Math.max(0, elapsed / duration)) : 0,
    };
  }

  function buildState() {
    const host = text($('hostInput')?.value, 30) || '研究员 07';
    const title = text($('topicInput')?.value, 80);
    return {
      v: 1,
      host,
      title,
      sub: '莱茵生命 · 内部资料档案 · 观测记录',
      code: text($('rhineCode')?.value, 16) || 'X-031',
      op: text($('rhineOp')?.value, 40) || '7-18 · 观测',
      room: text($('rhineRoom')?.value, 32) || '7355608',
      layout: layout(),
      accent: ['amber', 'brown', 'red', 'ink'].includes($('rhineAccent')?.value)
        ? $('rhineAccent').value
        : 'amber',
      live: $('rhineLive') ? $('rhineLive').checked : true,
      showGame: false,
      demo: false,
      boot: $('rhineBoot') ? $('rhineBoot').checked : true,
      scanlines: $('rhineScan') ? $('rhineScan').checked : true,
      alerts: $('rhineAlerts') ? $('rhineAlerts').checked : true,
      motion: $('rhineMotion') ? $('rhineMotion').checked : true,
      notice:
        text($('rhineNotice')?.value, 240) ||
        '实验室通知：本场直播由莱茵生命资料库辅助记录 · 请遵守实验室规范 · 理性消费，适度游戏',
      timer: timerState(),
      np: nowPlaying(),
      stats: { viewers: biliStats.popularity || 12480, ping: biliStats.likes || 12, originium: biliStats.plays || 0.03, fans: biliStats.fans, plays: biliStats.plays, likes: biliStats.likes, popularity: biliStats.popularity },
      version: 'RHINE LAB v1.0',
      ...(layoutOverride ? { parts: withNpStyle(DEFAULT_PARTS[layout()]) } : {}),
    };
  }

  // 轮询音乐皮肤服务：曲名 / 艺术家 / 播放进度。
  async function pollNowPlaying() {
    if (!writer) return;
    try {
      const response = await fetch(musicBase + '/api/health', {
        cache: 'no-store',
        signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) return;
      const state = await response.json();
      const next = state && state.track;
      if (!next || typeof next !== 'object') return;
      track = {
        hasSong: next.hasSong === true,
        title: text(next.title, 120),
        artist: text(next.artist, 120),
        id: text(next.id, 200),
        cover: text(next.cover, 2048),
        position: Number(next.position) || 0,
        duration: Number(next.duration) || 0,
        paused: next.paused !== false,
        stamp: Date.now(),
      };
      const key = [track.hasSong, track.title, track.artist, track.paused, Math.round(track.duration), track.cover].join('|');
      if (key !== lastTrackKey || (track.hasSong && !track.paused && Date.now() - lastTrackPost > 4000)) {
        lastTrackKey = key;
        lastTrackPost = Date.now();
        pushState(true);
      }
    } catch {
      /* 音乐服务未启动时保持上一首曲目 */
    }
  }
  if (writer) {
    pollNowPlaying();
    setInterval(pollNowPlaying, 3000);
  }

  // B站账号数据：粉丝 / 播放 / 获赞 / 直播间人气，30 分钟刷新一次。
  let biliStats = { fans: 0, plays: 0, likes: 0, popularity: 0 };
  async function pollBiliStats() {
    if (!writer) return;
    try {
      const response = await fetch('http://127.0.0.1:8793/api/stats', {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return;
      const data = await response.json();
      const stats = data && data.stats;
      if (!stats) return;
      biliStats = {
        fans: Number(stats.fans) || 0,
        plays: Number(stats.plays) || 0,
        likes: Number(stats.likes) || 0,
        popularity: Number(stats.popularity) || 0,
      };
      pushState(true);
    } catch {
      /* 未登录或 B 站接口暂时不可用时保持旧值 */
    }
  }
  if (writer) {
    pollBiliStats();
    // 每 30 秒同步一次账号数据：登录 / 刚开播时不必等 30 分钟
    setInterval(pollBiliStats, 30 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) pollBiliStats();
    });
  }

  function pushState(immediate) {
    const state = buildState();
    $('rhineGeometry') && ($('rhineGeometry').textContent = geometryText());
    if (editor) direct({ type: 'rhine:state', state });
    if (!writer) return;
    const body = JSON.stringify({ state });
    if (body === last && !immediate) return;
    last = body;
    clearTimeout(pending);
    pending = setTimeout(() => {
      fetch('/api/rhine/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(4000),
      }).catch(() => {});
    }, immediate ? 0 : 180);
  }

  function pushMessage(message) {
    if (!message) return;
    if (editor) {
      direct({ type: 'rhine:message', message });
      return;
    }
    if (!writer) return;
    fetch('/api/rhine/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(4000),
    }).catch(() => {});
  }

  // 直播页「消息」表单：普通弹幕 / SC / 礼物档案 / 上舰提示同步到莱茵场景。
  $('sendPreset')?.addEventListener('change', () => {
    const value = $('sendPreset').value;
    if (value) $('sendBody').value = value;
  });
  $('messageForm')?.addEventListener(
    'submit',
    () => {
      const kind = $('sendKind')?.value || 'normal';
      const user = text($('sendName')?.value, 50) || '研究员 07';
      const body = text($('sendBody')?.value, 300);
      const tiers = [2, 30, 50, 100, 500, 1000, 2000];
      const ranks = {
        captain: { rankLabel: '舰长', rankEn: 'CAPTAIN', price: 198 },
        admiral: { rankLabel: '提督', rankEn: 'ADMIRAL', price: 1998 },
        governor: { rankLabel: '总督', rankEn: 'GOVERNOR', price: 19998 },
      };
      let message;
      if (kind === 'sc') {
        const tier = Number($('scTier')?.value || 3);
        message = { kind, user, text: body, amount: tiers[tier] || 100, duration: Number($('scDuration')?.value) || 180 };
      } else if (kind === 'gift') {
        message = { kind, user, name: text($('giftName')?.value, 60) || '至纯源石', count: Math.max(1, Number($('giftCount')?.value) || 1), value: Math.max(0, Number($('giftValue')?.value) || 0) };
      } else if (kind === 'fleet') {
        const rank = $('fleetRank')?.value || 'captain';
        message = { kind, user, rank, ...(ranks[rank] || ranks.captain) };
      } else {
        message = { kind: 'normal', user, text: body };
      }
      pushMessage(message);
    },
    true,
  );

  // 手动切换布局时，用该布局的标准区块坐标覆盖主题里为另一套布局准备的部件。
  $('rhineLayout')?.addEventListener('change', () => {
    const themeLayout = window.ThemeRenderer?.value?.settings?.rhineLayout;
    layoutOverride = layout() !== themeLayout;
    applyParts();
    pushState(true);
  });

  // 画面布局下拉直接以项目库里的三套基础画面为准（名称、顺序一致）。
  async function syncLayoutOptions() {
    if (!writer) return;
    const select = $('rhineLayout');
    if (!select) return;
    try {
      const list = await fetch('/api/projects', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null));
      const rows = [];
      for (const project of (list && list.projects) || []) {
        if (!project || typeof project.name !== 'string' || project.name.indexOf('RHINE LAB') !== 0) continue;
        const record = await fetch('/api/projects/' + project.id, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null));
        const layoutName =
          record && record.document && record.document.settings && record.document.settings.rhineLayout;
        if (['terminal', 'immersive', 'cockpit'].includes(layoutName))
          rows.push({ value: layoutName, label: project.name });
      }
      if (!rows.length) return;
      const current = select.value;
      select.replaceChildren(...rows.map((row) => new Option(row.label, row.value)));
      select.value = rows.some((row) => row.value === current) ? current : rows[0].value;
    } catch {
      /* 项目库暂时不可用时保留内置三个选项 */
    }
  }
  if (writer) syncLayoutOptions();

  // 首屏也要把完整部件坐标发给场景（此前只有切换布局才发，子部件会停在 0,0）。
  // 主题已在文档里时直接使用主题坐标，避免先闪一下标准布局。
  const sceneFrame = $('rhineScene');
  if (sceneFrame) sceneFrame.addEventListener('load', () => setTimeout(applyParts, 80));
  setTimeout(applyParts, 700);

  pushState(true);
  setInterval(() => pushState(true), 15000);

  // ---- 直播消息镜像：B 站 / 本地模拟 → 莱茵场景 ------------------------------
  // 消息面板与旧画布走的是 hiss-main 通道，莱茵场景只在 /api/rhine/message 上有数据。
  // 这里把 bilibili-live 收到的条目转换成莱茵消息格式，写进共享场景。
  const RHINE_KINDS = { normal: 'normal', sc: 'sc', superchat: 'sc', gift: 'gift', guard: 'fleet', fleet: 'fleet' };
  function toRhineMessage(raw) {
    if (!raw || typeof raw !== 'object' || raw.kind === 'delete') return null;
    const kind = RHINE_KINDS[String(raw.kind).toLowerCase()];
    if (!kind) return null;
    const message = {
      kind,
      user: raw.sender || raw.user || '',
      text: raw.body || raw.text || '',
    };
    if (kind === 'sc') message.amount = Number(raw.amount || raw.price || 0);
    if (kind === 'gift') {
      message.name = raw.giftName || '礼物';
      message.count = Number(raw.quantity || raw.count || 1);
      message.value = Number(raw.coins || raw.value || 0);
    }
    if (kind === 'fleet') {
      message.rank = raw.rank || 'captain';
      message.price = Number(raw.price || 0);
    }
    return message;
  }
  window.RhineLiveFeed = function (raw) {
    const message = toRhineMessage(raw);
    if (message) pushMessage(message);
  };
  window.addEventListener('pagehide', () => clearTimeout(pending));
})();
