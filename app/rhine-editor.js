/* ==========================================================================
   RHINE LAB — 编辑器里的莱茵提示
   莱茵直播画面是内置底图；添加组件面板只保留可叠加的装饰类型。
   ========================================================================== */
(function () {
  'use strict';

  var BASE_TYPES = [
    'background', 'game', 'chat', 'host', 'topic', 'status', 'timer', 'logos', 'music',
    'grain', 'hiss', 'resonance', 'normal', 'sc', 'gift', 'fleet',
  ];

  function tidyAssets() {
    document.querySelectorAll('#assets .asset').forEach(function (button) {
      var preview = button.querySelector('.asset-preview[data-type]');
      if (preview && BASE_TYPES.indexOf(preview.dataset.type) >= 0) button.hidden = true;
    });
    var template = document.getElementById('chooseTemplate');
    if (template) template.hidden = true;
  }

  var observer = new MutationObserver(tidyAssets);
  observer.observe(document.body, { childList: true, subtree: true });
  tidyAssets();

  var hint = document.getElementById('canvasHint');
  if (hint && !hint.dataset.rhine) {
    hint.dataset.rhine = '1';
    hint.textContent = '莱茵画面为底图 · ' + hint.textContent;
  }

  // 旧的“主题设置 / 主题文件”里仍然可能出现控制：共振时代的文案，这里统一说明。
  var status = document.getElementById('saveState');
  if (status && /莱茵叠加层/.test(document.getElementById('projectName')?.value || '')) {
    status.title = '莱茵直播画面由内置场景提供；这里保存的是叠加层。';
  }
})();
