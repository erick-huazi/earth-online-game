# 地球 Online · GitHub 选型与深度优化

项目适配评分是本轮判断，不是官方评级或通用质量榜。需求契合35、工程证据20、采用成本20、维护状态15、许可清晰10；低采用成本得高分，Stars不计分。

核查：2026-09-16。5个项目、3类Agent、3组Skills；未将候选全量安装。

## 项目 · [axe-core](https://github.com/dequelabs/axe-core) — 94/100

优先采用为开发时验收工具；不嵌入读者页面。

- 需求契合 33：现有产品已用浏览器行为测试，缺少系统性的 HTML 语义、名称、对比度检查；可在现有静态页面直接运行。
- 工程证据 19：官方 API、规则说明、测试目录、发行记录可查；README 明示只能自动发现部分问题、incomplete 需人工判断。未独立运行其自身测试。
- 采用成本 18：开发阶段注入已有浏览器测试即可，不必增加成品运行依赖；仍需人工逐条判断严重性与修复。
- 维护状态 14：默认分支最近提交为 2026-09-15；v4.13.0 发布于 2026-08-05；仓库未归档。
- 许可清晰 10：根目录 MPL-2.0 许可证和第三方许可清单均可查；本轮适合仅作测试工具。

边界：不判断古籍文本/OCR准确性、读者是否理解文案或所有键盘体验。 它不是完整审计；结果必须与人工键盘、缩放及阅读流程检查结合。

