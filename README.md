# 广学英语

“广学英语”项目旨在“选词填空”的基础上，支持导入自定义词库功能，为用户提供更加多样化、高效的学习英语方法。

目前打算支持以下功能：

- 每个用户可以添加一个词库，给词库里的每一个单词打一个 tag，表示自己对这个单词掌握不足的知识点。（比如一词多义、形式变形等）
- 根据用户的词库生成一些题目(利用AI)和游戏，比如选词填空、完型填空、翻译等等。

目前仅限于背单词，未来可能会添加阅读、作文训练等功能。

# 本地运行方法

- 拉取项目。
- 下载 [词典](https://github.com/skywind3000/ECDICT/blob/master/ecdict.csv) 文件并保存到 `./src/dict` 目录下。
- 从服务器上拷贝一份 .env 文件到本地。
- 配置 paddleOCR（文字识别）服务：

```bash
cd paddleocr-service && ./setup.sh
```

- 构建并启动服务：

```bash
npm run build && start
```

# API 接口

## 作文积累查询 API

| 地址 | 功能 |
| :-: | :-: |
| `GET /api/writing-entries?userId=XXX` | 查询指定用户的作文积累本内容 |

### 认证机制

本 API 采用 **Bearer API Key 认证**，确保只有持有正确 API Key 的服务才能访问。

#### 认证方式

请求必须包含 `Authorization: Bearer <API_KEY>` header：

```bash
curl -X GET "http://localhost:3003/api/writing-entries?userId=2443" \
  -H "Authorization: Bearer your-secret-api-key-change-this-in-production-abc123xyz789"
```

#### 环境变量配置

在 `.env` 文件中配置 API Key：

```bash
# API 认证密钥（用于作文积累查询 API）
SECRET_API_KEY="your-secret-api-key-change-this-in-production-abc123xyz789"
```

**安全警告**：
- ⚠️ 生产环境必须设置强密码作为 API Key
- ⚠️ API Key 不得泄露或上传到公开仓库
- ⚠️ 定期更换 API Key 以提高安全性
- ⚠️ 使用 HTTPS 传输 API Key（生产环境）

#### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | Integer | 是 | 用户 ID（正整数） |

### 返回数据格式

```json
{
  "success": true,
  "userId": 2443,
  "userName": "testuser",
  "count": 3,
  "entries": [
    {
      "id": 1,
      "content": "Knowledge is power.",
      "note": "知识就是力量",
      "tags": ["重点"],
      "createdAt": "2026-07-10T10:30:00.000Z",
      "updatedAt": "2026-07-10T10:30:00.000Z"
    }
  ],
  "timestamp": "2026-07-10T12:00:00.000Z"
}
```

### 错误响应

```json
{
  "success": false,
  "error": "认证失败",
  "message": "请提供正确的 API Key（Authorization: Bearer <API_KEY>）",
  "timestamp": "2026-07-10T12:00:00.000Z"
}
```

## SSO 认证原理（前端应用）

本项目前端应用使用 **广学统一认证系统** (`account.gxwtf.cn`) 作为单点登录（SSO）服务，采用 **iron-session** 加密 Cookie 方案。

### 认证流程

```
┌─────────┐                   ┌──────────────┐                   ┌─────────────┐
│ 用户    │                   │ 应用系统     │                   │ SSO 服务    │
└────┬────┘                   └──────┬───────┘                   └──────┬──────┘
     │                               │                                  │
     │ 1. 访问应用                   │                                  │
     │ ─────────────────────────────>│                                  │
     │                               │                                  │
     │                               │ 2. 检查 iron-session             │
     │                               │ ───────> 未认证                  │
     │                               │                                  │
     │                               │ 3. 重定向到 SSO 登录页           │
     │                               │ ───────────────────────────────>│
     │                               │                                  │
     │ 4. 用户在 SSO 登录            │                                  │
     │ ─────────────────────────────────────────────────────────────>│
     │                               │                                  │
     │                               │ 5. SSO 回调并携带 token          │
     │                               │ <───────────────────────────────│
     │                               │                                  │
     │                               │ 6. 后端验证 token                │
     │                               │ ───────────────────────────────>│
     │                               │                                  │
     │                               │ 7. 返回用户信息                  │
     │                               │ <───────────────────────────────│
     │                               │                                  │
     │                               │ 8. iron-session 加密存储         │
     │                               │ ───────> 加密 Cookie             │
     │                               │                                  │
     │ 9. 登录成功                   │                                  │
     │ <─────────────────────────────│                                  │
     │                               │                                  │
```

### iron-session 加密机制

前端应用使用 **iron-session** 库对用户数据进行加密存储：

1. **加密 Cookie**：用户信息用 SECRET_COOKIE_PASSWORD 加密后存储在 cookie
2. **防篡改**：用户无法解密或篡改加密的 session 数据
3. **安全性高**：即使 cookie 被窃取，也无法获取用户明文信息
4. **无需服务端存储**：加密数据存储在客户端，减少服务端负担

### API 认证 vs 前端认证

本项目采用**双重认证机制**：

| 认证方式 | 适用场景 | 认证原理 | 安全特点 |
|---------|---------|---------|---------|
| **iron-session Cookie** | 前端浏览器访问 | 加密 session 存储 | 防篡改，加密保护 |
| **Bearer API Key** | 服务间 API 调用 | API Key 验证 | 简单，高效，防滥用 |

**API Key 认证优势**：
- ✅ 无需 Cookie 共享，适合跨项目调用
- ✅ 防止滥用和隐私泄露
- ✅ 简单易用，便于服务间集成
- ✅ 可随时更换 API Key 提高安全性

### API 测试示例

```bash
# 1. 使用 API Key 认证（推荐）
curl -X GET "http://localhost:3003/api/writing-entries?userId=2443" \
  -H "Authorization: Bearer your-secret-api-key-change-this-in-production-abc123xyz789"

# 2. 错误示例（缺少 API Key）
curl -X GET "http://localhost:3003/api/writing-entries?userId=2443"
# 返回：{"success":false,"error":"认证失败",...}

# 3. 错误示例（缺少 userId）
curl -X GET "http://localhost:3003/api/writing-entries" \
  -H "Authorization: Bearer your-secret-api-key-change-this-in-production-abc123xyz789"
# 返回：{"success":false,"error":"缺少参数",...}
```