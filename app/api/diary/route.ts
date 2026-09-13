import { fail, ok, parseIntParam, parseUserId } from "@/lib/api";
import { loadDiaryArtifact } from "@/lib/ai/artifacts";
import { fallbackDiary } from "@/lib/ai/fallback";
import { loadDemoUser, loadForest } from "@/lib/forest";
import { TOTAL_DAYS } from "@/lib/replay";

/** 需要请求时读 mock-data/ai/，不能预渲染 */
export const dynamic = "force-dynamic";

/**
 * 默认观察窗口：最近 21 天（"近三周"）。
 * ★ 必须与 ai-gen/generate.mjs 的 DEFAULT_WINDOW_DAYS 一致，
 *   否则不会命中预生成产物，会退回规则版。
 *   取 21 天的依据：7 天时 user-c 只有 1 条；30 天时 user-c 退化成 9 条重复的"种树"。
 */
const DEFAULT_WINDOW_DAYS = 21;

/**
 * GET /api/diary?userId=user-a&limit=12&window=21
 *
 * 农夫日记（契约 §4 / §5.3）★ 核心差异化。
 * 预生成产物覆盖默认窗口；请求更长窗口时走确定性降级版。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = parseUserId(url);
  if (!userId) return fail("userId 必须是 user-a / user-b / user-c");

  const limit = parseIntParam(url, "limit", 12, 1, 50);
  const windowDays = parseIntParam(url, "window", DEFAULT_WINDOW_DAYS, 1, TOTAL_DAYS);
  const periodStart = TOTAL_DAYS - windowDays + 1;

  const user = loadDemoUser(userId);
  const forest = loadForest(userId);
  const artifact = loadDiaryArtifact(userId);

  if (artifact !== null && windowDays === DEFAULT_WINDOW_DAYS) {
    return ok(artifact.slice(0, limit));
  }

  return ok(
    fallbackDiary(userId, user.contents, forest, periodStart, TOTAL_DAYS, limit),
  );
}
