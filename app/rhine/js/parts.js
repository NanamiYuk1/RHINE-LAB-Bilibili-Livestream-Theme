/* ==========================================================================
   RHINE LAB LIVE UI — 可编辑部件
   主题编辑器把每个画面区块作为图层拖动 / 缩放 / 隐藏时，在这里应用到场景。
   ========================================================================== */
(function () {
  'use strict';

  var PARTS = {
    topbar: '.topbar',
    brand: '#topBrand',
    host: '#topHost',
    plate: '#topPlate',
    live: '#topLive',
    timer: '#topTimer',
    op: '#teleOp',
    env: '#teleEnv',
    uplink: '#teleUplink',
    visitors: '#teleVisitors',
    wave: '#teleWave',
    commshead: '#commsHead',
    commsfeed: '#commsFeedBox',
    commsfoot: '#commsFoot',
    feed: '#feed',
    comms: '#comms',
    telemetry: '#telemetry',
    briefing: '#briefing',
    briefcopy: '#briefCopy',
    briefstats: '#briefStats',
    briefdeco: '#briefDeco',
    nowplaying: '#nowPlaying',
    ticker: '#ticker',
    sysline: '#sysline',
  };

  var DISPLAY = {
    topbar: 'block',
    brand: 'flex',
    host: 'flex',
    plate: 'flex',
    live: 'flex',
    timer: 'flex',
    op: 'flex',
    env: 'flex',
    uplink: 'flex',
    visitors: 'flex',
    wave: 'flex',
    commshead: 'flex',
    commsfeed: 'flex',
    commsfoot: 'flex',
    feed: 'block',
    comms: 'flex',
    telemetry: 'flex',
    briefing: 'flex',
    briefcopy: 'flex',
    briefstats: 'flex',
    briefdeco: 'flex',
    nowplaying: 'flex',
    ticker: 'flex',
    sysline: 'flex',
  };

  var customFeed = null;
  var scene = null;
  var bgHole = null;
  var bgClip = null;

  // 可编辑文字部件 → 场景元素。数据类部件（遥测/计时/Now Playing）不在此表。
  var TEXT_TARGETS = {
    brand: '.brand-word b',
    host: '#hostText',
    plate: '#titleText',
    commshead: '.comms-titles h2',
    briefcopy: '#briefTitle',
  };
  var textDefaults = new WeakMap();
  function applyText(id, el, part) {
    var selector = TEXT_TARGETS[id];
    if (!selector) return;
    var target = el.matches(selector) ? el : el.querySelector(selector);
    if (!target) return;
    if (!textDefaults.has(target)) textDefaults.set(target, target.textContent);
    var text = typeof part.text === 'string' ? part.text : '';
    var custom = text.trim() ? text : '';
    target.textContent = custom || textDefaults.get(target);
    var mark = (window.__rhinePartText = window.__rhinePartText || {});
    mark[id] = custom;
    // 只取颜色，不把图层字号/字重套到场景文字上：观测标题这类部件的图层字号
    // 往往比场景排版大，套上去会压住 LOG.03 / SECURED 等其它元素。
    if (part.color && String(part.color).toLowerCase() !== '#eeeae1') target.style.color = part.color;
    else target.style.removeProperty('color');
    target.style.removeProperty('font-size');
    target.style.removeProperty('font-weight');
  }

  function ready() {
    scene = document.getElementById('scene');
    bgHole = document.getElementById('bgHolePath');
    bgClip = document.getElementById('bgClipPath');
    applyHole();
  }

  function applyHole() {
    if (!scene || !bgHole) return;
    var box = customFeed || layoutBox();
    if (!box) return;
    var d =
      'M0 0H1920V1080H0Z M' +
      box.x +
      ' ' +
      box.y +
      'H' +
      (box.x + box.w) +
      'V' +
      (box.y + box.h) +
      'H' +
      box.x +
      'Z';
    bgHole.setAttribute('d', d);
    if (bgClip) bgClip.setAttribute('d', d);
  }

  function layoutBox() {
    var layout = scene && scene.dataset.layout;
    return {
      terminal: { x: 40, y: 110, w: 1376, h: 774 },
      immersive: { x: 0, y: 0, w: 1920, h: 1080 },
      cockpit: { x: 40, y: 126, w: 1152, h: 648 },
    }[layout] || null;
  }

  function apply(parts) {
    if (!parts || typeof parts !== 'object') return;
    if (!scene) ready();
    for (var id in parts) {
      if (!Object.prototype.hasOwnProperty.call(parts, id)) continue;
      var selector = PARTS[id];
      if (!selector) continue;
      var el = document.querySelector(selector);
      if (!el) continue;
      var part = parts[id] || {};
      if (part.visible === false) {
        el.style.display = 'none';
        if (id === 'feed') customFeed = null;
        continue;
      }
      el.style.display = DISPLAY[id] || '';
      if (typeof part.x === 'number') el.style.left = part.x + 'px';
      if (typeof part.y === 'number') el.style.top = part.y + 'px';
      if (typeof part.w === 'number') el.style.width = part.w + 'px';
      if (typeof part.h === 'number') el.style.height = part.h + 'px';
      var opacityValue = typeof part.opacity === 'number' ? part.opacity : 1;
      if (typeof part.panelOpacity === 'number' && part.panelOpacity >= 0 && part.panelOpacity !== 1)
        opacityValue *= part.panelOpacity;
      if (typeof part.opacity === 'number' || (typeof part.panelOpacity === 'number' && part.panelOpacity !== 1))
        el.style.opacity = String(opacityValue);
      var filters = [];
      if (Number(part.brightness) > 0 && Number(part.brightness) !== 1)
        filters.push('brightness(' + part.brightness + ')');
      if (Number(part.shadow) > 0)
        filters.push('drop-shadow(0 2px ' + part.shadow + 'px rgba(0,0,0,.35))');
      el.style.filter = filters.join(' ');
      if (Number(part.radius) > 0) el.style.borderRadius = part.radius + 'px';
      el.style.setProperty('--part-grain', String(part.grain || 0));
      el.classList.toggle('part-grain', Number(part.grain) > 0);
      applyText(id, el, part);
      if (id === 'feed' && [part.x, part.y, part.w, part.h].every(function (v) { return typeof v === 'number'; })) {
        customFeed = { x: part.x, y: part.y, w: part.w, h: part.h };
        window.__rhineFeed = customFeed;
        applyHole();
      }
    }
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object' || data.type !== 'rhine:parts') return;
    apply(data.parts);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();

  // 布局切换时先恢复布局自带的游戏开孔。
  var observer = new MutationObserver(function () {
    customFeed = null;
    window.__rhineFeed = null;
    applyHole();
  });
  window.addEventListener('DOMContentLoaded', function () {
    if (scene) observer.observe(scene, { attributes: true, attributeFilter: ['data-layout'] });
  });
})();
