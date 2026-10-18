/* ==========================================================================
   RHINE LAB LIVE UI — 工作室数据接入
   把 /api/rhine 通道上的状态与消息转成场景自身的 rhine:* 消息。
   场景可以独立放在 OBS 里运行，不需要父页面。
   ========================================================================== */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  if (location.protocol === 'file:') return;

  var parentEditor = false,
    parentPublished = false;
  // OBS 主机位：父页带 obs=1 时让游戏开孔透出（编辑器画布仍保留 NO SIGNAL 占位）。
  try {
    var parentParams = new URLSearchParams(window.parent.location.search);
    parentEditor = parentParams.has('editor');
    parentPublished = parentParams.has('published');
    if (parentParams.has('obs') && !parentParams.has('editor')) {
      document.body.classList.add('is-obs');
    }
  } catch (error) {
    /* parent is cross-origin: keep the standalone scene behaviour */
  }

  var stopped = false;
  var source = null;
  var retry = 0;

  function post(message) {
    try {
      window.postMessage(message, location.origin);
    } catch (error) {
      /* ignore */
    }
  }

  function deliverState(state) {
    if (!state || typeof state !== 'object') return;
    // 主题编辑器画布始终使用当前项目的布局；直播状态每 15 秒带一次直播页的布局，
    // 不能让它把编辑器画布切到别的布局（否则透明开孔会一阵一阵丢失）。
    if (parentEditor || parentPublished) {
      // 编辑器画布 / 已发布 OBS 输出：以当前页面自己的主题布局为准，
      // 不能被工作室每 15 秒推来的直播状态布局/部件覆盖。
      try {
        var parentLayout = window.parent.document.getElementById('rhineLayout').value;
        if (['terminal', 'immersive', 'cockpit'].indexOf(parentLayout) >= 0) {
          state = Object.assign({}, state, { layout: parentLayout });
        }
      } catch (error) {
        /* parent cross-origin: keep the state layout */
      }
    }
    // 直播页手动切换布局时，状态里会带该布局的标准区块坐标；
    // 编辑器画布和已发布 output 使用自己的主题部件，不接收。
    if (!parentEditor && !parentPublished && state.parts) post({ type: 'rhine:parts', parts: state.parts });
    post({ type: 'rhine:state', state: state });
  }

  function connect() {
    if (stopped) return;
    fetch('/api/rhine/state', { cache: 'no-store' })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (snapshot) {
        if (stopped) return;
        if (snapshot) {
          deliverState(snapshot.state);
          if (!params.has('nohistory')) {
            post({ type: 'rhine:clear' });
            post({ type: 'rhine:messages', messages: snapshot.messages || [] });
          }
        }
        source = new EventSource('/api/rhine/events');
        source.addEventListener('ready', function (event) {
          try {
            var payload = JSON.parse(event.data);
            deliverState(payload.state);
            post({ type: 'rhine:clear' });
            post({ type: 'rhine:messages', messages: payload.messages || [] });
          } catch (error) {
            /* ignore malformed snapshot */
          }
        });
        source.addEventListener('state', function (event) {
          try {
            deliverState(JSON.parse(event.data));
          } catch (error) {
            /* ignore */
          }
        });
        source.addEventListener('message', function (event) {
          try {
            post({ type: 'rhine:message', message: JSON.parse(event.data) });
          } catch (error) {
            /* ignore */
          }
        });
        source.addEventListener('clear', function () {
          post({ type: 'rhine:clear' });
        });
        source.addEventListener('boot', function () {
          post({ type: 'rhine:boot' });
        });
        source.addEventListener('error', function () {
          source && source.close();
          source = null;
          scheduleRetry();
        });
      })
      .catch(scheduleRetry);
  }

  function scheduleRetry() {
    if (stopped) return;
    clearTimeout(retry);
    retry = window.setTimeout(connect, 2000);
  }

  window.addEventListener('pagehide', function () {
    stopped = true;
    clearTimeout(retry);
    source && source.close();
  });

  connect();
})();
