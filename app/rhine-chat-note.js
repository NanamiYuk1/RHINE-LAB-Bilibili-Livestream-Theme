/* RHINE LAB — 弹幕编辑器说明 */
(function () {
  'use strict';
  var name = document.getElementById('projectName');
  if (name && /我的控制主题|控制共振/.test(name.value)) {
    name.value = '莱茵观测记录 · 消息模板';
  }
  var hint = document.getElementById('canvasHint');
  if (hint && !hint.dataset.rhineChat) {
    hint.dataset.rhineChat = '1';
    hint.textContent = '莱茵观测记录由直播消息驱动 · 此处编辑消息模板 · ' + hint.textContent;
  }
})();
