import { DIARY_WINDOW_DAYS, getDiary } from "@/lib/ai/serve";
import { fail, ok, parseIntParam, parseUserId } from "@/lib/api";
import { TOTAL_DAYS } from "@/lib/replay";

/** 需要请求时读 mock-data/ai/，不能预渲染 */
export const dynamic = "force-dynamic";

/**
 * GET /api/diary?userId=user-a&limit=12&window=21
 *
 * 农夫日记（契约 §4 / §5.3）★ 核心差异化。
 * 预生成产物覆盖默认窗口（近三周）；请求其它窗口时走确定性降级版。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = parseUserId(url);
  if (!userId) return fail("userId 必须是 user-a / user-b / user-c");

  const limit = parseIntParam(url, "limit", 12, 1, 50);
  const windowDays = parseIntParam(url, "window", DIARY_WINDOW_DAYS, 1, TOTAL_DAYS);

  return ok(getDiary(userId, limit, windowDays));
}
