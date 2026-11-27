---
name: earth-online-playtest
description: 验收地球 Online 的战报、练习历史与逐站对照、原文检索、摘录与辨典挑战。在调整远征回放、阅读交互或离线版本时使用。
---

# 地球 Online 游玩验收

从仓库根运行 `npm ci` 和 `npm run build`。浏览器测试读取 `outputs/` 中玩家实际打开的 HTML。使用已安装的 Chrome 时可设置 `PLAYWRIGHT_CHANNEL=chrome`；使用 Playwright Chromium 时运行 `npx playwright install chromium`。

先按改动写出玩家要完成的动作、进入页面时的存档状态，以及最终可在页面上观察到的结果。用与发送方隔离的浏览器上下文模拟接收方。跑对应的脚本，再手动探索自动用例未覆盖的一条相邻路径。

| 流程 | 入口 | 检查重点 |
| --- | --- | --- |
| 战报与扫码 | `npm run test:sharing` | 从结算生成真实回放，另一位玩家逐站查看再关闭。比对接收方原有的进行中存档；随后单独验证主动挑战。用独立解码器读取呈现的二维码和导出图片，对照实际分享链接。 |
| 原文定位 | `npm run test:occurrence` | 用在同一章反复出现的词检索，从首个命中走到下一个，再反向返回。核对当前标记对应的原文、所在章节及滚动可见性，并在手册与独立全书上分别操作。 |
| 从回放接手 | `npm run test:practice` | 接收方先有进行中的远征，再从朋友战报的中间站开始练习。选择不同路线、走到结局并退出。比对原回放站点及接收方正式存档。 |
| 保存原文摘录 | `npm run test:clippings` | 在同章保存两段原文，与旧章节书签一并导出后恢复。从手册和独立全书进入摘录，对照高亮原句。用重复语句检查前后文，无法确定位置时核对界面提示。 |
| 多词与键盘 | `npm run test:search`、`npm run test:a11y` | 测试简繁查询、多个词同章及键盘焦点。使用窄屏，并在断网的 `file://` 页面验证本地交互。 |
| 练习逐站对照 | `npm run test:compare` | 从已知行动记录选一站改走支线。核对默认显示的分歧站、两边的选择及站末资源，再到其中一方已经归营的站。用键盘返回原回放，比较进入前后的正式存档。 |
| Markdown 摘录 | `npm run test:quote-export` | 准备两本书的摘录和普通书签。执行筛选并点击导出，从浏览器实际下载的文件字节解析 CommonMark；核对书名、章名、完整引文和条数，再检查无匹配时的反馈。 |
| 练习历史 | `npm run test:history` | 在不同阶段撤销、重做，至少一次从结局回退。核对原路重做时的资源和结局。改选后确认旧未来无法再做。退出并比较正式存档。 |
| 辨典挑战 | `npm run test:recall` | 从没有摘录的游戏首页打开挑战，再用另一份有普通书签与摘录的档案按筛选出题。揭晓之前不能读到答案。标记一条再练，核对下一轮只出现留下的原句，退出后核对阅读记录。 |

改动涉及共享引擎或保存逻辑时，运行 `npm test`。若浏览器验收失败，保留输入、界面状态和失败断言，核对成品是否重建，再判断是选择器失效还是玩家操作被打断。反馈中区分已在本机验证和已在公网验证的结果。

改动涉及路线重演或文本锚点时，运行 `npm run test:properties`。用正向游戏过程记录的入站状态校验回放重建，用已知文本偏移校验引文定位。失败后将 fast-check 输出的种子和收缩路径填入 `FC_SEED`、`FC_PATH`，并把 `FC_CASE` 设为失败的用例名再运行。工具与设计来源见[项目评估](../../../outputs/github-review-v2.5.html)。

浏览器验收采用 Playwright Test Planner 的场景规划方法及 webapp-testing 的浏览器侦察方法。[Playwright Test Agents](https://github.com/microsoft/playwright/blob/main/docs/src/test-agents-js.md) · [webapp-testing](https://github.com/anthropics/skills/tree/main/skills/webapp-testing)

对照与导出用例采用“准备、操作、断言”的结构。让断言读取玩家看到的字段或拿到的文件，为每个流程保留一个结果容易被算错的反例。[JavaScript Testing Patterns 固定来源](https://github.com/wshobson/agents/blob/c96b5f6552dba32e4492307493ee613581430715/plugins/javascript-typescript/skills/javascript-testing-patterns/SKILL.md)

练习历史的模型用两摞独立记录预测每次操作之后的状态。对照当前值、可否撤销和可否重做。若生成的序列失败，把 fast-check 输出的种子与收缩路径填入 `FC_SEED` 与 `FC_PATH`，把命令序列的 replayPath 填入 `FC_COMMAND_PATH`，再执行 `node work/qa-history-model.cjs` 重现。[本轮来源与采用方式](../../../outputs/github-review-v2.7.html)
