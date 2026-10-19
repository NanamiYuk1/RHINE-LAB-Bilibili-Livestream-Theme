# 宣传片工程说明（70.4 秒）

成片：`RHINE-LAB-PROMO-1080p60.mp4` → 1920×1080 / 60 fps / H.264 High CRF 22 / AAC 320 kbps 48 kHz 立体声 / 70.4 s / −14.2 LUFS / 真峰值 −0.9 dBFS。

## 结构（112.5 BPM，小节 = 2.1333 s，切点全部落在小节线）

| 时间 | 段落 | 内容 |
| --- | --- | --- |
| 0.00–4.27 | ACT 00 信号 | 冷开场：细线点亮、双环徽记 |
| 4.27–8.53 | — | 标题「莱茵生命 / RHINE LAB / 内部资料档案」 |
| 8.53–34.13 | ACT 01 接入 | **真实软件广播画面**：弹幕 / SC / 礼物 / 上舰实时推送，样本影像，标注「直播画面 · 效果演示」 |
| 34.13–42.67 | 过渡 | 24 个部件图层吸附成完整直播画面 |
| 42.67–51.20 | ACT 02 整理 | **真实主题编辑器**：选中图层、拖动、属性数值联动，标注「主题编辑器 · 效果演示」 |
| 51.20–55.47 | ACT 03 观测 | 三种基础画面（档案库 / 全景 / 研讨台）用三套预设的**真实画布**呈现，带 OBS 采集坐标 |
| 55.47–59.73 | — | 音乐皮肤（真实曲目卡与进度），标注「音乐皮肤 · 效果演示」 |
| 59.73–64.00 | ACT 04 播出 | 下载卡：本仓库、上游项目、原项目演示视频 |
| 64.00–70.40 | — | 滚动致谢与声明，落版 |

## 实现

- **画面**：three.js 逐帧离线渲染（自定义 bloom、ACES、色差、颗粒、暗角），Chrome DevTools 协议逐帧截图后直接管道进 x264。
- **真实界面**：启动本包自带的本地服务（`RhineLab.exe` 以 Node 模式承载 `preview-server.js`），用 CDP 驱动真实页面与真实消息接口；广播画面与编辑器分别录成 361 / 241 帧序列，渲染时按时间播放。
- **声音**：仅用「Rhine Lab.LLC」一首，开头 1.6 s 淡入、结尾 1.8 s 淡出；约 30 个合成音效只落在切点与交互上。
- **可读性**：软件画面置于深色舞台，界面之外另加「效果演示」标签，明确区分“软件界面”与“视频效果”。

## 复现

需要 Windows + Chrome + ffmpeg + Python（numpy / scipy / soundfile / websocket-client / requests）。

```powershell
# 1) 启动本地服务（用本包自带的 Node 运行时）
$env:ELECTRON_RUN_AS_NODE=1
.\RhineLab.exe resources\app\app\preview-server.js

# 2) 录制真实界面、合成音轨、逐帧渲染、混流
python capture_scene.py      # 广播画面 + 消息
python capture_app.py        # 编辑器交互
python audio\build_audio2.py # 70.4 s 音轨
python render_film.py --end 70.4 --crf 22
python finalize.py
```

## 素材与权利

界面截图与录屏来自本软件；字体 Montserrat / Inter / JetBrains Mono（SIL OFL 1.1）与 Noto Sans SC / Noto Serif SC；《明日方舟》角色、标志与音乐版权归上海鹰角网络科技有限公司（Hypergryph）所有；Bilibili、OBS Project 商标归各自权利人。本片为非官方粉丝作品，与上述公司无关联。
