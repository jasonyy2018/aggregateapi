# AggregateAPI — AI API 聚合网关

一个功能完整的 AI API 聚合平台，将 OpenAI、Anthropic、Google Gemini 等 400+ 模型统一为 OpenAI 兼容接口，支持 LLM 对话、图像生成、视频生成、音乐生成，内置计费、订阅、支付和用户管理。

## 功能概览

| 模块 | 说明 |
|------|------|
| **LLM 对话** | OpenAI 兼容 `/v1/chat/completions`，支持流式/非流式，自动路由到正确上游协议（OpenAI / Anthropic / Gemini） |
| **图像生成** | OpenAI 兼容 `/v1/images/generations`，同步等待生成完成，返回图片 URL |
| **视频/音乐生成** | 异步任务创建 + 内部轮询，36 秒内等待结果后直接返回 |
| **多协议适配** | OpenAI 兼容、Anthropic 原生、Google Gemini 三种协议自动转换 |
| **计费系统** | 按 token 计费（聊天）或按次计费（媒体），支持订阅套餐和折扣率 |
| **支付集成** | PayPal（沙箱/生产）、支付宝，自动兑换汇率 |
| **推荐系统** | 邀请码 `REF-XXXX`，推荐人获得充值金额 10% 佣金 |
| **管理后台** | 用户管理、提供商/模型 CRUD、定价设置、Wiki 编辑器、支付配置 |
| **i18n** | 中英文双语界面 |

## 技术栈

- **框架**: Next.js 16.2.3 (App Router, standalone output)
- **语言**: TypeScript 5 (strict mode)
- **UI**: React 19 + Tailwind CSS v4
- **数据库**: PostgreSQL 15 (via Docker)
- **ORM**: Prisma 7 (`@prisma/adapter-pg`)
- **认证**: NextAuth v5 (Google OAuth + 账号密码)
- **支付**: PayPal JS SDK + Alipay SDK
- **加密**: AES-256-GCM (provider API key 存储加密)
- **包管理**: pnpm 9.15.0

## 快速开始

### 1. 环境要求

- Node.js >= 20.9.0
- pnpm >= 9.0
- Docker & Docker Compose (可选，用于本地开发)

### 2. 克隆与安装

```bash
git clone <repo-url>
cd aggregateapi
pnpm install
```

### 3. 配置环境变量

复制 `.env` 文件并修改必要项：

```bash
cp .env .env.local   # .env.local 已加入 .gitignore
```

**必需的环境变量：**

| 变量 | 说明 | 示例 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://user:pass@localhost:5432/aggregateapi` |
| `NEXTAUTH_SECRET` | NextAuth 签名密钥 | 随机长字符串 |
| `ENCRYPTION_KEY` | AES-256 加密密钥 | 随机长字符串 |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `xxxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | `GOCSPX-xxx` |

**可选的环境变量：**

| 变量 | 说明 |
|------|------|
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | PayPal 支付凭据 |
| `ALIPAY_APP_ID` / `ALIPAY_PRIVATE_KEY` / `ALIPAY_PUBLIC_KEY` | 支付宝配置 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 初始管理员账号 |

### 4. 初始化数据库

```bash
pnpm db:push          # 推送 Prisma schema 到数据库
pnpm seed:admin       # 创建管理员账号
```

### 5. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

### 6. Docker 部署

```bash
docker compose up -d
```

首次启动会自动创建数据库表和管理员账户。

## API 使用示例

### 配置 OpenAI SDK

```javascript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://your-domain.com/v1",
  apiKey: "your-platform-api-key",  // 在 Dashboard → API Keys 创建
});

// 聊天
const response = await openai.chat.completions.create({
  model: "kie/claude-sonnet-4-6",
  messages: [{ role: "user", content: "你好" }],
  stream: true,
});

// 图像生成
const image = await openai.images.generate({
  model: "flux-schnell",
  prompt: "a futuristic cyberpunk city at night",
  size: "1024x1024",
});
```

### Cherry Studio 配置

1. 打开 Cherry Studio → Settings → Providers
2. 添加 Provider：
   - Name: `AggregateAPI`
   - Base URL: `https://your-domain.com/v1`
   - API Key: 你的平台 API Key

### 获取可用模型列表

