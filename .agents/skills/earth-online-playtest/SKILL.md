---
name: earth-online-playtest
description: 验收地球 Online 的远征战报分享、中文原文命中导航及离线兼容性；在这些流程发生变化时使用。
---

# 地球 Online 游玩验收

从仓库根运行 `npm ci` 和 `npm run build`。浏览器测试读取 `outputs/` 中玩家实际打开的 HTML。使用已安装的 Chrome 时可设置 `PLAYWRIGHT_CHANNEL=chrome`；使用 Playwright Chromium 时运行 `npx playwright install chromium`。

先按改动写出玩家要完成的动作、进入页面时的存档状态，以及最终可在页面上观察到的结果。用与发送方隔离的浏览器上下文模拟接收方。跑对应的脚本，再手动探索自动用例未覆盖的一条相邻路径。

| 流程 | 入口 | 检查重点 |
| --- | --- | --- |
| 战报与扫码 | `npm run test:sharing` | 从结算生成真实回放，另一位玩家逐站查看再关闭。比对接收方原有的进行中存档；随后单独验证主动挑战。用独立解码器读取呈现的二维码和导出图片，对照实际分享链接。 |
| 原文定位 | `npm run test:occurrence` | 用在同一章反复出现的词检索，从首个命中走到下一个，再反向返回。核对当前标记对应的原文、所在章节及滚动可见性，并在手册与独立全书上分别操作。 |
| 多词与键盘 | `npm run test:search`、`npm run test:a11y` | 测试简繁查询、多个词同章及键盘焦点。使用窄屏，并在断网的 `file://` 页面验证本地交互。 |

改动涉及共享引擎或保存逻辑时，运行 `npm test`。若浏览器验收失败，保留输入、界面状态和失败断言，核对成品是否重建，再判断是选择器失效还是玩家操作被打断。反馈中区分已在本机验证和已在公网验证的结果。

此流程采用 Playwright Test Planner 的场景规划方法及 webapp-testing 的浏览器侦察方法。[Playwright Test Agents](https://github.com/microsoft/playwright/blob/main/docs/src/test-agents-js.md) · [webapp-testing](https://github.com/anthropics/skills/tree/main/skills/webapp-testing)