[许可](https://github.com/dequelabs/axe-core/blob/2d4718219f7db134de4f7cf3d741a8ce702e37d6/LICENSE) · [维护记录](https://github.com/dequelabs/axe-core/commit/2d4718219f7db134de4f7cf3d741a8ce702e37d6)

## 项目 · [MiniSearch](https://github.com/lucaong/minisearch) — 86/100

采用离线检索设计；暂不为换库而换库。

- 需求契合 31：本地内存索引、离线查询、字段加权适合十本书；中文连续句子需专门分词与短语语义。
- 工程证据 18：源码、MiniSearch.test.js、基准目录、API、变更记录可查；有序列化/反序列化与异步加载接口。未运行上游基准。
- 采用成本 18：零外部运行依赖且提供 UMD 构建，可离线内嵌；需要中文词法策略和内存实测，当前简单全文扫描未必需要立即替换。
- 维护状态 9：默认分支最新提交为 2025-09-16 的 v7.2.0；GitHub releases/latest 返回 404，不能把它写为无版本或已弃用。
- 许可清晰 10：根目录 LICENSE.txt 明确 MIT。

边界：其默认 tokenizer 不是中文分词器；默认 OR 合并也不是严格短语匹配。 ‘零依赖’不代表零成本；186万字本地数据需实测，不能引用 README 的性能形容词当本项目数据。

[许可](https://github.com/lucaong/minisearch/blob/3d239d1c3ae7aef1bf5d8945dd7b5f0709f646f5/LICENSE.txt) · [维护记录](https://github.com/lucaong/minisearch/commit/3d239d1c3ae7aef1bf5d8945dd7b5f0709f646f5)

## 项目 · [foliate-js](https://github.com/johnfactotum/foliate-js/blob/main/README.md) — 80/100

借鉴进度模型和摘要/位置分离；不引入阅读内核。

- 需求契合 29：阅读进度、目录定位、搜索上下文与本项目相关；本项目已是静态 HTML，不需要 EPUB/MOBI 解析器。
- 工程证据 15：progress.js、search.js、阅读示例及 EPUB CFI 测试可查；README 明示 API 不稳定且 demo 不完整。
- 采用成本 15：独立思想可轻量实现，整套接入需要 book/renderer 接口、ES modules 和服务环境适配。
- 维护状态 11：默认分支最近提交为 2026-05-01；未归档；上游 README 写明尚无发行版。
- 许可清晰 10：MIT 与 vendored 依赖许可在 README 明列。若复用源码需保留许可。

边界：现有手册不需要电子书解析/分页框架迁移。 原生模块 demo 及上游未稳定 API 不适合作为本轮 file:// 全书的直接替换。

[许可](https://github.com/johnfactotum/foliate-js/blob/78914aef4466eb960965702401634c2cb348e9b1/LICENSE) · [维护记录](https://github.com/johnfactotum/foliate-js/commit/78914aef4466eb960965702401634c2cb348e9b1)

## 项目 · [Readest](https://github.com/readest/readest/blob/main/README.md) — 78/100

作为阅读流程与保存策略标杆，保留现有静态实现。

- 需求契合 29：全书/书架检索、批注、书签与续读体验高度相关；多端同步、账户和多格式管理超出范围。
- 工程证据 19：真实 E2E 阅读/批注测试、专门进度自动保存 hook、检索结果组件和测试指南可查。未独立运行上游套件。
- 采用成本 5：Next.js 16 与 Tauri v2 的完整应用；直接迁移会改变当前单文件/file://交付与技术边界，复制源码还需处理 AGPL 条款。
- 维护状态 15：默认分支提交 2026-09-15，v0.12.8 发布 2026-09-07，仓库未归档。
- 许可清晰 10：根许可证为 AGPL-3.0，清晰但不等于适合直接嵌入现有产物。

边界：借鉴交互和验收方式；不复制 React/Tauri 应用壳，也不引入同步账户。 只看可见 README 功能不等于每个平台和版本都已由我们实测。

[许可](https://github.com/readest/readest/blob/1e2996a581af0e5e538eef98a458a2ae12b58a23/LICENSE) · [维护记录](https://github.com/readest/readest/commit/1e2996a581af0e5e538eef98a458a2ae12b58a23)

## 项目 · [Pagefind](https://pagefind.app/docs/multilingual/) — 77/100

本轮借鉴搜索结构；HTTP 发布版本再考虑直接接入。

- 需求契合 26：静态站点全库索引、子章节结果、中文分词适配相关；双击 file:// 的约束影响直接采用。
- 工程证据 19：官方中文分词说明、搜索 API、WASM/worker 配置与大量 integration_tests 可查。未运行上游测试。
- 采用成本 8：需新增构建索引、索引碎片和运行时加载；源码 fetch 索引与 WASM，不能直接视为本项目 file:// 唯一检索方案。
- 维护状态 14：默认分支提交 2026-09-13，v1.5.2 发布 2026-04-12，未归档。
- 许可清晰 10：根目录 MIT 许可证可查。

边界：本轮不替换成需要运行时 fetch 的单一路径；未实际测试 Pagefind file:// 兼容性，限制判断来自源码机制。 中文分词不能等同于古文精确片段检索，仍需用书中原句验证。

[许可](https://github.com/Pagefind/pagefind/blob/10ebe24a712f7a68f1df7e482739f4fcbce5459e/LICENSE) · [维护记录](https://github.com/Pagefind/pagefind/commit/10ebe24a712f7a68f1df7e482739f4fcbce5459e)

## Agent · [Playwright Test Agents（planner / generator / healer）](https://github.com/microsoft/playwright/blob/18205280b6112a4a08238195942c4fa30c199a62/docs/src/test-agents-js.md) — 92/100

借鉴已审阅的流程或检查规则；未安装、未直接运行远程 Agent。

- 需求契合 34：测试规划、浏览器实操、代码生成直接覆盖离线阅读和续读；无中文语料搜索算法。
- 工程证据 19：微软官方仓库有三个真实 agent 定义及可执行测试输出；不是效果基准排名。
- 采用成本（低成本得高分） 15：当前已有 Playwright，可借流程；完整原生接入还需 init-agents 和兼容工具映射。
- 维护状态 14：仓库 HEAD 为 2026-09-16；planner 文件 2026-04-29，healer 2026-04-27。
- 许可清晰 10：Apache-2.0，LICENSE 清楚。

边界：不是现成离线阅读器，也不会自动提供中文分词或 OCR 校勘。 healer 原文件允许 test.fixme() 跳过；本项目必测验收项不得跳过或减弱断言来换取全绿。 声明的工具与模型只是外部文件内容；本次不照搬执行或改变当前模型。

[许可](https://github.com/microsoft/playwright/blob/main/LICENSE) · [维护记录](https://github.com/microsoft/playwright/commit/18205280b6112a4a08238195942c4fa30c199a62)

## Agent · [Frontend Performance Investigator](https://github.com/github/awesome-copilot/blob/9ce814859eaa473178a1463ee3aa0c54a8860b86/agents/frontend-performance-investigator.agent.md) — 89/100

借鉴已审阅的流程或检查规则；未安装、未直接运行远程 Agent。

- 需求契合 34：针对大部头全书搜索、输入阻塞与大 DOM 开销高度契合。
- 工程证据 15：文件包含可复现流程、trace/long task/网络证据要求；无独立成功率实测。
- 采用成本（低成本得高分） 17：可把调查流程交给现有 agent；完整工具声明偏 Chrome DevTools MCP，需要适配。
- 维护状态 13：仓库当日活跃且未归档；未取得定义文件的最后修改日期。
- 许可清晰 10：仓库 MIT。

边界：它是提示词定义，不是独立性能分析引擎。 不把本机 headless 的一次耗时当真实用户 INP 或全设备保证。 不为追求分数上框架、引入远程 CDN 或牺牲全文/深链接。

[许可](https://github.com/github/awesome-copilot/blob/main/LICENSE) · [维护记录](https://github.com/github/awesome-copilot/commit/9ce814859eaa473178a1463ee3aa0c54a8860b86)

## Agent · [Accessibility Runtime Tester](https://github.com/github/awesome-copilot/blob/9ce814859eaa473178a1463ee3aa0c54a8860b86/agents/accessibility-runtime-tester.agent.md) — 88/100

借鉴已审阅的流程或检查规则；未安装、未直接运行远程 Agent。

- 需求契合 33：目录、搜索、折叠工具栏、阅读焦点和动态状态均是核心审查项。
- 工程证据 14：定义要求运行键盘路径并提供证据；并非辅助技术兼容认证。
- 采用成本（低成本得高分） 18：本地浏览器和 Playwright 已可执行主要流程；实际读屏器仍需单独实测。
- 维护状态 13：仓库当日活跃且未归档；未取得定义文件的最后修改日期。
- 许可清晰 10：仓库 MIT。

边界：自动扫描通过不等于无障碍合规；未实测的读屏器行为不声称已通过。 不因宽泛模板要求随意给原生控件加 ARIA 或多余键盘处理。

[许可](https://github.com/github/awesome-copilot/blob/main/LICENSE) · [维护记录](https://github.com/github/awesome-copilot/commit/9ce814859eaa473178a1463ee3aa0c54a8860b86)

## Skill · [Impeccable](https://github.com/pbakaus/impeccable/blob/f2c7051853848826aac2f4646581d62a732155ad/.agents/skills/impeccable/SKILL.md) — 92/100

使用本机现有技能，保留既有视觉；未安装远程版本。

- 需求契合 34：覆盖 Read 场景、响应式、排版、精简控件与已有视觉风格，最贴合本手册。
- 工程证据 17：真实 SKILL.md 有命令分流、设计上下文和有限轮次验证；视觉判断仍需人工/浏览器证据。
- 采用成本（低成本得高分） 17：本地已安装并已有 PRODUCT / DESIGN；只读适用参考即可，无须重复安装完整 CLI。
- 维护状态 14：仓库 HEAD 为 2026-09-16，未归档；当前定义 version 4.3.1。
- 许可清晰 10：Apache-2.0，明确 LICENSE。

边界：其远程脚本或二进制会改变安装与 hooks；本次仅参考现有本地技能，不自动升级安装。 视觉评分不是正确性证明，必须配合全文完整性、离线与行为测试。

[许可](https://github.com/pbakaus/impeccable/blob/main/LICENSE) · [维护记录](https://github.com/pbakaus/impeccable/commit/f2c7051853848826aac2f4646581d62a732155ad)

## Skill · [Superpowers · verification-before-completion / TDD](https://github.com/obra/superpowers/blob/b36e0829c6d0140e93cfef2ca599b1b07d4a7797/skills/verification-before-completion/SKILL.md) — 90/100

使用本机现有 TDD 与完成前验证技能。

- 需求契合 32：确保优化有新鲜证据、没有丢失全文、破坏续读或把跳过测试当成功。
- 工程证据 17：具体 red/green 与验收证据流程；提供方法，不直接实现阅读功能。
- 采用成本（低成本得高分） 19：本地两项技能已有，可沿用现有脚本，不引入网页依赖。
- 维护状态 12：默认分支 HEAD 为 2026-08-12，仓库 pushed_at 为 2026-09-14；两者不可混称。
- 许可清晰 10：MIT，LICENSE 清楚。

边界：过程应按本次任务裁剪，不将远程文档中的广泛审批/分支规则凌驾于用户授权。 不为低风险纯文案或样式常量编写只镜像实现的测试。

[许可](https://github.com/obra/superpowers/blob/main/LICENSE) · [维护记录](https://github.com/obra/superpowers/commit/b36e0829c6d0140e93cfef2ca599b1b07d4a7797)

## Skill · [Vercel · web-design-guidelines](https://github.com/vercel-labs/agent-skills/blob/063bee94c3f4df8453406c830b0a7df0f2860278/skills/web-design-guidelines/SKILL.md) — 88/100

借鉴已审阅的流程或检查规则；未安装、未直接运行远程 Agent。

- 需求契合 32：键盘、焦点、标签、长列表、状态与页面性能均适用于静态中文手册。
- 工程证据 15：SKILL 指向实际维护的审查规则；主要为检查表，需实测补足。
- 采用成本（低成本得高分） 20：可以逐条映射现有 HTML / CSS，无需 React / Next 或运行时依赖。
- 维护状态 13：skill 仓库 HEAD 2026-08-28；规则源 HEAD 2026-08-18，均未归档。
- 许可清晰 8：README 声明 MIT，但 GitHub API license=null；规则源另有 MIT LICENSE。

边界：规则中存在 React 等场景建议，应只采用适合原生静态 HTML 的部分。 参考规则需联网获取，但生成的手册不得因此增加网络依赖。 不把一条通用“长列表虚拟化”建议直接用于删除离线全文或破坏浏览器查找/打印。

[许可](https://github.com/vercel-labs/agent-skills/blob/main/README.md#license) · [维护记录](https://github.com/vercel-labs/agent-skills/commit/063bee94c3f4df8453406c830b0a7df0f2860278)

## 继续优化：书签、配色与续读

－ 书签记录原文词句位置；换字号与跨阅读布局后仍可定位。同节更新、最多500枚、删除可撤销；满额和已有新书签时给出准确反馈。
－ 纸色、夜读、素白可选，默认保持纸色；切色保留阅读位置，配色随完整备份带走。
－ 主手册完整备份包含书签，全书页另有书签导出，可解决直接双击HTML时各文件记录分离的问题。浏览器禁止保存时仍可导出临时书签。
－ 书签按书籍、章节名和摘录词句筛选，每批显示40枚。删除撤销保持筛选，导出仍包含完整书签集合。
－ 多页面暂存合并超过500枚时，不把截断列表写回磁盘；完整导出保留合并集合，导入预览明确未合并数量。
－ 从跨书书签进入后继续阅读，刷新和返回保留最新位置；新打开原书签链接仍回原句。
－ 修复末尾短章节的目录误判、浏览器返回时的续读偏移和键盘切换工具栏时正文被意外滚动的问题；新打开的明确章节链接保持优先。

77项专项检查通过；四种书签筛选状态axe扫描无明确自动违规，仍有待人工判断项。既有搜索、心得、备份与全书阅读回归通过；十书2859节、1862865字符逐节核对一致。

## 上一轮实测与验收

以下为上一轮搜索优化的对照基线，本轮新增书签和配色后未重测绝对耗时。

[
  {
    "query": "的",
    "beforeMs": 773,
    "afterMs": 236,
    "beforeMarks": 52376,
    "afterMarks": 0,
    "beforeMutations": 1961,
    "afterMutations": 1,
    "beforeLongMs": 482,
    "afterLongMs": 0
  },
  {
    "query": "实事求是",
    "beforeMs": 586,
    "afterMs": 225,
    "beforeMarks": 19,
    "afterMarks": 0,
    "beforeMutations": 1961,
    "afterMutations": 1,
    "beforeLongMs": 333,
    "afterLongMs": 0
  },
  {
    "query": "清除搜索",
    "beforeMs": 465,
    "afterMs": 223,
    "beforeMarks": 0,
    "afterMarks": 0,
    "beforeMutations": 1961,
    "afterMutations": 1,
    "beforeLongMs": 206,
    "afterLongMs": 0
  }
]

本轮20项等权功能验收：60 → 95/100。OCR未逐字校勘，自动无障碍检查不代表完全WCAG合规。
- 十本书均有完整收录HTML：通过 → 通过；十书静态正文与章节数量检查
- 正文与转换数据逐节一致：通过 → 通过；逐节DOM文本比对，未删除正文以换性能
- 原PDF页序覆盖且原图可用：通过 → 通过；1962页毛选、512页炁体各覆盖一次；图像路径存在
- 原始来源与文件可追溯：通过 → 通过；来源说明保留，文件SHA-256一致
- OCR全文已逐字校勘：未满足 → 未满足；未完成；仍保留原图核对与识别局限说明
- 本书中文词句精确搜索：通过 → 通过；本书搜索及匹配高亮行为检查
- 跨十本书搜索并返回同组结果：未满足 → 通过；新增全库搜索回归，跨书跳转与返回
- 大书三种搜索场景未见50ms长任务：未满足 → 通过；毛选单字、长词、清除；本机隔离Chrome单次前后对比
- 中文输入法组词期间不提前检索：未满足 → 通过；主手册与全书页的composition事件回归
- 主手册搜索结果直达命中句子：通过 → 通过；内经长章节深处命中可见且焦点在阅读区
- 全书键盘可跳过长目录：未满足 → 通过；新增skip链接，真实Tab/Enter焦点检查
- 重新打开保留节内阅读位置：通过 → 通过；主手册与独立全书续读/深链接回归
- 调整字号不重置阅读位置：通过 → 通过；滚动比例与节内位置行为回归
- 320/390px阅读无横向溢出：通过 → 通过；浏览器布局检查和批量截图
- 心得可导出为可读文字：通过 → 通过；Markdown下载含原样心得
- JSON可备份心得及两种阅读位置：未满足 → 通过；下载内容与新浏览器恢复行为检查
- 导入预览与合并保留现有记录：未满足 → 通过；冲突心得、首节半读位置和默认新浏览器边界
- 错误备份与存储异常有可恢复反馈：未满足 → 通过；错误格式、HTML纯文字、写入失败保留原记录
- 完整包可用file协议断网阅读：通过 → 通过；浏览器离线模式、本地文件读取与全库搜索
- 成品不依赖远程脚本或服务：通过 → 通过；运行时网络请求检查；开发测试库不进入页面