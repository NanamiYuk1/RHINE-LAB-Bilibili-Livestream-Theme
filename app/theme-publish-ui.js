/* Editing, applying, and broadcasting test messages are three explicit actions. */
(() => {
  'use strict';
  const boot = setInterval(() => {
    if (!window.ThemeEditor || !document.getElementById('publishDialog')) return;
    clearInterval(boot); mount();
  }, 50);
  function mount() {
    const $ = id => document.getElementById(id), editor = window.ThemeEditor;
    const channel = location.pathname.endsWith('chat-editor.html') ? 'chat' : 'theme';
    const endpoint = '/api/theme-publish/' + channel, dialog = $('publishDialog');
    const writer = crypto.randomUUID();
    const sameDocument = window.ThemeDocumentCompare?.same || ((a, b) => JSON.stringify(a) === JSON.stringify(b));
    let state = null, busy = false, auto = false, timeout = 0, connected = false, closed = false, error = '', inflight = null, connectionLost = false;
    let draft = editor.project;
    let chosenChatId = '', targetLocked = false;
    const section = document.createElement('section');
    section.className = 'publication-controls';
    section.innerHTML = '<p id="publicationState" role="status" aria-live="polite">正在读取直播版本…</p><button type="button" id="applyLiveTheme" class="primary wide">将当前草稿应用到直播</button><label class="publication-switch"><input type="checkbox" id="publicationAuto">修改时实时应用到直播</label><label class="publication-switch"><input type="checkbox" id="publicationMessages">测试消息同步到直播（会显示在 OBS）</label>';
    dialog.querySelector('.dialog-content').prepend(section);
    const obsSection = document.createElement('details'); obsSection.className = 'publication-obs';
    obsSection.innerHTML = '<summary>OBS 场景同步</summary><p id="publicationObsState" role="status">读取受管场景…</p><div id="publicationObsTargets"></div><div class="button-row"><button id="publicationObsConnect" type="button">接入 OBS</button><button id="publicationObsRetry" type="button">重试场景同步</button></div><p class="muted">停止管理后，OBS 场景仍会保留。</p>';
    section.append(obsSection);
    const badge = document.createElement('span'); badge.id = 'publicationBadge'; badge.className = 'publication-badge';
    badge.setAttribute('role', 'status'); $('publish').before(badge);
    const draftPreview = document.createElement('button'); draftPreview.type = 'button'; draftPreview.className = 'wide';
    draftPreview.textContent = '单独预览当前草稿';
    const openPreview = value => window.WorkspaceNavigation ? window.WorkspaceNavigation.open(value) : window.open(value, '_blank');
    draftPreview.onclick = async () => {
      // A portable project may contain large media data. Never put it in a URL
      // fragment or desktop navigation IPC message.
      const waitingWindow = window.WorkspaceNavigation ? null : window.open('about:blank', '_blank');
      draftPreview.disabled = true; draftPreview.textContent = '正在准备草稿预览…';
      try {
        const response = await fetch('/api/themes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editor.project), signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw Error('草稿预览保存失败，请检查本地服务');
        const { id } = await response.json();
        if (!/^[a-f0-9]{24}$/.test(id || '')) throw Error('本地服务返回了无效的预览地址');
        const link = new URL('live.html', location.href);
        link.search = new URLSearchParams({ theme: id, layout: 'custom', pure: '1', chatSync: channel }).toString();
        if (channel === 'chat') { link.searchParams.set('output', 'chat'); if (selectedChat()) link.searchParams.set('chat', selectedChat().id); }
        if (waitingWindow && !waitingWindow.closed) waitingWindow.location.replace(link.href);
        else openPreview(link.href);
      } catch (problem) { waitingWindow?.close(); error = problem.message; render(); }
      finally { draftPreview.disabled = false; draftPreview.textContent = '单独预览当前草稿'; }
    };
    $('openLive').after(draftPreview);
    const intro = $('outputSize')?.closest('p');
    if (intro) { const prefix = document.createTextNode('OBS 浏览器源尺寸：'); const suffix = document.createTextNode('。固定地址始终显示已应用的直播版本。'); intro.replaceChildren(prefix, $('outputSize'), suffix); }
    $('openLive').textContent = '查看已应用的直播画面';
    $('preview').textContent = '查看直播';
    const outputLabel = $('publishOutput').parentElement.firstChild;
    if (outputLabel?.nodeType === Node.TEXT_NODE) outputLabel.textContent = '下一次应用范围';
    const chatTarget = document.createElement('label'); chatTarget.id = 'publicationChatTarget'; chatTarget.className = 'publish-output';
    chatTarget.innerHTML = '输出哪个弹幕区<select id="publicationChatPicker" aria-label="输出弹幕区"></select><small id="publicationChatHint" role="status"></small>';
    $('publishOutput').closest('label').after(chatTarget);
    function accept(value, requestEpoch) {
      if (state && ((value.epoch === state.epoch && value.revision < state.revision) || (requestEpoch && state.epoch !== requestEpoch && value.epoch === requestEpoch))) return false;
      state = value;
      return true;
    }
    function dirty() { return !state?.document || !sameDocument(state.document, draft) || state.output !== $('publishOutput').value || (state.output === 'chat' && state.chatId !== selectedChat()?.id); }
    function contextualChat() {
      const doc = draft;
      const selected = doc.layers.find(layer => editor.selection?.includes(layer.id));
      const owner = selected?.type === 'chat' ? selected : window.ThemeInstances?.owner(doc, selected || {});
      return doc.layers.find(l => l.type === 'chat' && l.id === $('chatInstancePicker')?.value) || owner || doc.layers.find(l => l.type === 'chat');
    }
    function selectedChat() {
      return targetLocked ? draft.layers.find(layer => layer.type === 'chat' && layer.id === chosenChatId) : contextualChat();
    }
    function lockTarget() { if (!targetLocked) { chosenChatId = contextualChat()?.id || ''; targetLocked = true; } }
    function chatTargetError() {
      if ($('publishOutput').value !== 'chat') return '';
      const target = selectedChat();
      if (!target) return '之前选择的弹幕区已删除，请重新选择输出目标。';
      const value = window.ThemeEditorModel?.effective(draft, target) || target;
      return value.visible === false || Number(value.opacity ?? 1) === 0 ? '这个弹幕区已隐藏或完全透明，请先显示它再应用。' : '';
    }
    function renderChatTarget() {
      const chats = draft.layers.filter(layer => layer.type === 'chat'), picker = $('publicationChatPicker');
      const selected = selectedChat();
      chatTarget.hidden = $('publishOutput').value !== 'chat';
      picker.replaceChildren();
      if (!selected) { const option = document.createElement('option'); option.value = ''; option.textContent = chats.length ? '请选择弹幕区' : '没有组合弹幕区'; picker.append(option); }
      for (const chat of chats) {
        const option = document.createElement('option'); option.value = chat.id;
        const effective = window.ThemeEditorModel?.effective(draft, chat) || chat;
        option.textContent = chat.name + (effective.visible === false || Number(effective.opacity ?? 1) === 0 ? ' · 已隐藏' : ''); picker.append(option);
      }
      picker.value = selected?.id || '';
      $('publicationChatHint').textContent = chatTargetError() || (selected ? '下一次应用将单独输出「' + selected.name + '」。' : '');
    }
    function url(obs = false) {
      const value = new URL('live.html', location.href);
      value.searchParams.set('published', channel);
      value.searchParams.set('layout', 'custom');
      value.searchParams.set('chatSync', channel);
      if (obs) value.searchParams.set('obs', '1');
      // The publication packet owns output scope; this address stays identical
      // when switching between a full scene and an individual chat container.
      return value.href;
    }
    function messageMirroring(value) {
      for (const frame of document.querySelectorAll('iframe')) {
        try { frame.contentWindow.EditorMessageSync?.setMirroring(value); } catch {}
      }
      render();
    }
    let obsState = null;
    function renderObs(value) {
      obsState = value;
      const rows = (value?.targets || []).filter(target => target.channel === channel), pending = rows.filter(target => target.phase !== 'synced');
      $('publicationObsState').textContent = !rows.length ? '尚未接入 OBS 场景。' : pending.length ? `主题已应用，${pending.length} 个 OBS 场景等待同步。` : `${rows.length} 个 OBS 场景已同步采集位置与输出尺寸。`;
      $('publicationObsState').dataset.state = pending.length ? 'pending' : 'synced';
      const list = $('publicationObsTargets'); list.replaceChildren();
      for (const target of rows) {
        const row = document.createElement('div'); row.className = 'publication-obs-target';
        const info = document.createElement('p'); info.textContent = target.sceneName + ' · ' + target.message;
        const button = document.createElement('button'); button.type = 'button'; button.textContent = '停止管理';
        button.onclick = () => obsCommand('forget-published', { id: target.id });
        row.append(info, button); list.append(row);
      }
      $('publicationObsRetry').disabled = !rows.length || !value?.connected;
      render();
    }
    async function obsCommand(action, body = {}) {
      try {
        const response = await fetch('/api/obs/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Theme-Obs': '1' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
        const value = await response.json(); if (!response.ok) throw Error(value.error || 'OBS 同步未完成'); renderObs(value);
      } catch (problem) { $('publicationObsState').textContent = problem.message; }
    }
    $('publicationObsConnect').onclick = () => { dialog.close(); $('obsConnect')?.click(); };
    $('publicationObsRetry').onclick = () => obsCommand('retry-published');
    function render() {
      const draftChat = draft.layers.find(layer => layer.type === 'chat');
      const option = $('publishOutput').querySelector('[value="chat"]'); option.disabled = !draftChat;
      if (!draftChat && $('publishOutput').value === 'chat') $('publishOutput').value = 'scene';
      renderChatTarget();
      const isDirty = dirty();
      const obsWaiting = (obsState?.targets || []).some(target => target.channel === channel && !['synced', 'syncing'].includes(target.phase));
      const obsHint = obsWaiting ? ' · OBS 采集待同步' : '';
      const text = error || (!connected ? '直播服务未连接' : !state?.document ? '尚未应用主题' : isDirty ? '草稿有未应用的修改' : '已同步到直播');
      badge.textContent = (busy ? '正在应用…' : connected && auto ? '实时应用已开启' : text) + obsHint;
      badge.title = badge.textContent;
      badge.setAttribute('aria-label', badge.textContent);
      badge.dataset.state = error ? 'error' : busy || obsWaiting ? 'pending' : isDirty ? 'draft' : 'applied';
      $('publicationState').textContent = (busy ? '正在应用到直播…' : text) + obsHint + (state?.document ? ' · 已应用：' + state.name : '');
      $('applyLiveTheme').disabled = busy || !connected || !!chatTargetError();
      $('publicationAuto').checked = auto;
      $('publicationAuto').disabled = busy || !connected;
      $('copyUrl').disabled = !state?.document;
      $('openLive').disabled = !state?.document;
      $('obsUrl').value = state?.document ? url(true) : '先应用主题，再复制固定 OBS 地址。';
      const shown = state?.document || draft, onlyChat = state ? state.output === 'chat' : $('publishOutput').value === 'chat';
      const chat = shown.layers.find(l => l.type === 'chat' && l.id === state?.chatId) || shown.layers.find(l => l.type === 'chat');
      $('outputSize').textContent = onlyChat && chat ? Math.ceil(chat.w) + ' × ' + Math.ceil(chat.h) : '1920 × 1080';
      const game = shown.layers.find(l => l.type === 'game');
      $('captureInfo').textContent = onlyChat ? '调整尺寸后，请同步修改 OBS 浏览器源尺寸。' : game ? `游戏源位置 ${Math.round(game.x)}, ${Math.round(game.y)}；尺寸 ${Math.round(game.w)} × ${Math.round(game.h)}。` : '当前主题没有游戏窗口。';
      $('outputHint').textContent = onlyChat && chat ? '当前固定地址输出已应用的「' + chat.name + '」；修改目标后点击应用才会切换。' : '在 OBS 中将游戏采集放在主题下方。';
    }
    function halt(reason = '') { auto = false; clearTimeout(timeout); if (reason) error = reason; render(); }
    async function performApply() {
      busy = true; error = ''; render();
      try {
        if ($('publishOutput').value === 'chat') lockTarget();
        const targetProblem = chatTargetError(); if (targetProblem) throw Error(targetProblem);
        // A direct OBS binding is an alternative live writer, not a second background publisher.
        if (window.ThemeObsLive?.enabled) await window.ThemeObsLive.pause();
        const project = window.ThemeProjectLibrary?.current || {};
        const requestEpoch = state?.epoch;
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revision: state?.revision || 0, writer, document: editor.project, name: project.name, projectId: project.id, output: $('publishOutput').value, chatId: selectedChat()?.id }),
          signal: AbortSignal.timeout(15000) });
        const value = await response.json();
        if (!response.ok) {
          if (response.status === 409) { const latest = await fetch(endpoint); accept(await latest.json()); }
          throw Error(value.error || '直播应用失败');
        }
        const accepted = accept(value, requestEpoch); connected = true;
        if (accepted) {
          try { localStorage.setItem('control-live-view', JSON.stringify({ mode: channel, at: value.appliedAt })); } catch {}
          window.dispatchEvent(new CustomEvent('theme-published', { detail: value }));
        }
        return true;
      } catch (problem) { halt(problem.message); return false; }
      finally { busy = false; render(); if (auto && dirty()) queue(); }
    }
    function apply() {
      if (busy || closed) return Promise.resolve(false);
      const task = performApply(); inflight = task;
      return task.finally(() => { if (inflight === task) inflight = null; });
    }
    async function pause() { halt(); if (inflight) await inflight; }
    function queue() { clearTimeout(timeout); if (auto && !busy) timeout = setTimeout(apply, 260); }
    $('applyLiveTheme').onclick = apply;
    $('publicationAuto').onchange = async event => {
      auto = event.target.checked; error = ''; render();
      if (auto) await apply(); else clearTimeout(timeout);
    };
    $('publicationMessages').onchange = event => messageMirroring(event.target.checked);
    $('publish').onclick = () => { render(); dialog.showModal(); };
    $('publishOutput').onchange = () => { if ($('publishOutput').value === 'chat') lockTarget(); render(); queue(); };
    $('publicationChatPicker').onchange = event => { chosenChatId = event.target.value; targetLocked = true; render(); queue(); };
    $('copyUrl').onclick = async () => {
      if (!state?.document) return;
      try { await navigator.clipboard.writeText(url(true)); $('copyUrl').textContent = '已复制固定 OBS 地址'; }
      catch {
        const details = $('obsUrl').closest('details'); if (details) details.open = true;
        $('obsUrl').focus(); $('obsUrl').select();
      }
    };
    $('openLive').onclick = () => openPreview(url(false));
    $('preview').onclick = () => { if (state?.document) openPreview(url(false)); else { render(); dialog.showModal(); } };
    window.addEventListener('theme-document-change', event => { draft = event.detail.document; render(); queue(); });
    window.addEventListener('control-project-opened', () => { targetLocked = false; chosenChatId = ''; halt(); $('publicationMessages').checked = false; messageMirroring(false); });
    window.addEventListener('theme-document-switch', () => { targetLocked = false; chosenChatId = ''; halt(); $('publicationMessages').checked = false; messageMirroring(false); });
    window.addEventListener('obs-layout-sync-started', () => halt('已改为 OBS 场景实时绑定，固定地址的自动应用已暂停。'));
    const stream = window.StudioEvents ? window.StudioEvents.open(endpoint + '/events') : new EventSource(endpoint + '/events');
    const obsStream = window.StudioEvents?.open('/api/obs/published/events');
    obsStream?.addEventListener('obs-published', event => { try { renderObs(JSON.parse(event.data)); } catch {} });
    stream.addEventListener('published', event => {
      try {
        const value = JSON.parse(event.data), remoteUpdate = state && value.document && value.writer !== writer && (value.epoch !== state.epoch || value.revision > state.revision);
        accept(value); connected = true;
        if (connectionLost) { connectionLost = false; error = ''; }
        if (auto && remoteUpdate) halt('另一个编辑窗口已更新直播版本，当前窗口的实时应用已暂停。');
        render();
      } catch {}
    });
    stream.addEventListener('error', () => {
      connected = false; connectionLost = true;
      halt('直播服务已断开，实时应用已暂停；重连后可重新开启。');
    });
    window.ThemePublish = { apply, url, get state() { return state; }, get dirty() { return dirty(); }, pause };
    window.addEventListener('pagehide', () => { closed = true; clearTimeout(timeout); stream.close(); obsStream?.close(); });
    // Named live outputs: each one keeps its own document and fixed address so
    // separate OBS scenes can show different themes at the same time.
    if (channel === 'theme') mountOutputs();
    render();

    function mountOutputs() {
      const section = document.createElement('section');
      section.className = 'publication-second';
      section.innerHTML =
        '<h3>输出版本 · 每个 OBS 场景一套主题</h3>' +
        '<p class="muted">每个输出版本有自己的固定地址，可以把它们分别放进 OBS 的不同场景。上面的「应用到直播」始终更新主画面。</p>' +
        '<div id="outputList" class="output-list"></div>' +
        '<div class="output-create"><input id="outputName" maxlength="40" placeholder="新输出版本名称，例如 开场场景" aria-label="新输出版本名称"><button type="button" id="outputCreate">新建</button></div>' +
        '<p id="outputState" role="status" aria-live="polite"></p>' +
        '<p class="muted">「用当前草稿更新」只改动这个输出版本，不影响主画面。地址复制后粘贴到对应 OBS 场景的浏览器源即可。</p>';
      dialog.querySelector('.dialog-content').append(section);
      const list = $('outputList'), nameInput = $('outputName'), stateLabel = $('outputState');
      let outputs = [], busy = false, message = '', pendingDelete = '';
      function address(output) {
        const value = new URL('live.html', location.href);
        value.searchParams.set('published', output.channel);
        value.searchParams.set('layout', 'custom');
        value.searchParams.set('chatSync', 'theme');
        value.searchParams.set('obs', '1');
        return value.href;
      }
      function render() {
        list.replaceChildren();
        if (!outputs.length) {
          const empty = document.createElement('p');
          empty.className = 'muted';
          empty.textContent = '还没有自定义输出版本。新建一个，就得到一条独立的固定地址。';
          list.append(empty);
        }
        for (const output of outputs) {
          const row = document.createElement('div');
          row.className = 'output-row';
          const head = document.createElement('div');
          head.className = 'output-head';
          const title = document.createElement('b');
          title.textContent = output.label || output.channel;
          const detail = document.createElement('span');
          detail.textContent = output.hasDocument ? '已应用：' + output.name : '尚未应用';
          head.append(title, detail);
          const actions = document.createElement('div');
          actions.className = 'output-actions';
          const applyButton = document.createElement('button');
          applyButton.type = 'button'; applyButton.textContent = '用当前草稿更新'; applyButton.disabled = busy;
          applyButton.onclick = () => applyOutput(output);
          const copyButton = document.createElement('button');
          copyButton.type = 'button'; copyButton.textContent = '复制地址'; copyButton.disabled = busy;
          copyButton.onclick = () => copyOutput(output);
          const deleteButton = document.createElement('button');
          deleteButton.type = 'button'; deleteButton.disabled = busy;
          deleteButton.textContent = pendingDelete === output.channel ? '确认删除' : '删除';
          deleteButton.onclick = () => deleteOutput(output);
          actions.append(applyButton, copyButton, deleteButton);
          row.append(head, actions);
          list.append(row);
        }
        stateLabel.textContent = message;
        stateLabel.dataset.state = message ? 'error' : '';
        $('outputCreate').disabled = busy || outputs.length >= 8;
        nameInput.disabled = busy;
      }
      async function refresh() {
        try {
          const response = await fetch('/api/theme-publish', { signal: AbortSignal.timeout(15000) });
          const value = await response.json();
          if (!response.ok) throw Error(value.error || '读取输出版本失败');
          outputs = (value.outputs || []).filter(item => !item.builtin);
        } catch (problem) { message = problem.message; }
        render();
      }
      async function applyOutput(output) {
        if (busy) return;
        busy = true; message = ''; pendingDelete = ''; render();
        try {
          const latest = await (await fetch('/api/theme-publish/' + output.channel, { signal: AbortSignal.timeout(15000) })).json();
          const project = window.ThemeProjectLibrary?.current || {};
          const response = await fetch('/api/theme-publish/' + output.channel, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              revision: latest?.revision || 0, writer, document: draft, name: project.name || draft.name,
              projectId: project.id || '', output: 'scene', focus: false,
            }),
            signal: AbortSignal.timeout(30000),
          });
          const value = await response.json();
          if (!response.ok) throw Error(value.error || '应用失败');
          message = '已更新「' + (output.label || output.channel) + '」：' + value.name;
        } catch (problem) { message = problem.message; }
        finally { busy = false; await refresh(); }
      }
      async function copyOutput(output) {
        try {
          await navigator.clipboard.writeText(address(output));
          message = '已复制「' + (output.label || output.channel) + '」的固定地址。';
        } catch { message = '复制失败，请手动复制：' + address(output); }
        render();
      }
      async function deleteOutput(output) {
        if (busy) return;
        if (pendingDelete !== output.channel) {
          pendingDelete = output.channel;
          message = '再点一次「确认删除」删除这个输出版本；OBS 里已加好的浏览器源不会自动删除。';
          render();
          setTimeout(() => { if (pendingDelete === output.channel) { pendingDelete = ''; message = ''; render(); } }, 4000);
          return;
        }
        busy = true; pendingDelete = ''; message = ''; render();
        try {
          const response = await fetch('/api/theme-publish/' + output.channel, {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: '{}',
            signal: AbortSignal.timeout(15000),
          });
          const value = await response.json();
          if (!response.ok) throw Error(value.error || '删除失败');
          message = '已删除该输出版本。';
        } catch (problem) { message = problem.message; }
        finally { busy = false; await refresh(); }
      }
      $('outputCreate').onclick = async () => {
        const label = nameInput.value.trim();
        if (!label) { message = '请先填写输出版本名称。'; render(); return; }
        busy = true; message = ''; render();
        try {
          const response = await fetch('/api/theme-publish', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label }),
            signal: AbortSignal.timeout(15000),
          });
          const value = await response.json();
          if (!response.ok) throw Error(value.error || '新建失败');
          nameInput.value = '';
          message = '已新建「' + value.label + '」；可以复制地址，或用当前草稿更新它。';
        } catch (problem) { message = problem.message; }
        finally { busy = false; await refresh(); }
      };
      nameInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); $('outputCreate').click(); } });
      render();
      refresh();
    }
  }
})();