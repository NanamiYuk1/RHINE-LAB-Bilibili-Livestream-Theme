/* ==========================================================================
   RHINE LAB LIVE UI — 场景渲染
   ========================================================================== */
(function () {
  'use strict';

  var S = window.RhineState;
  var M = window.RhineMessages;

  var params = new URLSearchParams(location.search);
  var isEmbedded = window.parent !== window;
  var isObs = params.get('obs') === '1';
  var isPreview = params.has('preview');
  var isServerClient = params.has('server');

  var state = S.readURL();
  if (!state) {
    if (isPreview || isObs) state = S.defaults();
    else state = S.loadLocal() || S.defaults();
  }
  state = S.normalize(state);

  var scene = document.getElementById('scene');
  var el = {
    hostText: id('hostText'),
    hostState: id('hostState'),
    titlePlate: id('titlePlate'),
    titleText: id('titleText'),
    plateCode: id('plateCode'),
    clockText: id('clockText'),
    liveBadge: id('liveBadge'),
    liveRes: id('liveRes'),
    timerText: id('timerText'),
    feed: id('feed'),
    feedImage: id('feedImage'),
    feedStandby: id('feedStandby'),
    recTime: id('recTime'),
    bgHolePath: id('bgHolePath'),
    bgClipPath: id('bgClipPath'),
    commsFeed: id('commsFeed'),
    commsRate: id('commsRate'),
    alertLayer: id('alertLayer'),
    opText: id('opText'),
    oriValue: id('oriValue'),
    oriBar: id('oriBar'),
    pingValue: id('pingValue'),
    viewerValue: id('viewerValue'),
    viewerDelta: id('viewerDelta'),
    briefTitle: id('briefTitle'),
    briefSub: id('briefSub'),
    briefElapsed: id('briefElapsed'),
    briefViewers: id('briefViewers'),
    briefPing: id('briefPing'),
    npTitle: id('npTitle'),
    npArtist: id('npArtist'),
    npInitial: id('npInitial'),
    npCover: id('npCover'),
    npState: id('npState'),
    npProgress: id('npProgress'),
    tickerTrack: id('tickerTrack'),
    roomText: id('roomText'),
    versionText: id('versionText'),
    boot: id('boot'),
    bootLog: id('bootLog'),
    bootBar: id('bootBar'),
    bootPct: id('bootPct')
  };

  var geometry = {
    terminal: { x: 40, y: 110, w: 1376, h: 774 },
    immersive: { x: 0, y: 0, w: 1920, h: 1080 },
    cockpit: { x: 40, y: 126, w: 1152, h: 648 }
  };

  var rateStamps = [];
  var seeded = false;
  var demoStarted = false;
  var demoTimer = 0;
  var statsTimer = 0;
  var serverConnected = false;
  var alertQueue = [];
  var alertActive = false;
  var clipRaf = 0;
  var lastSecond = -1;
  var lastNotice = '';
  var lastGift = null;

  init();

  function id(name) {
    return document.getElementById(name);
  }

  function init() {
    if (isObs) document.body.classList.add('is-obs');
    if (params.get('clear') === '1') document.body.classList.add('clear-bg');

    applyState(state, false);
    fitScene();
    window.addEventListener('resize', fitScene);

    tick();
    setInterval(tick, 500);
    el.commsFeed.addEventListener('scroll', scheduleClip, { passive: true });

    if (!isServerClient && !isPreview && state.demo) {
      seedFeed();
      startDemo();
    }

    startStatsLoop();
    runBoot(false);
    bindMessages();

    if (isEmbedded) {
      post({ type: 'rhine:scene-ready', state: state });
    }

    if (params.get('live') === '1' || (!isEmbedded && !isPreview && !params.has('s'))) {
      detectLive();
    }

    el.feedImage.addEventListener('error', function () {
      el.feed.classList.add('is-empty');
    });
  }

  function post(message) {
    try {
      window.parent.postMessage(message, '*');
    } catch (error) {
      /* ignore */
    }
  }

  function fitScene() {
    var width = window.innerWidth || 1920;
    var height = window.innerHeight || 1080;
    var scale = Math.min(width / 1920, height / 1080);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    document.documentElement.style.setProperty('--scene-scale', String(scale));
  }

  /* ---- 状态应用 -------------------------------------------------------- */

  function applyState(raw, initial) {
    state = S.normalize(raw);

    document.documentElement.dataset.accent = state.accent;
    scene.dataset.layout = state.layout;
    scene.dataset.motion = state.motion ? 'on' : 'off';
    scene.dataset.scan = state.scanlines ? 'on' : 'off';
    scene.dataset.alerts = state.alerts ? 'on' : 'off';
    scene.dataset.np = state.np.on ? 'on' : 'off';
    scene.dataset.npStyle = state.np.style === 'card' ? 'card' : 'bar';

    if (!(window.__rhinePartText && window.__rhinePartText.host)) setText(el.hostText, state.host);
    setText(el.hostState, state.live ? '观测中' : '离线');
    if (!(window.__rhinePartText && window.__rhinePartText.plate)) setText(el.titleText, state.title);
    setText(el.plateCode, state.code);
    el.titlePlate.hidden = state.title === '';

    el.liveBadge.classList.toggle('is-off', !state.live);
    el.liveBadge.innerHTML = '<i></i>' + (state.live ? 'LIVE' : 'OFF');
    el.liveRes.classList.toggle('is-off', !state.live);
    el.timerText.classList.toggle('is-off', !state.timer.running);

    setText(el.opText, S.formatCount(state.stats.fans));
    setText(el.oriValue, S.formatCount(state.stats.plays));
    el.oriBar.style.width = Math.max(4, Math.min(100, (state.stats.popularity / 1000) * 100)) + '%';
    setText(el.pingValue, S.formatCount(state.stats.likes));

    el.feed.classList.toggle('is-empty', !state.showGame);

    if (!(window.__rhinePartText && window.__rhinePartText.briefing)) setText(el.briefTitle, state.title);
    setText(el.briefSub, state.sub);
    setText(el.briefViewers, S.formatCount(state.stats.fans));
    setText(el.briefPing, S.formatCount(state.stats.popularity));

    setText(el.roomText, 'ROOM ' + state.room);
    setText(el.versionText, state.version);

    setText(el.npTitle, state.np.title);
    setText(el.npArtist, state.np.artist);
    setText(el.npInitial, (state.np.title || 'P').slice(0, 1).toUpperCase());
    el.npProgress.style.width = Math.round(state.np.progress * 100) + '%';
    if (el.npCover) {
      const cover = state.np.cover || '';
      if (cover) {
        el.npCover.src = cover;
        el.npCover.hidden = false;
      } else {
        el.npCover.removeAttribute('src');
        el.npCover.hidden = true;
      }
    }

    if (state.notice !== lastNotice) {
      lastNotice = state.notice;
      setTicker(state.notice);
    }
    updateFeedback();

    updateBg(state.layout);

    if (initial && isEmbedded && state.demo && !isServerClient) {
      seedFeed();
    }
  }

  function setText(node, value) {
    if (!node) return;
    var text = value == null ? '' : String(value);
    if (node.textContent !== text) node.textContent = text;
  }

  function updateFeedback() {
    var base = state.stats.popularity || 0;
    setText(el.viewerValue, S.formatCount(base));
    setText(el.viewerDelta, state.live ? 'LIVE' : '—');
    setText(el.briefElapsed, S.formatDuration(S.elapsed(state)));
  }

  function updateBg(layout) {
    var g = window.__rhineFeed || geometry[layout] || geometry.terminal;
    var d =
      'M0 0H1920V1080H0Z M' + g.x + ' ' + g.y + 'H' + (g.x + g.w) + 'V' + (g.y + g.h) + 'H' + g.x + 'Z';
    el.bgHolePath.setAttribute('d', d);
    if (el.bgClipPath) el.bgClipPath.setAttribute('d', d);
  }

  function setTicker(text) {
    var content = String(text || '').trim() || 'RHINE LAB // 数据库在线';
    var html = '';
    html += '<span>' + escapeHTML(content) + '</span>';
    html += '<span aria-hidden="true">' + escapeHTML(content) + '</span>';
    el.tickerTrack.innerHTML = html;
    var duration = Math.max(22, ((content.length * 10.5 + 900) / 52) | 0);
    el.tickerTrack.style.animationDuration = duration + 's';
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---- 时钟 / 计时 ----------------------------------------------------- */

  function tick() {
    setText(el.clockText, S.formatClock());
    var seconds = S.elapsed(state);
    if (seconds === lastSecond) return;
    if (seconds % 4 === 0) updateRate();
    lastSecond = seconds;
    var text = S.formatDuration(seconds);
    setText(el.timerText, text);
    setText(el.recTime, text);
    setText(el.briefElapsed, text);
  }

  /* ---- 消息 ------------------------------------------------------------ */

  function bindMessages() {
    window.addEventListener('message', function (event) {
      var data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'rhine:state') {
        applyState(data.state, true);
      } else if (data.type === 'rhine:message') {
        appendMessage(data.message, {});
      } else if (data.type === 'rhine:messages') {
        (Array.isArray(data.messages) ? data.messages : []).forEach(function (m) {
          appendMessage(m, { instant: true, silent: true, noAlert: true });
        });
        scrollFeed(true);
      } else if (data.type === 'rhine:clear') {
        clearFeed();
      } else if (data.type === 'rhine:boot') {
        runBoot(true);
      } else if (data.type === 'rhine:timer') {
        applyState(data.state, false);
      }
    });
  }

  function seedFeed() {
    if (seeded) return;
    seeded = true;
    // 直播预览 / OBS 输出不铺示例消息；只有主题编辑器的画布保留示例。
    var editorMode = false;
    try {
      editorMode = /(?:^|[?&])editor=1(?:&|$)/.test(window.parent.location.search);
    } catch (error) {}
    if (!editorMode) return;
    M.seed().forEach(function (message) {
      appendMessage(message, { instant: true, silent: true, noAlert: true });
    });
    scrollFeed(true);
  }

  function appendMessage(raw, options) {
    options = options || {};
    if (!raw || typeof raw !== 'object') return;
    var message = normalizeMessage(raw);
    if (!message) return;

    if (message.kind === 'gift' && mergeGift(message)) return;

    var node = buildMessage(message);
    if (!node) return;
    if (message.kind === 'gift') {
      lastGift = {
        node: node,
        user: message.user,
        name: message.name,
        count: message.count,
        value: message.value,
        at: Date.now()
      };
    }
    el.commsFeed.appendChild(node);
    trimFeed();

    rateStamps.push(Number(message.ts) || Date.now());
    updateRate();

    var nearBottom =
      el.commsFeed.scrollHeight - el.commsFeed.scrollTop - el.commsFeed.clientHeight < 120;
    if (options.instant) {
      if (options.beforeScroll !== true) scrollFeed(true);
    } else if (nearBottom) {
      scrollFeed(false);
    }

    if (!options.noAlert) enqueueAlert(message);

    if (message.kind === 'sc') {
      var duration = Math.max(8, Math.min(7200, message.duration || 180));
      window.setTimeout(
        function () {
          if (!node.isConnected) return;
          node.classList.add('is-out');
          window.setTimeout(function () {
            if (node.parentNode) node.parentNode.removeChild(node);
          }, 420);
        },
        duration * 1000
      );
    }
  }

  function normalizeMessage(raw) {
    var kind = String(raw.kind || 'normal');
    if (['normal', 'sc', 'gift', 'fleet', 'system'].indexOf(kind) < 0) kind = 'normal';
    var msg = {
      id: String(raw.id || M.uid()),
      kind: kind,
      user: clean(raw.user, 40) || '匿名',
      text: clean(raw.text, 300) || '',
      badge: clean(raw.badge, 16) || '',
      ts: Number(raw.ts) || Date.now()
    };
    if (kind === 'sc') {
      msg.amount = Math.max(0, Math.min(999999, Number(raw.amount) || 0));
      msg.duration = Math.max(8, Math.min(7200, Number(raw.duration) || 180));
    }
    if (kind === 'gift') {
      msg.name = clean(raw.name, 40) || '补给';
      msg.count = Math.max(1, Math.min(999999, Number(raw.count) || 1));
      msg.value = Math.max(0, Math.min(99999999, Number(raw.value) || 0));
    }
    if (kind === 'fleet') {
      var rank = String(raw.rank || 'captain');
      if (['captain', 'admiral', 'governor'].indexOf(rank) < 0) rank = 'captain';
      msg.rank = rank;
      msg.rankLabel = clean(raw.rankLabel, 8) || { captain: '舰长', admiral: '提督', governor: '总督' }[rank];
      msg.rankEn = clean(raw.rankEn, 16) || rank.toUpperCase();
      msg.price = Math.max(0, Number(raw.price) || { captain: 198, admiral: 1998, governor: 19998 }[rank]);
    }
    if (kind === 'system') {
      msg.text = clean(raw.text, 160) || '通讯链路已更新';
    }
    return msg;
  }

  function clean(value, max) {
    if (typeof value !== 'string') return '';
    return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
  }

  function elem(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function icon(name) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  }

  function timeLabel(ts) {
    var date = new Date(Number(ts) || Date.now());
    var h = date.getHours();
    var m = date.getMinutes();
    return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
  }

  function buildMessage(msg) {
    if (msg.kind === 'system') {
      var sys = elem('div', 'msg msg-system');
      sys.appendChild(elem('span', '', msg.text));
      return sys;
    }

    if (msg.kind === 'sc') {
      var sc = elem('article', 'msg msg-sc');
      if (msg.amount >= 500) sc.dataset.tier = 'high';
      var top = elem('div', 'sc-top');
      var label = elem('span', 'sc-label');
      label.appendChild(icon('sc'));
      label.appendChild(document.createTextNode('SUPER CHAT'));
      var amount = elem('span', 'sc-amount', '¥' + S.formatCount(msg.amount));
      amount.appendChild(elem('i', '', 'CNY'));
      top.appendChild(label);
      top.appendChild(amount);
      sc.appendChild(top);
      sc.appendChild(buildHead(msg));
      sc.appendChild(elem('p', 'msg-text', msg.text));
      var meter = elem('div', 'sc-meter');
      meter.appendChild(elem('i', ''));
      meter.style.setProperty('--dur', msg.duration + 's');
      sc.appendChild(meter);
      return sc;
    }

    if (msg.kind === 'gift') {
      var gift = elem('article', 'msg msg-gift');
      var giftIcon = elem('span', 'gift-icon');
      giftIcon.appendChild(icon('gift'));
      var giftMain = elem('div', 'gift-main');
      giftMain.appendChild(elem('span', 'gift-kicker', 'SAMPLE DELIVERY / 样本投递'));
      var giftLine = elem('p', 'gift-line');
      var giftUser = elem('b', '', msg.user);
      giftLine.appendChild(giftUser);
      giftLine.appendChild(document.createTextNode(' 投送了 '));
      giftLine.appendChild(elem('b', '', msg.name));
      giftLine.appendChild(document.createTextNode(' ×' + S.formatCount(msg.count)));
      giftMain.appendChild(giftLine);
      var giftValue = elem('span', 'gift-value', S.formatCount(msg.value));
      giftValue.appendChild(elem('i', '', '电池'));
      gift.appendChild(giftIcon);
      gift.appendChild(giftMain);
      gift.appendChild(giftValue);
      return gift;
    }

    if (msg.kind === 'fleet') {
      var fleet = elem('article', 'msg msg-fleet');
      fleet.dataset.rank = msg.rank;
      fleet.appendChild(elem('span', 'fleet-badge', msg.rankLabel));
      var fleetMain = elem('div', 'fleet-main');
      fleetMain.appendChild(elem('span', 'fleet-kicker', 'CLEARANCE GRANTED / ' + msg.rankEn));
      var fleetLine = elem('p', 'fleet-line');
      fleetLine.appendChild(elem('b', '', msg.user));
      fleetLine.appendChild(document.createTextNode(' 开通了' + msg.rankLabel));
      fleetMain.appendChild(fleetLine);
      fleet.appendChild(fleetMain);
      return fleet;
    }

    var normal = elem('article', 'msg msg-normal');
    normal.appendChild(buildHead(msg));
    normal.appendChild(elem('p', 'msg-text', msg.text));
    if (msg.badge) {
      var badge = normal.querySelector('.msg-badge');
      if (badge) badge.textContent = msg.badge;
    }
    return normal;
  }

  function buildHead(msg) {
    var head = elem('div', 'msg-head');
    head.appendChild(elem('time', 'msg-time', timeLabel(msg.ts)));
    head.appendChild(elem('span', 'msg-user', msg.user));
    if (msg.badge) head.appendChild(elem('span', 'msg-badge', msg.badge));
    if (msg.kind === 'sc') head.appendChild(elem('span', 'msg-badge', 'SC'));
    return head;
  }

  function mergeGift(message) {
    if (!lastGift || !lastGift.node.isConnected) return false;
    if (lastGift.user !== message.user || lastGift.name !== message.name) return false;
    if (Date.now() - lastGift.at > 5000) return false;
    lastGift.count += message.count;
    lastGift.value += message.value;
    lastGift.at = Date.now();
    var line = lastGift.node.querySelector('.gift-line');
    if (line) {
      line.textContent = '';
      line.appendChild(elem('b', '', lastGift.user));
      line.appendChild(document.createTextNode(' 投送了 '));
      line.appendChild(elem('b', '', lastGift.name));
      line.appendChild(document.createTextNode(' ×' + S.formatCount(lastGift.count)));
    }
    var value = lastGift.node.querySelector('.gift-value');
    if (value && value.firstChild) {
      value.firstChild.nodeValue = S.formatCount(lastGift.value);
    }
    lastGift.node.classList.remove('is-merged');
    void lastGift.node.offsetWidth;
    lastGift.node.classList.add('is-merged');
    return true;
  }

  function trimFeed() {
    var nodes = el.commsFeed.querySelectorAll('.msg');
    var overflow = nodes.length - 70;
    for (var i = 0; i < overflow; i++) {
      if (nodes[i] && nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
    }
  }

  function scrollFeed(instant) {
    var feed = el.commsFeed;
    if (instant) {
      feed.scrollTop = feed.scrollHeight;
    } else {
      feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' });
    }
    scheduleClip();
  }

  function scheduleClip() {
    if (clipRaf) return;
    clipRaf = window.requestAnimationFrame(function () {
      clipRaf = 0;
      updateClipped();
    });
  }

  function updateClipped() {
    var feed = el.commsFeed;
    var top = feed.scrollTop + 1;
    var nodes = feed.querySelectorAll('.msg');
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var nodeTop = node.offsetTop;
      var nodeBottom = nodeTop + node.offsetHeight;
      var partial = nodeTop < top && nodeBottom > top + 2;
      if (node.classList.contains('is-clipped') !== partial) {
        node.classList.toggle('is-clipped', partial);
      }
    }
  }

  function updateRate() {
    var now = Date.now();
    rateStamps = rateStamps.filter(function (stamp) {
      return now - stamp < 60000;
    });
    setText(el.commsRate, rateStamps.length + ' MSG/MIN');
  }

  function clearFeed() {
    var nodes = el.commsFeed.querySelectorAll('.msg');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
    }
    rateStamps = [];
    updateRate();
    seeded = true;
  }

  /* ---- 提醒 ------------------------------------------------------------ */

  function enqueueAlert(msg) {
    if (!state.alerts) return;
    if (msg.kind !== 'sc' && msg.kind !== 'gift' && msg.kind !== 'fleet') return;
    alertQueue.push(msg);
    if (!alertActive) nextAlert();
  }

  function nextAlert() {
    var msg = alertQueue.shift();
    if (!msg) {
      alertActive = false;
      return;
    }
    alertActive = true;
    var hold = msg.kind === 'fleet' ? 6 : msg.kind === 'sc' ? 5.5 : 4.6;
    var node = buildAlert(msg, hold);
    el.alertLayer.appendChild(node);
    window.setTimeout(function () {
      node.classList.add('is-leaving');
      window.setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
        alertActive = false;
        nextAlert();
      }, 360);
    }, hold * 1000);
  }

  function buildAlert(msg, hold) {
    var node = document.createElement('div');
    node.className = 'alert';
    node.dataset.kind = msg.kind;

    var mark = elem('span', 'alert-mark');
    mark.appendChild(icon(msg.kind === 'fleet' ? 'fleet' : msg.kind === 'sc' ? 'sc' : 'gift'));
    node.appendChild(mark);

    var body = elem('div', 'alert-body');
    body.appendChild(
      elem(
        'span',
        'alert-kicker',
        msg.kind === 'fleet'
          ? 'CLEARANCE GRANTED / 权限授予'
          : msg.kind === 'sc'
            ? 'SUPER CHAT / 醒目留言'
            : 'SAMPLE DELIVERY / 样本投递'
      )
    );
    var strong = elem('strong');
    strong.appendChild(elem('b', '', msg.user));
    if (msg.kind === 'fleet') {
      strong.appendChild(document.createTextNode(' 开通了' + msg.rankLabel));
    } else if (msg.kind === 'sc') {
      strong.appendChild(document.createTextNode(' 发送了 ¥' + S.formatCount(msg.amount) + ' 醒目留言'));
    } else {
      strong.appendChild(document.createTextNode(' 投送了 ' + msg.name + ' ×' + S.formatCount(msg.count)));
    }
    body.appendChild(strong);
    node.appendChild(body);

    var value = elem(
      'span',
      'alert-value',
      msg.kind === 'fleet'
        ? msg.rankLabel
        : msg.kind === 'sc'
          ? '¥' + S.formatCount(msg.amount)
          : S.formatCount(msg.value)
    );
    node.appendChild(value);

    var progress = elem('i', 'alert-progress');
    progress.style.setProperty('--hold', hold + 's');
    node.appendChild(progress);
    return node;
  }

  /* ---- 数字 / 示例 ------------------------------------------------------ */

  function startStatsLoop() {
    if (statsTimer) clearInterval(statsTimer);
    statsTimer = window.setInterval(function () {
      if (!state.demo || !state.live || isEmbedded || serverConnected) return;
      var drift = Math.round((Math.random() - 0.45) * 42);
      state.stats.viewers = Math.max(0, state.stats.viewers + drift);
      state.stats.ping = Math.max(6, Math.min(48, state.stats.ping + Math.round((Math.random() - 0.5) * 4)));
      state.stats.originium = Math.max(0.01, Math.min(0.09, state.stats.originium + (Math.random() - 0.5) * 0.006));
      setText(el.viewerValue, S.formatCount(state.stats.popularity));
      setText(el.briefViewers, S.formatCount(state.stats.fans));
      setText(el.pingValue, String(state.stats.ping));
      setText(el.briefPing, S.formatCount(state.stats.popularity));
      setText(el.oriValue, state.stats.originium.toFixed(2));
      el.oriBar.style.width = Math.max(4, Math.min(100, (state.stats.originium / 0.1) * 100)) + '%';
      setText(el.viewerDelta, '+' + (2 + Math.random() * 2.8).toFixed(1) + '%');
      updateFeedback();
    }, 4200);
  }

  function startDemo() {
    if (demoStarted || serverConnected) return;
    demoStarted = true;
    scheduleDemo();
  }

  function stopDemo() {
    demoStarted = false;
    if (demoTimer) clearTimeout(demoTimer);
    demoTimer = 0;
  }

  function scheduleDemo() {
    if (!demoStarted) return;
    demoTimer = window.setTimeout(function () {
      if (!state.demo || serverConnected) {
        stopDemo();
        return;
      }
      if (!document.hidden) appendMessage(M.random(), {});
      scheduleDemo();
    }, 5200 + Math.random() * 6200);
  }

  /* ---- 启动 ------------------------------------------------------------ */

  function runBoot(replay) {
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!state.boot || reduced || (!replay && params.get('noboot') === '1')) {
      finishBoot();
      return;
    }
    scene.dataset.enter = '0';
    el.boot.classList.remove('done');
    el.bootLog.innerHTML = '';
    el.bootBar.style.width = '0%';
    el.bootPct.textContent = '000';

    var lines = [
      ['ACCESS', 'REQUEST ACCESS // 请求访问'],
      ['ID', 'ID CONFIRMED : ' + state.host],
      ['SYNC', 'REQUEST RECEIVED // 已收到请求'],
      ['DB', 'START PROCESSING · INTERNAL DATABASE ONLINE']
    ];
    var index = 0;

    function step() {
      if (index >= lines.length) {
        el.bootBar.style.width = '100%';
        el.bootPct.textContent = '100';
        window.setTimeout(finishBoot, 360);
        return;
      }
      var line = document.createElement('div');
      line.innerHTML = '<b>› ' + lines[index][0] + '</b> // ' + lines[index][1];
      el.bootLog.appendChild(line);
      var percent = Math.round(((index + 1) / lines.length) * 100);
      el.bootBar.style.width = percent + '%';
      el.bootPct.textContent = String(percent).padStart(3, '0');
      index += 1;
      window.setTimeout(step, 400);
    }

    window.setTimeout(step, replay ? 100 : 260);
  }

  function finishBoot() {
    el.boot.classList.add('done');
    scene.dataset.enter = '1';
  }

  /* ---- 本地实时服务 ---------------------------------------------------- */

  function detectLive() {
    if (location.protocol === 'file:') return;
    var controller = window.AbortController ? new AbortController() : null;
    var timer = window.setTimeout(function () {
      if (controller) controller.abort();
    }, 1400);
    fetch('api/health', { cache: 'no-store', signal: controller ? controller.signal : undefined })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (info) {
        window.clearTimeout(timer);
        if (info && info.ok) connectLive();
      })
      .catch(function () {
        window.clearTimeout(timer);
      });
  }

  function connectLive() {
    if (serverConnected) return;
    serverConnected = true;
    stopDemo();

    var source = new EventSource('api/events');
    source.addEventListener('ready', function (event) {
      try {
        var payload = JSON.parse(event.data);
        if (payload.state) applyState(payload.state, true);
        clearFeed();
        (payload.messages || []).forEach(function (message) {
          appendMessage(message, { instant: true, silent: true, noAlert: true });
        });
        scrollFeed(true);
        seeded = true;
      } catch (error) {
        /* ignore malformed payload */
      }
    });
    source.addEventListener('state', function (event) {
      try {
        applyState(JSON.parse(event.data), false);
      } catch (error) {
        /* ignore */
      }
    });
    source.addEventListener('message', function (event) {
      try {
        appendMessage(JSON.parse(event.data), {});
      } catch (error) {
        /* ignore */
      }
    });
    source.addEventListener('clear', function () {
      clearFeed();
    });
    source.addEventListener('boot', function () {
      runBoot(true);
    });
  }
})();
