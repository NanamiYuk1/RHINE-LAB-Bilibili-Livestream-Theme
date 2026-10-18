/* ==========================================================================
   RHINE LAB LIVE UI — 弹幕 / SC / 礼物 / 上舰 消息模型与示例库
   ========================================================================== */
(function () {
  'use strict';

  var seq = 0;

  function uid() {
    seq += 1;
    return 'm' + seq + '-' + Date.now().toString(36);
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function rand(min, max) {
    return Math.min(max, Math.max(min, Math.round(min + Math.random() * (max - min))));
  }

  var USERS = [
    '博士的理智',
    '实验体07',
    '哥伦比亚留学生',
    '天灾信使',
    '伊芙利特的糖',
    '麦哲伦的企鹅',
    '星极的占卜',
    '塞雷娅的报告',
    '白面鸮的机房',
    '帕尔维斯的咖啡',
    '梅尔的机械臂',
    '多萝西的沙漏',
    '企鹅物流',
    '整合运动前员工',
    '泰拉小报',
    '源石技艺初学者',
    '深海猎人',
    '干员宿舍管理员',
    '无人机的螺旋桨',
    '莱茵生命前台',
    '生态科实习生',
    '结构科的图纸',
    '生命科学部',
    '源石技艺科',
    '防卫科值班员',
    '档案管理员',
    '多萝西的试管',
    '赫默的羽毛笔',
    '梅尔的水獭',
    '缪尔赛思的助理'
  ];

  var TEXTS = [
    '研究员今天做哪组实验？',
    '这波部署再快一点就好了。',
    '实验数据出来了没？',
    '无菌操作，记得戴手套。',
    '样本送检了吗？',
    '数据链路稳定，继续观察。',
    '这关的无人机也太多了吧。',
    '干员信赖满了没？',
    '这个轴太稳了，抄了。',
    '前方高能，注意费用。',
    '实验室的咖啡机又坏了。',
    '这波要是漏怪就丢人了。',
    '背景音乐是什么？好听。',
    '新皮肤什么时候上架啊。',
    '刚刚那下闪避，离谱。',
    '报告，第 7 号样本有反应。',
    '这图我打了二十遍才过。',
    '博士的操作，比源石还硬。',
    '别慌，先下先锋。',
    '这关的 BOSS 压迫感好强。',
    '可以，这很泰拉。',
    '刚进来，请问在打什么？',
    '后台在放什么歌？',
    '今天的理智花得值。',
    '缪尔赛思主任来了吗？',
    '有没有人知道这个干员怎么练？',
    '源石浓度超标了（指直播间热度）。',
    '上号上号，一起打。',
    '这波撤退时机绝了。',
    '研究员，该下班了。',
    '这关的路线我还没背下来。',
    '卡费了卡费了，救命。',
    '刚刚那个技能时机绝了。',
    '红豆泥？这也太强了。',
    '请求资料库支援。',
    '这局的部署位好紧张。',
    '打完这关就去睡。'
  ];

  var SC_TEXTS = [
    '这波操作值一个大月卡，继续！',
    '研究员辛苦了，给实验室添台咖啡机。',
    '第一次来，这直播间氛围真好。',
    '求个好友位，ID 在主页。',
    '今天也要好好休息，别熬夜。',
    '这关打得太漂亮了，学到了。',
    '给伊芙利特加个糖。',
    '明天还播吗？蹲一个。',
    '理智不够就早点睡，明天再战。',
    '样本讲解得很清楚，感谢。'
  ];

  var GIFTS = [
    { name: '至纯源石', value: 648, icon: 'originium' },
    { name: '合成玉', value: 60, icon: 'jade' },
    { name: '龙门币', value: 12, icon: 'coin' },
    { name: '赤金', value: 45, icon: 'gold' },
    { name: '招聘许可', value: 88, icon: 'ticket' },
    { name: '应急理智顶液', value: 99, icon: 'potion' },
    { name: '实验耗材箱', value: 128, icon: 'chip' },
    { name: '无菌培养基', value: 32, icon: 'book' }
  ];

  var SC_TIERS = [30, 50, 100, 500, 1000, 2000];

  var FLEET_RANKS = [
    { id: 'captain', label: '舰长', en: 'CAPTAIN', price: 198 },
    { id: 'admiral', label: '提督', en: 'ADMIRAL', price: 1998 },
    { id: 'governor', label: '总督', en: 'GOVERNOR', price: 19998 }
  ];

  function makeNormal(options) {
    options = options || {};
    return {
      id: uid(),
      kind: 'normal',
      user: options.user || pick(USERS),
      text: options.text || pick(TEXTS),
      badge: options.badge || '',
      ts: Date.now()
    };
  }

  function makeSC(options) {
    options = options || {};
    var amount = Number(options.amount) || pick(SC_TIERS);
    return {
      id: uid(),
      kind: 'sc',
      user: options.user || pick(USERS),
      text: options.text || pick(SC_TEXTS),
      amount: amount,
      duration: Number(options.duration) || 180,
      ts: Date.now()
    };
  }

  function makeGift(options) {
    options = options || {};
    var gift = options.gift || pick(GIFTS);
    var count = Number(options.count) || rand(1, 20);
    return {
      id: uid(),
      kind: 'gift',
      user: options.user || pick(USERS),
      name: gift.name,
      value: Number(options.value) || gift.value * count,
      count: count,
      ts: Date.now()
    };
  }

  function makeFleet(options) {
    options = options || {};
    var rank = options.rank || pick(FLEET_RANKS);
    return {
      id: uid(),
      kind: 'fleet',
      user: options.user || pick(USERS),
      rank: rank.id,
      rankLabel: rank.label,
      rankEn: rank.en,
      price: rank.price,
      ts: Date.now()
    };
  }

  function makeSystem(text) {
    return { id: uid(), kind: 'system', text: text, ts: Date.now() };
  }

  function random() {
    var roll = Math.random();
    if (roll < 0.7) return makeNormal();
    if (roll < 0.82) return makeGift();
    if (roll < 0.91) return makeSC();
    return makeFleet();
  }

  function seed() {
    var now = Date.now();
    var rows = [
      {
        kind: 'system',
        text: 'OBSERVATION LINK ESTABLISHED · 观测链路已建立',
        offset: 11 * 60
      },
      {
        kind: 'normal',
        user: '生态科实习生',
        text: '晚上好，研究员今天做哪组实验？',
        offset: 10 * 60
      },
      {
        kind: 'normal',
        user: '赫默的羽毛笔',
        text: '前排！今天也要稳稳通关。',
        offset: 9 * 60
      },
      {
        kind: 'gift',
        user: '梅尔的水獭',
        name: '至纯源石',
        count: 3,
        value: 1944,
        offset: 7 * 60
      },
      {
        kind: 'normal',
        user: '缪尔赛思的助理',
        text: '这个部署顺序好舒服，学到了。',
        offset: 6 * 60
      },
      {
        kind: 'sc',
        user: '结构科的图纸',
        text: '这波操作值一个大月卡，继续！',
        amount: 100,
        duration: 180,
        offset: 4 * 60
      },
      {
        kind: 'fleet',
        user: '深海猎人',
        rank: 'captain',
        rankLabel: '舰长',
        rankEn: 'CAPTAIN',
        price: 198,
        offset: 3 * 60
      },
      {
        kind: 'normal',
        user: '莱茵生命前台',
        text: '资料库，报告当前实验进度。',
        badge: '舰长',
        offset: 2 * 60
      },
      {
        kind: 'normal',
        user: '防卫科值班员',
        text: '刚刚那下撤退时机绝了。',
        offset: 50
      },
      {
        kind: 'normal',
        user: '档案管理员',
        text: '蹲一个通关，今晚能过吗？',
        offset: 18
      }
    ];
    return rows.map(function (row) {
      var base = {
        id: uid(),
        kind: row.kind,
        ts: now - row.offset * 1000
      };
      if (row.kind === 'system') base.text = row.text;
      if (row.kind === 'normal') {
        base.user = row.user;
        base.text = row.text;
        base.badge = row.badge || '';
      }
      if (row.kind === 'sc') {
        base.user = row.user;
        base.text = row.text;
        base.amount = row.amount;
        base.duration = row.duration;
      }
      if (row.kind === 'gift') {
        base.user = row.user;
        base.name = row.name;
        base.count = row.count;
        base.value = row.value;
      }
      if (row.kind === 'fleet') {
        base.user = row.user;
        base.rank = row.rank;
        base.rankLabel = row.rankLabel;
        base.rankEn = row.rankEn;
        base.price = row.price;
      }
      return base;
    });
  }

  window.RhineMessages = {
    uid: uid,
    users: USERS,
    texts: TEXTS,
    scTexts: SC_TEXTS,
    gifts: GIFTS,
    scTiers: SC_TIERS,
    ranks: FLEET_RANKS,
    makeNormal: makeNormal,
    makeSC: makeSC,
    makeGift: makeGift,
    makeFleet: makeFleet,
    makeSystem: makeSystem,
    random: random,
    seed: seed
  };
})();
