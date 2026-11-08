# 地球 Online · GitHub 玩法融合研究

核查日期：2026-11-08。面向本轮静态、离线、中文短局游戏的编辑判断，不是上游质量排名、性能基准或成功概率；星数仅为检索时背景信息，不计分。

| 项目 | 适配评分 | 决策 |
| --- | --- | --- |
| [seedrandom](https://github.com/davidbau/seedrandom) | 94/100 | 采用 · 同局挑战 |
| [lz-string](https://github.com/pieroxy/lz-string) | 92/100 | 采用 · 挑战码 |
| [inkjs](https://github.com/y-lohse/inkjs) | 87/100 | 借鉴 · 条件叙事 |
| [canvas-confetti](https://github.com/catdad/canvas-confetti) | 86/100 | 采用 · 通关反馈 |
| [A Dark Room](https://github.com/doublespeakgames/adarkroom) | 82/100 | 借鉴 · 探索与消耗 |
| [boardgame.io](https://github.com/boardgameio/boardgame.io) | 75/100 | 借鉴 · 回合状态 |
| [Phaser](https://github.com/phaserjs/phaser) | 74/100 | 暂缓 · 实时玩法引擎 |
| [PixiJS](https://github.com/pixijs/pixijs) | 72/100 | 暂缓 · 大规模渲染 |

评分权重：玩法适配30 / 离线运行20 / 维护与稳定15 / 许可明确15 / 体积与性能适配10 / 接入成本10。

## seedrandom

明确种子可复现随机序列，使每日挑战、好友挑战与重开复盘共用同一套发牌规则。

用局部随机生成器生成事件顺序和遗物候选，固定规则版本；同种子、同角色、同选择得到同一结果。

默认分支最近提交较旧；固定版本并用确定性测试守住兼容性。必须使用 new Math.seedrandom(seed)，避免改写全局 Math.random。

[依据](https://github.com/davidbau/seedrandom/blob/4460ad325a0a15273a211e509f03ae0beb99511a/README.md) · [许可](https://github.com/davidbau/seedrandom/blob/4460ad325a0a15273a211e509f03ae0beb99511a/seedrandom.js) · [固定核查提交](https://github.com/davidbau/seedrandom/commit/4460ad325a0a15273a211e509f03ae0beb99511a)

## lz-string

将有限的挑战配置编码成可复制的短文本，适合静态网页通过链接邀请朋友体验同一局。

只压缩规则版本、种子与开局配置；接收端先限制长度、校验结构，再重建一局。分享不包含心得或个人笔记。

压缩不是加密，也不是防作弊；不以客户端分数冒充可信排行榜。默认分支正向 2.x 迁移，本次固定已核验 MIT 的 1.5.0。

[依据](https://github.com/pieroxy/lz-string/blob/b399c1fa7710c8554cc11c00d67a3edfb25f9022/README.md) · [许可](https://github.com/pieroxy/lz-string/blob/4a94308c1e684fb98866f7ba1288f3db6d9f8801/LICENSE) · [固定核查提交](https://github.com/pieroxy/lz-string/commit/b399c1fa7710c8554cc11c00d67a3edfb25f9022)

## inkjs

面向互动叙事，故事运行时与呈现层分离，支持将故事内容编译为数据后由浏览器解释。

借鉴“状态影响可选分支”的组织方式，把原先找标准答案的题目改成资源代价与情境后果；本轮内容仍为原创数据。

未复制其代码、故事或编译产物，也未接入运行时。当前内容量使用现有数据模型更轻；分支内容扩大后再评估迁移。

[依据](https://github.com/y-lohse/inkjs/blob/fdc440a2c5a69c1fdb1e7d9765490a06d4cd092b/README.md) · [许可](https://github.com/y-lohse/inkjs/blob/fdc440a2c5a69c1fdb1e7d9765490a06d4cd092b/LICENSE.md) · [固定核查提交](https://github.com/y-lohse/inkjs/commit/fdc440a2c5a69c1fdb1e7d9765490a06d4cd092b)

## canvas-confetti

提供浏览器粒子庆祝反馈，并提供尊重减少动态偏好的选项。

仅在完成远征等关键时刻短暂触发；设置 disableForReducedMotion:true，避免持续占用注意力和渲染资源。

视觉反馈不会自动增加策略深度；保留文字结算，不以动效代替结果。使用已校验的官方 npm 浏览器构建，无 CDN 请求。

[依据](https://github.com/catdad/canvas-confetti/blob/20eebad51dde793070c373d594099a7ed8d96e22/README.md) · [许可](https://github.com/catdad/canvas-confetti/blob/20eebad51dde793070c373d594099a7ed8d96e22/LICENSE) · [固定核查提交](https://github.com/catdad/canvas-confetti/commit/20eebad51dde793070c373d594099a7ed8d96e22)

## A Dark Room

极简文字冒险的源码把探索移动与食物、水和生命等资源关联，能在文字界面中建立明确的风险。

借鉴可观察的设计思路：有限补给、事件选择、进入下一站的代价，以及由行动产生的故事。自行编写东方题材的事件与规则。

未复制代码、剧情、音乐或素材；其 MPL-2.0 代码许可需要独立遵守。本轮不引入长时间等待或放置计时。

[依据](https://github.com/doublespeakgames/adarkroom/blob/1fada4620b6c66bd07bf15a3f1eb8223df8bc1d7/script/world.js) · [许可](https://github.com/doublespeakgames/adarkroom/blob/1fada4620b6c66bd07bf15a3f1eb8223df8bc1d7/LICENSE.md) · [固定核查提交](https://github.com/doublespeakgames/adarkroom/commit/1fada4620b6c66bd07bf15a3f1eb8223df8bc1d7)

## boardgame.io

通过描述行动引起的状态变化组织回合制游戏，提供阶段、日志、多人与机器人能力。

借鉴行动→状态→结果的明确边界，把引擎做成可重放、可测试的纯逻辑；本轮不接入网络框架。

当前是单人离线体验，多人匹配与同步不能仅靠引入依赖自动成为本项目已实现功能。要另行设计可信服务端与隐私方案。

[依据](https://github.com/boardgameio/boardgame.io/blob/47adef2b46e375999931209ba7b41e9654c506e1/README.md) · [许可](https://github.com/boardgameio/boardgame.io/blob/47adef2b46e375999931209ba7b41e9654c506e1/LICENSE) · [固定核查提交](https://github.com/boardgameio/boardgame.io/commit/47adef2b46e375999931209ba7b41e9654c506e1)

## Phaser

完整的 HTML5 2D 游戏框架，官方支持桌面与移动浏览器以及 Canvas/WebGL 渲染。

保留为未来加入实时操作、精灵碰撞、场景和音频系统时的候选。

这轮重点是读卡、资源选择与短局复盘。迁移到实时引擎会增加渲染、输入和无障碍适配工作，不能仅为“像游戏”而更换框架。

[依据](https://github.com/phaserjs/phaser/blob/02d8931b626d9764c133cbb3fbf99966c03c757c/README.md) · [许可](https://github.com/phaserjs/phaser/blob/02d8931b626d9764c133cbb3fbf99966c03c757c/LICENSE.md) · [固定核查提交](https://github.com/phaserjs/phaser/commit/02d8931b626d9764c133cbb3fbf99966c03c757c)

## PixiJS

提供 WebGL/WebGPU 渲染、资源加载、触摸交互和图形文字能力。

作为未来地图大量精灵或高密度动画的渲染候选，而非替代规则设计。

本轮 DOM 卡牌与 SVG 地图已有可访问基础。尚无渲染瓶颈实测证据，因此不引入新的渲染层。

[依据](https://github.com/pixijs/pixijs/blob/2ab93d21c9b4f28e3e6f66a9e82ea1e81e771a49/README.md) · [许可](https://github.com/pixijs/pixijs/blob/2ab93d21c9b4f28e3e6f66a9e82ea1e81e771a49/LICENSE) · [固定核查提交](https://github.com/pixijs/pixijs/commit/2ab93d21c9b4f28e3e6f66a9e82ea1e81e771a49)

## 验证边界

三个固定版本依赖已接入远征：seedrandom 用于确定性生成与回放，lz-string 用于种子和角色口令，canvas-confetti 用于成功结局且尊重减少动态偏好。接口测试已通过，完整游戏验收见对应版本验证记录。没有生产留存、传播或收入数据，不保证爆款。
