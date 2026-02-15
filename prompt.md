请注意 `./src/api/dict/query.ts` 文件。该文件实现了一个查询英文词典的 API。目前该 API 接受一个英文单词，并返回一个 html 文件，但是这个 html 的格式是未知的。

你的目标是通过不断修改 `./src/api/dict/query.ts` 文件并运行，通过找规律，推测那个 html 文件的格式，然后将其转化为 JSON 格式。

目标 JSON 格式如下：

```json
{
    "word": "某个英文单词",
    "pronunciation": "这个单词的音标",
    "meanings": [
        {
            "content": "中文释义 1",
            "type": "词性 1",
            "sentence": "例句 1"
        },
        {
            "content": "中文释义 2",
            "type": "词性 2",
            "sentence": "例句 2"
        },
        ...
    ]
}
```

需要注意的是，**单词的所有含义都必须找全**。

请不要直接编辑 `./src/api/dict/query.ts` 文件——你可以创建 `./src/api/dict/query-new.ts` 文件进行测试，最后也要输出到 `./src/api/dict/query-new.ts` 中。

你可以使用 `tsc` 命令进行测试。请全面测试多个英文单词以降低 bug 出现的概率。