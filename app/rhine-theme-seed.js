/* ==========================================================================
   RHINE LAB — 主题编辑器的默认文档
   默认打开“档案库 ARCHIVE”基础画面：所有画面区块都是可单独选中、
   拖动、缩放、隐藏的「部件」图层。项目库预存三种基础画面布局。
   ========================================================================== */
(function () {
  'use strict';
  if (typeof ThemeDraftLoader === 'undefined' || typeof ThemeEditorModel === 'undefined') return;

  var BASE_TYPES = [
    'background', 'game', 'chat', 'host', 'topic', 'status', 'timer', 'logos', 'music',
    'grain', 'hiss', 'resonance', 'normal', 'sc', 'gift', 'fleet',
  ];
  var NAME = 'RHINE LAB · 档案库 ARCHIVE';
  var presetPromise = null;

  function overlayDocument() {
    return ThemeEditorModel.normalize({
      format: 'control-theme',
      version: 1,
      name: NAME,
      composition: 'layers',
      layers: [],
      settings: { rhineLayout: 'terminal', hostInput: '研究员 07', topicInput: '今晚的观测记录' },
    });
  }

  function defaultDocument() {
    if (!presetPromise) {
      presetPromise = fetch('rhine-presets/archive.json', { cache: 'no-store' })
        .then(function (response) {
          return response.ok ? response.json() : null;
        })
        .then(function (document) {
          return document && Array.isArray(document.layers)
            ? ThemeEditorModel.normalize(document)
            : null;
        })
        .catch(function () {
          return null;
        });
    }
    return presetPromise.then(function (document) {
      return document || overlayDocument();
    });
  }

  function isLegacy(document) {
    if (!document || !Array.isArray(document.layers)) return true;
    if (!document.layers.length) return true;
    return document.layers.some(function (layer) {
      return BASE_TYPES.indexOf(layer.type) >= 0;
    });
  }

  // 1) 换一套草稿键：旧草稿（包括空白叠加层）不再自动载入。
  var nativeKeys = ThemeDraftLoader.keys;
  ThemeDraftLoader.keys = function (qa) {
    var keys = nativeKeys(qa);
    return {
      key: keys.key + '-rhine2',
      previousKey: keys.previousKey + '-rhine2',
      legacyKey: keys.legacyKey + '-rhine2',
    };
  };

  // 2) 新建 / 兜底默认文档。
  ThemeEditorModel.create = function () {
    return overlayDocument();
  };

  // 3) 草稿为空或属于旧的整场景主题时，载入档案库基础画面。
  var nativeLoad = ThemeDraftLoader.load;
  ThemeDraftLoader.load = async function () {
    var result = await nativeLoad.apply(this, arguments);
    if (isLegacy(result && result.document)) {
      return Object.assign({}, result, {
        document: await defaultDocument(),
        initial: null,
        migrated: false,
      });
    }
    return result;
  };

  ThemeEditorModel.__rhineDefaultName = NAME;
})();