```bash
curl https://your-domain.com/v1/models \
  -H "Authorization: Bearer your-api-key"
```

## 管理面板

### 登录管理员账户

访问 `/admin/login`，使用 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 环境变量设置的凭据登录。

### 添加上游提供商

1. Dashboard → Admin → Providers
2. 点击 "Add Provider"
3. 填写名称、slug、协议类型（OpenAI/Anthropic/Gemini）、Base URL 和 API Key
4. 点击 "Import Models" 自动导入模型列表

### 配置支付

1. Dashboard → Admin → Payments
2. 填写 PayPal 或支付宝的凭据
3. 保存后用户可在 Billing 页面进行充值

## 目录结构

```
aggregateapi/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API 路由
│   │   │   ├── auth/           # NextAuth
│   │   │   ├── payments/       # PayPal / Alipay
│   │   │   └── v1/             # 平台 API
│   │   │       ├── chat/       # /v1/chat/completions
│   │   │       ├── images/     # /v1/images/generations
│   │   │       ├── jobs/       # /api/v1/jobs/createTask
│   │   │       ├── tasks/      # /api/v1/tasks/status
│   │   │       └── models/     # /v1/models
│   │   ├── dashboard/          # 用户和管理员仪表板
│   │   └── login/              # 登录页面
│   ├── lib/                    # 核心库
│   │   ├── billing.ts          # 计费逻辑
│   │   ├── crypto.ts           # AES-256-GCM 加解密
│   │   ├── llm-gateway.ts      # 协议适配器 (OpenAI/Anthropic/Gemini)
│   │   ├── model-registry.ts   # 模型路由注册表
│   │   ├── multimodal-gateway.ts # 图像/视频/音乐生成网关
│   │   ├── pricing.ts          # 定价计算
│   │   ├── referral.ts         # 推荐系统
│   │   ├── shared.ts           # 共享工具函数
│   │   └── validation.ts       # 输入验证
│   └── components/             # React 组件
├── prisma/
│   └── schema.prisma           # 数据库 Schema
├── scripts/                    # 脚本
│   ├── entrypoint.sh           # Docker 入口脚本
│   ├── ensure-admin.js         # 管理员账户初始化
│   └── create-admin.ts         # 管理员种子脚本
├── docker-compose.yml          # Docker 编排
├── Dockerfile                  # 多阶段构建
└── package.json
```

## 数据库 Schema

主要数据模型：

- **User** — 用户账户（余额、折扣率、推荐关系）
- **ApiKey** — 平台 API Key（每分钟限流）
- **Provider** — 上游 AI 提供商（OpenAI/Anthropic/Gemini）
- **ProviderModel** — 提供商的模型及定价
- **UsageLog** — 每次请求的使用日志
- **BillingTransaction** — 充值交易记录
- **UserSubscription** — 用户订阅套餐
- **SubscriptionPlan** — 可购买的订阅套餐
- **WikiSection** — 双语文档内容

## 安全注意事项

1. **生产环境必须修改所有默认密码**：`POSTGRES_PASSWORD`、`ADMIN_PASSWORD`、`NEXTAUTH_SECRET`、`ENCRYPTION_KEY`
2. **API Key 加密存储**：上游提供商的 API Key 使用 AES-256-GCM 加密存储在数据库中
3. **速率限制**：每个 API Key 独立限流（`limitPerMinute`），超限返回 429
4. **计费原子性**：余额扣减在数据库事务内执行，防止并发超额扣费
5. **推荐防刷**：禁止自推荐，推荐佣金在支付成功后发放

## 常见问题

### Q: 如何添加新的 AI 提供商？

在 Admin → Providers 中添加，填写协议类型和 API Key，然后 Import Models。

### Q: 如何修改模型定价？

在 Admin → Providers 中编辑单个模型的 `costInputPer1k` / `costOutputPer1k`（成本价）和 `inputPricePer1k` / `outputPricePer1k`（售价）。系统会强制最低利润率。

### Q: 为什么图像生成很慢？

图像生成需要等待上游完成（最多 105 秒），期间前端会持续轮询。这是正常行为。

### Q: 如何备份数据库？

```bash
pg_dump -U postgres aggregateapi > backup.sql
```

## License

Private — All rights reserved.
