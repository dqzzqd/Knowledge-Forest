# AI 三件套产物

这个目录存放**由大模型预生成**的「光合作用报告 / 农夫日记 / 兴趣画像」。

```
report-user-a.json     PhotosynthesisReport
diary-user-a.json      DiaryEntry[]
profile-user-a.json    PersonalityProfile
（user-b / user-c 同）
```

读取方：`lib/ai/artifacts.ts`（zod 校验）→ `app/api/{report,diary,profile}/route.ts`。

## 为什么是预生成，而不是后端实时调模型

知乎 AiWorks 的部署校验器（`E_USER_ENVIRONMENT_VARIABLE_UNSUPPORTED`）会扫描项目目录下
每一个 `.js/.ts` 文件，**只放行** `PORT` / `HOST` / `HOSTNAME` / `NITRO_HOST` / `NITRO_PORT`
这几个环境变量；出现任何其它 `process.env.XXX` 就阻断打包。

而官方给出的"补救"是**把密钥明文写进项目源码**——本仓库在提交前必须转为公开，
那等于把 API Key 直接公开，违反赛事红线（凭证不得出现在仓库中）。

所以采用「离线生成 + 在线只读」：

- 模型调用脚本放在**项目外**的 `ai-gen/`，密钥只存在本地的 `ai-gen/.env.local`
- 脚本产出的**内容**（不含任何凭证）提交进本目录
- 线上接口纯读 JSON，零延迟、零故障，也不怕评审现场网络或额度出问题

这也是真实 AI 产品常见的形态：批量生成 + 服务层。

## 怎么重新生成

```bash
cd D:/workspace/ai-gen
cp .env.example .env.local     # 填入 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL
node generate.mjs              # 全部生成；也可 --only=diary --user=user-a
```

## 产物缺失会怎样

不会报错。`lib/ai/artifacts.ts` 读不到或校验不过时返回 `null`，
路由自动切到 `lib/ai/fallback.ts` 的**确定性降级版**——由真实数据直接推导
（兴趣分布、事件差分、内容质量），文字不如模型灵动，但内容依然真实、可解释。
