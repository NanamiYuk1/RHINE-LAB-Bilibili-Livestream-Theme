/* Native HUD controls: alter typography and layout without replacing animated nodes. */
(function (root) {
  'use strict';
  const n = (key, label, def, min, max, step = 1, mode) => ({
      key,
      label,
      type: 'number',
      default: def,
      min,
      max,
      step,
      ...(mode ? { mode } : {}),
    }),
    b = (key, label) => ({ key, label, type: 'checkbox', default: true });
  const schema = {
    header: [
      b('headerHostVisible', '显示主播名'),
      b('headerTopicVisible', '显示直播标题'),
      b('headerStatusVisible', '显示直播状态'),
      b('headerMarkVisible', '显示三角'),
      b('headerRuleVisible', '显示底线'),
      b('headerDividerVisible', '显示分隔线'),
      n('headerHostSize', '主播名字号 · 0 原版', 0, 0, 120),
      n('headerTopicSize', '标题字号 · 0 原版', 0, 0, 120),
      n('headerStatusSize', '状态字号 · 0 原版', 0, 0, 100),
      n('headerWeight', '文字字重 · 0 原版', 0, 0, 900, 100),
      n('headerGap', '元素间距', 24, 0, 160),
      n('headerTopicPadding', '白框左右留白', 30, 0, 100),
      n('headerTopicWidth', '标题最大宽度 · 0 原版', 0, 0, 1920),
      { key: 'headerWrap', label: '允许标题栏换行', type: 'checkbox', default: false },
    ],
    timer: [
      b('timerIconVisible', '显示时钟图标'),
      b('timerLabelVisible', '显示计时标签'),
      { key: 'timerLabelText', label: '计时标签', type: 'text', default: '直播时长' },
      n('timerLabelSize', '标签字号 · 0 原版', 0, 0, 120),
      n('timerDigitsSize', '数字字号 · 0 原版', 0, 0, 120),
      n('timerIconSize', '图标尺寸 · 0 原版', 0, 0, 120),
      n('timerWeight', '文字字重 · 0 原版', 0, 0, 900, 100),
      n('timerGap', '元素间距', 12, 0, 160),
      {
        key: 'timerDirection',
        label: '排列方向',
        type: 'select',
        default: 'row',
        options: [
          ['row', '横向'],
          ['column', '纵向'],
        ],
      },
      {
        key: 'timerAlign',
        label: '内容对齐',
        type: 'select',
        default: 'left',
        options: [
          ['left', '左侧'],
          ['center', '居中'],
          ['right', '右侧'],
        ],
      },
    ],
    logos: [
      b('logoEnglishVisible', '显示英文 Logo'),
      b('logoChineseVisible', '显示中文 Logo'),
      b('logoDividerVisible', '显示分隔线'),
      b('logoSignalVisible', '显示底部信号'),
      {
        key: 'logoContentMode',
        label: '字标内容',
        type: 'select',
        default: 'artwork',
        options: [
          ['artwork', '官方图形字标'],
          ['text', '自定义文字'],
        ],
      },
      {
        key: 'logoEnglishText',
        label: '英文文字',
        type: 'text',
        default: 'CONTROL RESONANT',
        mode: 'text',
      },
      {
        key: 'logoChineseText',
        label: '中文文字',
        type: 'text',
        default: '控制 共振',
        mode: 'text',
      },
      {
        key: 'logoTextFont',
        label: '文字字体',
        type: 'select',
        default: 'condensed',
        mode: 'text',
        options: [
          ['condensed', '窄体 · Roboto Condensed'],
          ['sans', '无衬线 · 微软雅黑'],
          ['serif', '衬线 · Georgia'],
          ['mono', '等宽 · Consolas'],
        ],
      },
      n('logoTextWeight', '文字字重 · 0 自动', 0, 0, 900, 100, 'text'),
      n('logoTextScale', '文字大小 %', 100, 30, 250, 1, 'text'),
      n('logoTextTracking', '文字字距', 0, -20, 40, 0.5, 'text'),
      {
        key: 'logoTextColor',
        label: '文字颜色',
        type: 'color',
        default: '#fcfcfc',
        mode: 'text',
      },
      n('logoEnglishHeight', '英文字标高度', 74, 4, 240, 0.5),
      n('logoChineseHeight', '中文字标高度', 82, 4, 240, 0.5),
      n('logoEnglishGap', '英文词间距', 30, 0, 200, 0.5),
      n('logoChineseGap', '中文词间距', 24, 0, 200, 0.5),
      n('logoGap', '中英文间距', 57.5, 0, 400, 0.5),
      n('logoDividerLength', '分隔线长度 · 0 自动', 0, 0, 900),
      n('logoDividerWidth', '分隔线粗细', 1, 0, 12, 0.25),
      {
        key: 'logoDirection',
        label: '中英文排列',
        type: 'select',
        default: 'row',
        options: [
          ['row', '左右排列'],
          ['column', '上下排列'],
        ],
      },
      {
        key: 'logoOrder',
        label: '字标顺序',
        type: 'select',
        default: 'english',
        options: [
          ['english', '英文在前'],
          ['chinese', '中文在前'],
        ],
      },
      {
        key: 'logoAlign',
        label: '水平对齐',
        type: 'select',
        default: 'left',
        options: [
          ['left', '左侧'],
          ['center', '居中'],
          ['right', '右侧'],
        ],
      },
      {
        key: 'logoVerticalAlign',
        label: '垂直对齐',
        type: 'select',
        default: 'center',
        options: [
          ['top', '顶部'],
          ['center', '居中'],
          ['bottom', '底部'],
        ],
      },
    ],
  };
  const headerTypes = ['header', 'host', 'topic', 'status'];
  const isHeader = (type) => headerTypes.includes(type);
  const headerFields = {
    host: ['headerHostVisible', 'headerMarkVisible', 'headerHostSize', 'headerWeight', 'headerGap'],
    topic: ['headerTopicVisible', 'headerTopicSize', 'headerWeight', 'headerTopicPadding', 'headerTopicWidth'],
    status: ['headerStatusVisible', 'headerStatusSize', 'headerWeight'],
  };
  for (const [type, keys] of Object.entries(headerFields))
    schema[type] = schema.header.filter(s => keys.includes(s.key));
  // Panels only show the words that the current content mode actually renders.
  function fields(type, values = {}) {
    const list = schema[type] || [];
    if (type !== 'logos') return list;
    const mode = values.logoContentMode === 'text' ? 'text' : 'artwork';
    return list.filter((spec) => !spec.mode || spec.mode === mode);
  }
  function coerce(spec, v, fallback) {
    if (spec.type === 'checkbox') return typeof v === 'boolean' ? v : spec.default;
    if (spec.type === 'number')
      return Math.max(
        spec.min,
        Math.min(spec.max, v !== '' && v != null && Number.isFinite(+v) ? +v : fallback),
      );
    if (spec.type === 'select') return spec.options.some(([k]) => k === v) ? v : spec.default;
    if (spec.type === 'color')
      return /^#[0-9a-f]{6}$/i.test(String(v)) ? String(v).toLowerCase() : spec.default;
    return typeof v === 'string' ? v.slice(0, 80) : spec.default;
  }
  function normalize(raw, type) {
    const out = {},
      height = Number.isFinite(+raw.h) ? Math.max(2, Math.min(1080, +raw.h)) : 90;
    if (isHeader(type) || type === 'timer')
      out.hudScale =
        Number.isFinite(+raw.hudScale) && raw.hudScale !== null
          ? Math.max(0.02, Math.min(33, +raw.hudScale))
          : height / (isHeader(type) ? 33 : 43);
    const logoScale = Math.min((Number.isFinite(+raw.w) ? +raw.w : 1350) / 1350, height / 90),
      scaled = new Set([
        'logoEnglishHeight',
        'logoChineseHeight',
        'logoEnglishGap',
        'logoChineseGap',
        'logoGap',
        'logoDividerWidth',
      ]);
    for (const spec of schema[type] || []) {
      const v = raw[spec.key],
        fallback =
          spec.key === 'timerGap'
            ? Math.min(160, 12 * out.hudScale)
            : scaled.has(spec.key)
              ? spec.default * logoScale
              : spec.default;
      out[spec.key] = coerce(spec, v, fallback);
    }
    return out;
  }
  // Custom wordmarks keep the artwork metrics: the supplied text is set in the
  // same box the cropped PNG used, so containers, dividers and alignment keep
  // working. Cap-height ratios only decide the matching point size.
  const FONT_STACKS = {
    condensed: '"Roboto Condensed","Arial Narrow","Microsoft YaHei UI","Microsoft YaHei",sans-serif',
    sans: '"Segoe UI","Microsoft YaHei UI","Microsoft YaHei","PingFang SC",sans-serif',
    serif: 'Georgia,"Songti SC","SimSun",serif',
    mono: 'Consolas,"Microsoft YaHei",monospace',
  };
  const CJK_TEXT = /[\u2e80-\u9fff\uf900-\ufaff\uff01-\uff60]/;
  const LATIN_RATIO = 1.4,
    CJK_RATIO = 1.1;
  const isTextMode = (l) => l.logoContentMode === 'text';
  function logoWords(text, limit = 6) {
    return String(text ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, limit);
  }
  function logoWordStyle(l, group, word) {
    const height = Math.max(2, group === 'chinese' ? +l.logoChineseHeight : +l.logoEnglishHeight),
      cjk = CJK_TEXT.test(word),
      scale = Math.max(0.3, Math.min(2.5, (+l.logoTextScale || 100) / 100)),
      weight = Math.round(+l.logoTextWeight || 0);
    return {
      fontFamily: FONT_STACKS[l.logoTextFont] || FONT_STACKS.condensed,
      fontSize: height * (cjk ? CJK_RATIO : LATIN_RATIO) * scale,
      fontWeight: weight > 0 ? weight : cjk ? 900 : 800,
      letterSpacing: +l.logoTextTracking || 0,
      color: /^#[0-9a-f]{6}$/i.test(String(l.logoTextColor)) ? l.logoTextColor : '#fcfcfc',
    };
  }
  let measureCanvas = null;
  const requestedFonts = new Set();
  function measureContext() {
    if (measureCanvas !== null) return measureCanvas;
    measureCanvas = false;
    try {
      if (typeof document !== 'undefined' && document.createElement)
        measureCanvas = document.createElement('canvas').getContext('2d') || false;
    } catch {
      measureCanvas = false;
    }
    return measureCanvas;
  }
  function wordWidth(word, style) {
    const tracking = Math.max(0, word.length - 1) * style.letterSpacing,
      ctx = measureContext();
    if (ctx) {
      const font = style.fontWeight + ' ' + style.fontSize + 'px ' + style.fontFamily;
      // Measurement can run before the display face resolves; request it so later
      // frames and the panel note see the real glyph widths.
      if (!requestedFonts.has(font)) {
        requestedFonts.add(font);
        try {
          document.fonts?.load(font)?.catch(() => {});
        } catch {}
      }
      ctx.font = font;
      return ctx.measureText(word).width + tracking;
    }
    // Only the local service runs without a document; it never paints.
    return word.length * style.fontSize * (CJK_TEXT.test(word) ? 1 : 0.55) + tracking;
  }
  function groupTextWidth(l, group) {
    const words = logoWords(group === 'chinese' ? l.logoChineseText : l.logoEnglishText),
      gap = Math.max(0, group === 'chinese' ? +l.logoChineseGap : +l.logoEnglishGap);
    let width = 0;
    words.forEach((word, i) => {
      width += wordWidth(word, logoWordStyle(l, group, word)) + (i ? gap : 0);
    });
    return width;
  }
  function logoMetrics(l) {
    const text = isTextMode(l),
      ew = text
        ? groupTextWidth(l, 'english')
        : ((390 + 437) * l.logoEnglishHeight) / 74 + l.logoEnglishGap,
      eh = l.logoEnglishHeight,
      cw = text
        ? groupTextWidth(l, 'chinese')
        : ((175 + 178) * l.logoChineseHeight) / 82 + l.logoChineseGap,
      ch = l.logoChineseHeight;
    const groups = [
        ...(l.logoEnglishVisible ? [{ w: ew, h: eh }] : []),
        ...(l.logoChineseVisible ? [{ w: cw, h: ch }] : []),
      ],
      vertical = l.logoDirection === 'column',
      divider = groups.length === 2 && l.logoDividerVisible && l.logoDividerWidth > 0;
    const dividerLength =
      l.logoDividerLength ||
      (vertical ? Math.max(ew, cw) * 0.6 : (Math.max(...groups.map((g) => g.h), 0) * 89) / 82);
    const items = [
      ...groups,
      ...(divider
        ? [
            {
              w: vertical ? dividerLength : l.logoDividerWidth,
              h: vertical ? l.logoDividerWidth : dividerLength,
            },
          ]
        : []),
    ];
    const gap = Math.max(0, items.length - 1) * l.logoGap;
    return {
      ew,
      eh,
      cw,
      ch,
      divider,
      dividerLength,
      w: vertical
        ? Math.max(...items.map((g) => g.w), 0)
        : items.reduce((v, g) => v + g.w, 0) + gap,
      h: vertical
        ? items.reduce((v, g) => v + g.h, 0) + gap
        : Math.max(...items.map((g) => g.h), 0),
    };
  }
  const wordCache = new WeakMap();
  function syncWords(group, l, name) {
    const words = logoWords(name === 'chinese' ? l.logoChineseText : l.logoEnglishText),
      signature = words.join('\u0001');
    let cached = wordCache.get(group);
    if (
      !cached ||
      cached.signature !== signature ||
      (cached.nodes.length > 0 && cached.nodes[0].isConnected === false)
    ) {
      for (const node of cached?.nodes || []) node.remove();
      const nodes = words.map((word) => {
        const span = group.ownerDocument.createElement('span');
        span.className = 'logo-word';
        span.textContent = word;
        return span;
      });
      for (const node of nodes) group.append(node);
      cached = { signature, nodes };
      wordCache.set(group, cached);
    }
    cached.nodes.forEach((node, i) => {
      const style = logoWordStyle(l, name, words[i]);
      Object.assign(node.style, {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize + 'px',
        fontWeight: String(style.fontWeight),
        letterSpacing: style.letterSpacing + 'px',
        color: style.color,
      });
    });
    return words;
  }
  function applyLogos(el, l) {
    const lock = el.querySelector('.control-logo-lockup');
    if (!lock) return;
    const m = logoMetrics(l),
      text = isTextMode(l),
      vertical = l.logoDirection === 'column',
      align = { left: 'flex-start', center: 'center', right: 'flex-end' }[l.logoAlign],
      valign = { top: 'flex-start', center: 'center', bottom: 'flex-end' }[l.logoVerticalAlign];
    Object.assign(lock.style, {
      left: '0px',
      top: '0px',
      width: '100%',
      height: '100%',
      transform: 'none',
      flexDirection: l.logoDirection,
      justifyContent: vertical ? valign : align,
      alignItems: vertical ? align : valign,
      gap: l.logoGap + 'px',
    });
    for (const [name, show, height, gap, metrics] of [
      [
        'english',
        l.logoEnglishVisible,
        l.logoEnglishHeight,
        l.logoEnglishGap,
        [[390, 72], [437, 74], 74],
      ],
      [
        'chinese',
        l.logoChineseVisible,
        l.logoChineseHeight,
        l.logoChineseGap,
        [[175, 82], [178, 79.5], 82],
      ],
    ]) {
      const group = lock.querySelector('.' + name);
      if (!group) continue;
      group.classList.toggle('scene-part-hidden', !show);
      group.dataset.logoMode = text ? 'text' : 'artwork';
      Object.assign(group.style, {
        gap: gap + 'px',
        height: height + 'px',
        flex: 'none',
        order: l.logoOrder === name ? '0' : '2',
      });
      group
        .querySelectorAll('svg')
        .forEach((svg, i) =>
          Object.assign(svg.style, {
            width: (metrics[i][0] * height) / metrics[2] + 'px',
            height: (metrics[i][1] * height) / metrics[2] + 'px',
          }),
        );
      syncWords(group, l, name);
    }
    const divider = lock.querySelector('.logo-divider');
    divider.classList.toggle('scene-part-hidden', !m.divider);
    Object.assign(divider.style, {
      order: '1',
      width: (vertical ? m.dividerLength : l.logoDividerWidth) + 'px',
      height: (vertical ? l.logoDividerWidth : m.dividerLength) + 'px',
    });
    el.querySelector('.logo-signal')?.classList.toggle('scene-part-hidden', !l.logoSignalVisible);
    el.dataset.logoContentWidth = m.w.toFixed(2);
    el.dataset.logoContentHeight = m.h.toFixed(2);
    const describe = (show, name) =>
      !show
        ? ''
        : text
          ? logoWords(name === 'chinese' ? l.logoChineseText : l.logoEnglishText).join(' ')
          : name === 'chinese'
            ? '控制 共振'
            : 'CONTROL RESONANT';
    el.setAttribute(
      'aria-label',
      [describe(l.logoEnglishVisible, 'english'), describe(l.logoChineseVisible, 'chinese')]
        .filter(Boolean)
        .join(' · ') || 'Logo 已隐藏',
    );
  }
  function apply(el, l) {
    if (!schema[l.type]) return;
    if (l.type === 'logos') {
      applyLogos(el, l);
      return;
    }
    const get = (s) =>
        el.querySelector(s[0] === '#' ? '[data-native-id="' + s.slice(1) + '"]' : s) ||
        el.querySelector(s),
      show = (s, on) => get(s)?.classList.toggle('scene-part-hidden', !on),
      style = (s, key, value) => {
        const e = get(s);
        if (e) e.style[key] = value;
      },
      size = (v) => (v > 0 ? v + 'px' : '');
    // Freeze the imported native text unit; resizing the container must not
    // silently alter inherited font or icon sizes through legacy layout CSS.
    el.style.setProperty(
      isHeader(l.type) ? '--custom-header-scale' : '--custom-timer-scale',
      l.hudScale,
    );
    if (isHeader(l.type)) {
      for (const [s, k] of [
        ['#hostText', 'headerHostVisible'],
        ['#topicText', 'headerTopicVisible'],
        ['.on-air', 'headerStatusVisible'],
        ['.header-triangle', 'headerMarkVisible'],
        ['.header-rule', 'headerRuleVisible'],
      ])
        show(s, l[k]);
      show(
        '.header-separator',
        l.headerDividerVisible && l.headerHostVisible && l.headerTopicVisible,
      );
      for (const [s, key] of [
        ['#hostText', 'headerHostSize'],
        ['#topicText', 'headerTopicSize'],
        ['.on-air', 'headerStatusSize'],
      ]) {
        style(s, 'fontSize', size(l[key]));
        style(s, 'lineHeight', l[key] > 0 ? '1.3' : '');
        style(s, 'fontWeight', l.headerWeight > 0 ? String(l.headerWeight) : '');
      }
      el.style.gap = (l.headerGap ?? 0) + 'px';
      el.style.flexWrap = l.headerWrap ? 'wrap' : 'nowrap';
      el.style.alignContent = 'center';
      style('#topicText', 'maxWidth', size(l.headerTopicWidth));
      style('#topicText', 'paddingLeft', (l.headerTopicPadding ?? 0) + 'px');
      style('#topicText', 'paddingRight', (l.headerTopicPadding ?? 0) + 'px');
    } else {
      const label = get(':scope>span'),
        clock = get('svg');
      if (label) {
        label.classList.toggle('scene-part-hidden', !l.timerLabelVisible);
        if (label.textContent !== l.timerLabelText) label.textContent = l.timerLabelText;
        label.style.fontSize = size(l.timerLabelSize);
        label.style.fontWeight = l.timerWeight > 0 ? String(l.timerWeight) : '';
        label.style.whiteSpace = 'nowrap';
      }
      show('svg', l.timerIconVisible);
      if (clock) {
        clock.style.width = size(l.timerIconSize);
        clock.style.height = size(l.timerIconSize);
        clock.style.flexShrink = '0';
      }
      style('time', 'fontSize', size(l.timerDigitsSize));
      style('time', 'fontWeight', l.timerWeight > 0 ? String(l.timerWeight) : '');
      style('time', 'whiteSpace', 'nowrap');
      el.style.gap = l.timerGap + 'px';
      el.style.flexDirection = l.timerDirection;
      const align = { left: 'flex-start', center: 'center', right: 'flex-end' }[l.timerAlign];
      el.style.justifyContent = l.timerDirection === 'row' ? align : 'center';
      el.style.alignItems = l.timerDirection === 'row' ? 'center' : align;
    }
  }
  const api = { schema, fields, normalize, apply, logoMetrics, logoWords, isHeader };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ThemeSceneComponents = api;
})(globalThis);
