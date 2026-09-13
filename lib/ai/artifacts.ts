import "server-only";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type {
  DiaryEntry,
  PersonalityProfile,
  PhotosynthesisReport,
} from "@/lib/contract";

/**
 * AI 三件套的产物读取层。
 *
 * 产物由**项目外**的 `ai-gen/generate.mjs` 用大模型预生成，落在 `mock-data/ai/`。
 * 这里只负责「读 + 校验 + 兜底」：读不到或校验不过就返回 null，
 * 由路由切到 lib/ai/fallback.ts 的确定性版本——接口永不 500、页面永不空。
 *
 * 为什么不在运行时调用模型：知乎 AiWorks 的部署校验器会拒绝项目源码里
 * 任何 `process.env.<非内置变量>` 的访问（E_USER_ENVIRONMENT_VARIABLE_UNSUPPORTED），
 * 密钥无处安放；官方给的"补救"是把密钥明文写进源码，而本仓库提交前必须公开。
 * 详见 mock-data/ai/README.md。
 */
const AI_DIR = path.join(process.cwd(), "mock-data", "ai");

const categorySchema = z.enum([
  "tech",
  "humanities",
  "business",
  "science",
  "life",
  "arts",
  "social",
  "other",
]);

const reportSchema: z.ZodType<PhotosynthesisReport> = z.object({
  reportId: z.string(),
  userId: z.string(),
  date: z.string(),
  headline: z.string(),
  highlights: z.array(
    z.object({
      treeId: z.string(),
      treeName: z.string(),
      category: categorySchema,
      summary: z.string(),
      contentIds: z.array(z.string()),
    }),
  ),
  stats: z.object({
    newLeafCount: z.number(),
    newTreeCount: z.number(),
    totalContentCount: z.number(),
  }),
});

const diarySchema: z.ZodType<DiaryEntry[]> = z.array(
  z.object({
    entryId: z.string(),
    userId: z.string(),
    createdAt: z.string(),
    periodStart: z.string(),
    periodEnd: z.string(),
    eventType: z.enum(["newTree", "surge", "decay", "revive"]),
    treeId: z.string(),
    treeName: z.string(),
    leafIds: z.array(z.string()),
    message: z.string(),
    suggestedAction: z.enum(["water", "prune", "none"]),
  }),
);

const profileSchema: z.ZodType<PersonalityProfile> = z.object({
  userId: z.string(),
  generatedAt: z.string(),
  soulType: z.string(),
  soulTypeEmoji: z.string(),
  description: z.string(),
  traits: z.array(
    z.object({
      label: z.string(),
      score: z.number(),
      evidence: z.string(),
    }),
  ),
  topCategories: z.array(
    z.object({ category: categorySchema, weight: z.number() }),
  ),
});

function readArtifact<T>(file: string, schema: z.ZodType<T>): T | null {
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(AI_DIR, file), "utf8");
  } catch {
    // 文件不存在是正常状态：还没跑过 ai-gen
    return null;
  }

  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error(`[ai] ${file} 未通过 schema 校验，改用降级生成`, parsed.error.issues);
      return null;
    }
    return parsed.data;
  } catch (error) {
    console.error(`[ai] ${file} 不是合法 JSON，改用降级生成`, error);
    return null;
  }
}

export const loadReportArtifact = (userId: string) =>
  readArtifact(`report-${userId}.json`, reportSchema);

export const loadDiaryArtifact = (userId: string) =>
  readArtifact(`diary-${userId}.json`, diarySchema);

export const loadProfileArtifact = (userId: string) =>
  readArtifact(`profile-${userId}.json`, profileSchema);
