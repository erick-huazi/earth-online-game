# 来源与材料说明

本仓库包含原创游戏与阅读器代码，以及来自不同来源的典籍文字、扫描件和整理材料。公开可访问不表示所有材料都使用同一许可；本项目未为全部内容统一授予 MIT 或其他开源许可。

- 每本书的来源链接、原件、SHA-256 与转换说明保留在 `outputs/books/`、`outputs/books/download-catalog.json` 和阅读页中；书目入口还可查阅 `work/books.json`。
- 古籍原文与现代整理、注释、版式和扫描版本需分别看待。本项目未完成逐项权利状态核验，不能把收录视为再分发授权声明。
- 四柱八字、五运六气使用相关原典匹配，不能据此确定图片中的具体著作或版本。OCR 和补文情况见各书版本说明。
- 搜索使用从 OpenCC 派生的字符匹配表（Apache-2.0）。完整上游作者、许可及修改说明见 [`outputs/第三方许可-检索字表.txt`](outputs/第三方许可-检索字表.txt)，固定提交与哈希见 [`outputs/search-normalization-sources.json`](outputs/search-normalization-sources.json)。对应字表及许可副本保存在 `work/search-data/`。
- Playwright 是可选的开发测试依赖，通过 npm 安装，不内嵌在可玩的 HTML 中。

山河远征 v2 实际内嵌以下三个固定版本的浏览器代码，均随完整离线包分发：

| 库 | 版本 / 许可 | 固定 GitHub 提交 | 使用范围 |
| --- | --- | --- | --- |
| [seedrandom](https://github.com/davidbau/seedrandom) | 3.0.5 / MIT | `4460ad325a0a15273a211e509f03ae0beb99511a` | 局部确定性随机与行动回放；不改写全局 `Math.random` |
| [lz-string](https://github.com/pieroxy/lz-string) | 1.5.0 / MIT | `4a94308c1e684fb98866f7ba1288f3db6d9f8801` | 开局种子与角色口令；压缩不等于加密或防作弊 |
| [canvas-confetti](https://github.com/catdad/canvas-confetti) | 1.9.4 / ISC | `5f77cdeb0b9f6b69558e8369c63071fc9415f842` | 成功结局短暂庆祝；减少动态偏好时关闭 |

完整许可、版权声明及固定来源见 [`outputs/game-third-party-notices.txt`](outputs/game-third-party-notices.txt)。逐文件来源、字节数和 SHA-256 见 [`work/vendor/manifest.json`](work/vendor/manifest.json)。seedrandom 的许可从原始源码完整许可头提取，另保留未压缩原始源码；lz-string 按本次实际采用的 1.5.0 LICENSE 核验；canvas-confetti 采用官方 npm 浏览器构建，其压缩包 SHA-512 已核验，包中 `gitHead` 与固定 GitHub 提交一致。采用文件保持上游内容，构建时内嵌页面；运行时不访问 CDN。

研究参考项目另有 inkjs、boardgame.io、A Dark Room、Phaser 与 PixiJS。前三者用于参考叙事、回合状态或探索资源的设计方式，后两者为未来候选；本轮没有复制它们的代码、故事或素材，也没有引入其运行时。尤其 A Dark Room 使用 MPL-2.0，不能把该项目代码视为 MIT。完整取舍见 [`outputs/game-research-v2.html`](outputs/game-research-v2.html)。

以上 MIT/ISC 许可只适用于对应库，不覆盖本仓库的书籍、扫描件、检索字表或所有原创代码。

发现来源、转换或权利信息问题时，可在本仓库提交 Issue，注明材料名称和具体位置，以便核对和修正。

## v2.3 检索与验收

多词同章检索采用 MiniSearch v7.2.0 的 BM25+ 单词相关度公式，配合现有中文归一化与章节跳转。移植部分随手册保留上游 MIT 版权及许可。[MiniSearch 源码](https://github.com/lucaong/minisearch/blob/v7.2.0/src/MiniSearch.ts)

可访问性回归在开发环境使用锁定的 axe-core 4.14.1（MPL-2.0）。游戏中的逐站推演使用本项目的远征规则重算，参考了 boardgame.io 对历史局面与正式存档的处理。[axe-core](https://github.com/dequelabs/axe-core) · [boardgame.io 客户端](https://github.com/boardgameio/boardgame.io/blob/main/docs/documentation/api/Client.md)

## v2.4 二维码与回放

分享二维码使用 qrcode-generator 2.0.4。构建时校验上游 JavaScript 的 SHA-256，且将完整 MIT 许可随离线包分发。jsQR 1.4.0 是开发依赖，用于解码测试中生成的 PNG。[编码器固定源码](https://github.com/kazuhikoarase/qrcode-generator/blob/83b7e8fe3fddd3b0368dbafd6ce56995bd25e3c8/js/dist/qrcode.js) · [解码器](https://github.com/cozmo/jsQR)

## v2.5 属性测试

fast-check 4.11.0（MIT）及其间接依赖 pure-rand 用于开发和持续集成。生成测试覆盖可重现的分叉与原文锚定；版本和 npm 完整性值见 package-lock.json。[固定上游源码](https://github.com/dubzzz/fast-check/tree/60d68efc639aba994f489bd0dedeceba2be4cf51)

## v2.6 摘录导出验收

开发与 CI 使用 commonmark 0.31.2 解析实际下载的 Markdown，校验章节和引文结构。依赖及完整性值见 package-lock.json。[CommonMark.js 固定源码](https://github.com/commonmark/commonmark.js/tree/cb2c2303d3550ec6ef28ceb2841f148e8761eebf) · [上游许可证](https://github.com/commonmark/commonmark.js/blob/cb2c2303d3550ec6ef28ceb2841f148e8761eebf/LICENSE)
