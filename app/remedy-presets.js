// Code MIT. Game-localized titles remain with their original rights holders.
(function(root){
  'use strict';
  const entries=Object.freeze([
    {id:'rhine-archive',kind:'localized-ui',label:'档案原文 · 观测记录',body:'欢迎来到莱茵生命资料库'},
    {id:'sample-07',kind:'localized-ui',label:'档案原文 · 观测记录',body:'第 7 号样本 · 观测记录'},
    {id:'originium-study',kind:'localized-ui',label:'档案原文 · 观测记录',body:'源石技艺研究申请'},
    {id:'ecology-report',kind:'localized-ui',label:'档案原文 · 观测记录',body:'生态科例行报告'},
    {id:'observation-point',kind:'fan-message',label:'日常弹幕 · 莱茵生命',body:'先去观测点，再继续读取样本。'},
    {id:'sample-react',kind:'fan-message',label:'日常弹幕 · 莱茵生命',body:'样本反应增强了，注意防护。'},
    {id:'anomaly',kind:'fan-message',label:'日常弹幕 · 莱茵生命',body:'检测到异常样本，先保持距离。'},
    {id:'uplink',kind:'fan-message',label:'日常弹幕 · 莱茵生命',body:'通讯链路接通了，能听到吗？'},
  ].map(Object.freeze));
  const api={entries,names:Object.freeze(['生态科实习生','结构科值班员','档案管理员','莱茵生命前台','生命科学部'])};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {
    root.RemedyPresets=api;
    function attach(){
      const target=document.getElementById('testBody')||document.getElementById('message');
      if(!target)return;
      const select=document.createElement('select');select.setAttribute('aria-label','中文预设弹幕');select.title='游戏汉化原文与日常弹幕分开标注；不会改写已有输入。';
      const placeholder=new Option('选择中文预设…','');select.add(placeholder);
      for(const kind of ['localized-ui','fan-message']){
        const group=document.createElement('optgroup');group.label=entries.find(e=>e.kind===kind).label;
        for(const entry of entries.filter(e=>e.kind===kind))group.append(new Option(entry.body,entry.id));
        select.append(group);
      }
      select.style.maxWidth='230px';select.style.minWidth='120px';
      select.addEventListener('change',()=>{const entry=entries.find(e=>e.id===select.value);if(entry){target.value=entry.body;target.dispatchEvent(new Event('input',{bubbles:true}));}select.value='';});
      (target.id==='testBody'?target:target.parentElement).insertAdjacentElement('afterend',select);
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach);else attach();
  }
})(globalThis);
