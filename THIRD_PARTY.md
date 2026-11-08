# 来源与材料说明

本仓库包含原创游戏与阅读器代码，以及来自不同来源的典籍文字、扫描件和整理材料。公开可访问不表示所有材料都使用同一许可；本项目未为全部内容统一授予 MIT 或其他开源许可。

- 每本书的来源链接、原件、SHA-256 与转换说明保留在 `outputs/books/`、`outputs/books/download-catalog.json` 和阅读页中；书目入口还可查阅 `work/books.json`。
- 古籍原文与现代整理、注释、版式和扫描版本需分别看待。本项目未完成逐项权利状态核验，不能把收录视为再分发授权声明。
- 四柱八字、五运六气使用相关原典匹配，不能据此确定图片中的具体著作或版本。OCR 和补文情况见各书版本说明。
- 搜索使用从 OpenCC 派生的字符匹配表（Apache-2.0）。完整上游作者、许可及修改说明见 [`outputs/第三方许可-检索字表.txt`](outputs/第三方许可-检索字表.txt)，固定提交与哈希见 [`outputs/search-normalization-sources.json`](outputs/search-normalization-sources.json)。对应字表及许可副本保存在 `work/search-data/`。
- Playwright 是可选的开发测试依赖，通过 npm 安装，不内嵌在可玩的 HTML 中。

发现来源、转换或权利信息问题时，可在本仓库提交 Issue，注明材料名称和具体位置，以便核对和修正。
