/* ==========================================================================
   RHINE LAB LIVE UI — 控制台逻辑
   ========================================================================== */
(function () {
  'use strict';

  var S = window.RhineState;
  var M = window.RhineMessages;

  var state = S.defaults();
  var serverMode = false;
  var serverMessages = [];
  var previewReady = false;
  var initialSynced = false;
  var currentKind = 'normal';
  var demoTimer = 0;
  var statePostTimer = 0;
  var toastTimer = 0;
  var sentCount = 0;

  var layoutNames = {
    terminal: '档案库 ARCHIVE',
    immersive: '全景 PANORAMA',
    cockpit: '研讨台 SEMINAR'
  };
  var geometry = {
    terminal: { x: 40, y: 110, w: 1376, h: 774 },
    immersive: { x: 0, y: 0, w: 1920, h: 1080 },
    cockpit: { x: 40, y: 126, w: 1152, h: 648 }
  };

  var el = {};
  var nodes = {};

  init();

  async function init() {
    cacheElements();
    buildGiftOptions();

    serverMode = await detectServer();
    if (serverMode) {
      var payload = await fetchServerState();
      if (payload && payload.state) state = S.normalize(payload.state);
      else state = S.normalize(S.loadLocal() || S.defaults());
      serverMessages = payload && Array.isArray(payload.messages) ? payload.messages : [];
    } else {
      state = S.normalize(S.loadLocal() || S.defaults());
    }

    if (!serverMode) S.saveLocal(state);

    bindEvents();
    applyFrameSource();
    fillForm();
    renderChrome();
    buildUrls();
    updateClock();
    window.setInterval(updateClock, 1000);
    window.setInterval(updateTimerDisplay, 500);
    updateTimerDisplay();

    if (serverMode) {
      pushServerState(true);
      if (state.demo && serverMessages.length === 0) {
        window.setTimeout(seedServer, 500);
      }
    }

    startDemoLoop();

    window.requestAnimationFrame(fitPreview);
    window.addEventListener('resize', fitPreview);
    if (window.ResizeObserver) {
      new ResizeObserver(fitPreview).observe(nodes.previewFrame);
    }
  }

  function cacheElements() {
    [
      'sceneFrame', 'previewFrame', 'previewStage', 'modePill', 'studioClock',
      'openSceneLink', 'copyObs', 'copyObs2', 'obsUrl', 'obsCoords', 'obsPos',
      'obsSize', 'layoutName', 'stateLine', 'footStatus', 'liveDot', 'liveLabel',
      'replayBoot', 'replayBoot2', 'fullPreview', 'timerDisplay', 'timerState',
      'timerToggle', 'timerReset', 'timerSet', 'timerInput', 'npOut', 'msgUser',
      'msgText', 'scAmount', 'scDuration', 'scText', 'giftName', 'giftCount',
      'fleetRank', 'msgStatus', 'sendMsg', 'burst', 'clearFeed', 'reseedFeed',
      'panelStatus', 'serverHint', 'toast', 'quickTimer', 'quickLayout'
    ].forEach(function (name) {
      el[name] = document.getElementById(name);
    });
    nodes.previewFrame = el.previewFrame;
    nodes.sceneFrame = el.sceneFrame;
  }

  function detectServer() {
    if (location.protocol === 'file:') return Promise.resolve(false);
    return fetch('api/health', { cache: 'no-store' })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (data) {
        return !!(data && data.ok);
      })
      .catch(function () {
        return false;
      });
  }

  function fetchServerState() {
    return fetch('api/state', { cache: 'no-store' })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .catch(function () {
        return null;
      });
  }

  function applyFrameSource() {
    var src = 'scene.html?preview=1&noboot=1';
    if (serverMode) src += '&server=1';
    if (el.sceneFrame.getAttribute('src') !== src) {
      el.sceneFrame.setAttribute('src', src);
    }
  }

  /* ---- 表单 ------------------------------------------------------------ */

  function buildGiftOptions() {
    if (!el.giftName) return;
    el.giftName.innerHTML = M.gifts
      .map(function (gift) {
        return '<option value="' + escapeAttr(gift.name) + '">' + escapeHTML(gift.name) + ' · ' + gift.value + '</option>';
      })
      .join('');
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escapeAttr(value) {
    return escapeHTML(value);
  }

  function fillForm() {
    document.querySelectorAll('[data-bind]').forEach(function (node) {
      var value = readPath(state, node.dataset.bind);
      node.value = value == null ? '' : value;
    });
    document.querySelectorAll('[data-toggle]').forEach(function (node) {
      node.checked = !!readPath(state, node.dataset.toggle);
    });
    document.querySelectorAll('[data-range]').forEach(function (node) {
      if (node.dataset.range === 'np.progress') {
        node.value = String(Math.round(state.np.progress * 100));
      }
    });
    if (el.timerInput) el.timerInput.value = '';
    updateRangeOutput();
  }

  function renderChrome() {
    document.documentElement.dataset.accent = state.accent;
    document.querySelectorAll('.swatch').forEach(function (node) {
      node.classList.toggle('is-active', node.dataset.accent === state.accent);
    });
    document.querySelectorAll('.layout-card').forEach(function (node) {
      node.classList.toggle('is-active', node.dataset.layout === state.layout);
    });
    var g = geometry[state.layout] || geometry.terminal;
    if (el.layoutName) el.layoutName.textContent = layoutNames[state.layout] || layoutNames.terminal;
    if (el.quickLayout) el.quickLayout.textContent = (layoutNames[state.layout] || '').split(' ')[0];
    document.querySelectorAll('[data-quick-layout]').forEach(function (node) {
      node.classList.toggle('is-active', node.dataset.quickLayout === state.layout);
    });
    if (el.obsCoords) el.obsCoords.textContent = g.x + ', ' + g.y + ' · ' + g.w + ' × ' + g.h;
    if (el.obsPos) el.obsPos.textContent = g.x + ', ' + g.y;
    if (el.obsSize) el.obsSize.textContent = g.w + ' × ' + g.h;
    if (el.liveDot) el.liveDot.classList.toggle('is-off', !state.live);
    if (el.liveLabel) el.liveLabel.textContent = state.live ? 'ON AIR' : 'OFF AIR';
    if (el.modePill) {
      el.modePill.classList.toggle('is-live', serverMode);
      var label = el.modePill.querySelector('span');
      if (label) label.textContent = serverMode ? '实时同步' : '离线快照';
    }
    if (el.serverHint) {
      el.serverHint.innerHTML = serverMode
        ? '实时同步已开启：控制台修改会立即推送到 OBS，无需重复复制地址。'
        : '运行 <code>start.cmd</code> 可开启本机实时同步：控制台修改会立即推送到 OBS，无需反复复制地址。';
    }
    updateTimerDisplay();
    updateRangeOutput();
    updateNavLink();
  }

  function updateRangeOutput() {
    if (!el.npOut) return;
    el.npOut.textContent = Math.round(state.np.progress * 100) + '%';
    var range = document.querySelector('[data-range="np.progress"]');
    if (range && document.activeElement !== range) range.value = String(Math.round(state.np.progress * 100));
  }

  function updateTimerDisplay() {
    if (!el.timerDisplay) return;
    var duration = S.formatDuration(S.elapsed(state));
    if (el.timerDisplay.textContent !== duration) el.timerDisplay.textContent = duration;
    if (el.quickTimer && el.quickTimer.textContent !== duration) el.quickTimer.textContent = duration;
    if (el.timerState) {
      el.timerState.classList.toggle('is-off', !state.timer.running);
      var status = state.timer.running ? 'RUNNING' : 'PAUSED';
      if (el.timerState.dataset.status !== status) {
        el.timerState.dataset.status = status;
        el.timerState.innerHTML = '<i></i>' + status;
      }
    }
    if (el.timerToggle) el.timerToggle.textContent = state.timer.running ? '暂停计时' : '继续计时';
  }

  function updateClock() {
    if (el.studioClock) el.studioClock.textContent = S.formatClock();
  }

  function readPath(obj, path) {
    return String(path)
      .split('.')
      .reduce(function (acc, key) {
        return acc && acc[key] !== undefined ? acc[key] : undefined;
      }, obj);
  }

  function writePath(obj, path, value) {
    var keys = String(path).split('.');
    var cursor = obj;
    for (var i = 0; i < keys.length - 1; i++) {
      if (!cursor[keys[i]] || typeof cursor[keys[i]] !== 'object') cursor[keys[i]] = {};
      cursor = cursor[keys[i]];
    }
    cursor[keys[keys.length - 1]] = value;
    return obj;
  }

  /* ---- 事件 ------------------------------------------------------------ */

  function bindEvents() {
    document.querySelectorAll('[data-bind]').forEach(function (node) {
      var path = node.dataset.bind;
      var eventName = node.tagName === 'TEXTAREA' || node.tagName === 'INPUT' ? 'input' : 'change';
      node.addEventListener(eventName, function () {
        applyPatch(path, node.value);
      });
    });

    document.querySelectorAll('[data-toggle]').forEach(function (node) {
      node.addEventListener('change', function () {
        applyPatch(node.dataset.toggle, node.checked);
        if (node.dataset.toggle === 'demo') {
          if (node.checked) startDemoLoop();
          else stopDemoLoop();
        }
      });
    });

    var progress = document.querySelector('[data-range="np.progress"]');
    if (progress) {
      progress.addEventListener('input', function () {
        applyPatch('np.progress', Number(progress.value) / 100);
        if (el.npOut) el.npOut.textContent = progress.value + '%';
      });
    }

    document.querySelectorAll('.layout-card, [data-quick-layout]').forEach(function (node) {
      var value = node.dataset.layout || node.dataset.quickLayout;
      node.addEventListener('click', function () {
        applyPatch('layout', value);
      });
    });

    document.querySelectorAll('.swatch').forEach(function (node) {
      node.addEventListener('click', function () {
        applyPatch('accent', node.dataset.accent);
      });
    });

    document.querySelectorAll('.kind-tabs button').forEach(function (node) {
      node.addEventListener('click', function () {
        currentKind = node.dataset.kind;
        document.querySelectorAll('.kind-tabs button').forEach(function (button) {
          button.classList.toggle('is-active', button === node);
        });
        document.querySelectorAll('[data-kind-panel]').forEach(function (panel) {
          panel.hidden = panel.dataset.kindPanel !== currentKind;
        });
      });
    });

    if (el.timerToggle) {
      el.timerToggle.addEventListener('click', function () {
        state = S.normalize(S.toggleTimer(state));
        commit(true);
      });
    }
    if (el.timerReset) {
      el.timerReset.addEventListener('click', function () {
        state = S.normalize(S.resetTimer(state));
        commit(true);
        toast('计时已归零');
      });
    }
    if (el.timerSet) {
      el.timerSet.addEventListener('click', function () {
        var seconds = parseClip(el.timerInput.value);
        if (seconds == null) {
          toast('请输入 HH:MM:SS 或 MM:SS');
          return;
        }
        state = S.normalize(S.setTimer(state, seconds, state.timer.running));
        el.timerInput.value = '';
        commit(true);
        toast('已设置为 ' + S.formatDuration(seconds));
      });
    }
    if (el.timerInput) {
      el.timerInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && el.timerSet) el.timerSet.click();
      });
    }

    if (el.sendMsg) el.sendMsg.addEventListener('click', sendComposed);
    if (el.burst) el.burst.addEventListener('click', burstMessages);
    if (el.clearFeed) el.clearFeed.addEventListener('click', clearMessages);
    if (el.reseedFeed) el.reseedFeed.addEventListener('click', restoreSeed);

    [el.copyObs, el.copyObs2].forEach(function (button) {
      if (!button) return;
      button.addEventListener('click', copyObsUrl);
    });
    [el.replayBoot, el.replayBoot2].forEach(function (button) {
      if (!button) return;
      button.addEventListener('click', replayBoot);
    });
    if (el.fullPreview) {
      el.fullPreview.addEventListener('click', function () {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (el.previewStage.requestFullscreen) el.previewStage.requestFullscreen();
      });
    }
    document.addEventListener('fullscreenchange', function () {
      window.setTimeout(fitPreview, 80);
    });

    window.addEventListener('message', function (event) {
      var data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'rhine:scene-ready') {
        previewReady = true;
        if (el.footStatus) el.footStatus.textContent = '画面已连接';
        syncInitial();
      }
    });

    el.sceneFrame.addEventListener('load', function () {
      previewReady = true;
      initialSynced = false;
      fitPreview();
      if (el.footStatus) el.footStatus.textContent = '画面已连接';
      syncInitial();
    });
  }

  function parseClip(value) {
    var raw = String(value || '').trim();
    if (!raw) return null;
    var parts = raw.split(':').map(function (part) {
      return Number(part.trim());
    });
    if (!parts.length || parts.some(function (part) { return !isFinite(part) || part < 0; })) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 1) return parts[0];
    return null;
  }

  /* ---- 状态同步 -------------------------------------------------------- */

  function applyPatch(path, value) {
    writePath(state, path, value);
    state = S.normalize(state);
    commit(true);
  }

  function commit(sendNow) {
    if (!serverMode) S.saveLocal(state);
    renderChrome();
    buildUrls();
    pushServerState(false);
    if (sendNow) sendState(false);
    scheduleSyncLabel();
  }

  function sendState(initial) {
    if (!previewReady) return;
    try {
      el.sceneFrame.contentWindow.postMessage(
        { type: 'rhine:state', state: state, initial: !!initial },
        '*'
      );
    } catch (error) {
      /* ignore */
    }
  }

  function syncInitial() {
    if (initialSynced || !previewReady) return;
    initialSynced = true;
    sendState(true);
    if (el.stateLine) el.stateLine.textContent = 'SYNC · ' + S.formatClock();
  }

  function postToScene(message) {
    if (!previewReady) return false;
    try {
      el.sceneFrame.contentWindow.postMessage(message, '*');
      return true;
    } catch (error) {
      return false;
    }
  }

  function pushServerState(immediate) {
    if (!serverMode) return;
    window.clearTimeout(statePostTimer);
    statePostTimer = window.setTimeout(
      function () {
        fetch('api/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: state })
        }).catch(function () {
          /* ignore */
        });
      },
      immediate ? 0 : 160
    );
  }

  function scheduleSyncLabel() {
    if (!el.stateLine) return;
    el.stateLine.textContent = 'SYNCING…';
    window.clearTimeout(scheduleSyncLabel.timer);
    scheduleSyncLabel.timer = window.setTimeout(function () {
      el.stateLine.textContent = 'SYNC · ' + S.formatClock();
    }, 320);
  }

  /* ---- OBS 地址 -------------------------------------------------------- */

  function buildSceneUrl(obs) {
    var url = new URL('scene.html', location.href);
    url.searchParams.set('noboot', '1');
    if (obs) {
      url.searchParams.set('obs', '1');
      if (serverMode) url.searchParams.set('live', '1');
      else url.searchParams.set('s', S.encode(S.snapshot(state)));
    } else if (serverMode) {
      url.searchParams.set('live', '1');
    } else {
      url.searchParams.set('s', S.encode(S.snapshot(state)));
    }
    return url.href;
  }

  function buildUrls() {
    if (el.obsUrl) el.obsUrl.value = buildSceneUrl(true);
    updateNavLink();
  }

  function updateNavLink() {
    if (!el.openSceneLink) return;
    el.openSceneLink.href = buildSceneUrl(false);
  }

  function copyObsUrl() {
    buildUrls();
    var text = el.obsUrl ? el.obsUrl.value : '';
    copyText(text).then(function () {
      toast(serverMode ? '已复制实时同步地址' : '已复制 OBS 地址快照');
      if (el.panelStatus) el.panelStatus.textContent = 'OBS 地址已复制';
    });
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () {
        return fallbackCopy(text);
      });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
    } catch (error) {
      /* ignore */
    }
    document.body.removeChild(area);
  }

  /* ---- 消息 ------------------------------------------------------------ */

  function sendComposed() {
    var user = (el.msgUser.value || '博士的理智').trim().slice(0, 40);
    var message = null;

    if (currentKind === 'normal') {
      var text = (el.msgText.value || '').trim();
      if (!text) return toast('先写一句弹幕内容');
      message = M.makeNormal({ user: user, text: text });
    } else if (currentKind === 'sc') {
      var scText = (el.scText.value || '').trim();
      if (!scText) return toast('先写一句 SC 留言');
      message = M.makeSC({
        user: user,
        text: scText,
        amount: Number(el.scAmount.value) || 100,
        duration: Number(el.scDuration.value) || 120
      });
    } else if (currentKind === 'gift') {
      var gift = M.gifts.find(function (item) {
        return item.name === el.giftName.value;
      }) || M.gifts[0];
      var count = Math.max(1, Math.min(9999, Number(el.giftCount.value) || 1));
      message = M.makeGift({ user: user, gift: gift, count: count, value: gift.value * count });
    } else if (currentKind === 'fleet') {
      var rank = M.ranks.find(function (item) {
        return item.id === el.fleetRank.value;
      }) || M.ranks[0];
      message = M.makeFleet({ user: user, rank: rank });
    }

    if (!message) return;
    dispatchMessage(message);
    var label = { normal: '弹幕', sc: '醒目留言', gift: '礼物', fleet: '上舰' }[currentKind];
    if (el.msgStatus) el.msgStatus.textContent = '已发送 ' + label + ' · ' + user + ' · ' + S.formatClock();
  }

  function dispatchMessage(message) {
    sentCount += 1;
    if (serverMode) {
      fetch('api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message })
      }).catch(function () {
        /* ignore */
      });
    } else {
      if (!postToScene({ type: 'rhine:message', message: message })) {
        /* 画面尚未连接时排队等下一拍 */
        window.setTimeout(function () {
          postToScene({ type: 'rhine:message', message: message });
        }, 500);
      }
    }
    if (el.panelStatus) el.panelStatus.textContent = '已发送 ' + sentCount + ' 条消息';
  }

  function burstMessages() {
    for (var i = 0; i < 5; i++) {
      window.setTimeout(function () {
        dispatchMessage(M.random());
      }, i * 420);
    }
    if (el.msgStatus) el.msgStatus.textContent = '正在连发 5 条示例消息…';
  }

  function clearMessages() {
    if (serverMode) {
      fetch('api/clear', { method: 'POST' }).catch(function () {});
    } else {
      postToScene({ type: 'rhine:clear' });
    }
    if (el.msgStatus) el.msgStatus.textContent = '消息已清空 · ' + S.formatClock();
  }

  function restoreSeed() {
    var messages = M.seed();
    if (serverMode) {
      fetch('api/clear', { method: 'POST' })
        .then(function () {
          return fetch('api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: messages })
          });
        })
        .catch(function () {});
    } else {
      postToScene({ type: 'rhine:clear' });
      postToScene({ type: 'rhine:messages', messages: messages });
    }
    if (el.msgStatus) el.msgStatus.textContent = '已恢复 ' + messages.length + ' 条示例消息';
  }

  function seedServer() {
    var messages = M.seed();
    fetch('api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages })
    }).catch(function () {});
  }

  function startDemoLoop() {
    stopDemoLoop();
    if (!state.demo) return;
    demoTimer = window.setTimeout(function () {
      if (!state.demo) return;
      if (!document.hidden) dispatchMessage(M.random());
      startDemoLoop();
    }, 5200 + Math.random() * 6000);
  }

  function stopDemoLoop() {
    window.clearTimeout(demoTimer);
    demoTimer = 0;
  }

  function replayBoot() {
    if (serverMode) {
      fetch('api/boot', { method: 'POST' }).catch(function () {});
    } else {
      postToScene({ type: 'rhine:boot' });
    }
    toast('正在重播启动序列');
  }

  /* ---- 尺寸 ------------------------------------------------------------ */

  function fitPreview() {
    if (!nodes.previewFrame) return;
    var width = nodes.previewFrame.clientWidth;
    if (!width) return;
    var scale = width / 1920;
    nodes.previewFrame.style.setProperty('--pv-scale', String(scale));
  }

  function toast(message) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      el.toast.classList.remove('show');
    }, 2200);
  }

  // 供调试与外部集成使用
  window.RhineStudio = {
    getState: function () {
      return S.clone(state);
    },
    sendMessage: dispatchMessage
  };
})();
