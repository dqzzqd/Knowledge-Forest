import { fail, ok, parseDateParam, parseUserId } from "@/lib/api";
import { loadReportArtifact } from "@/lib/ai/artifacts";
import { fallbackReport } from "@/lib/ai/fallback";
import { loadDemoUser, loadForest } from "@/lib/forest";
import { TOTAL_DAYS, dayIndexOf } from "@/lib/replay";

/** 需要请求时读 mock-data/ai/，不能预渲染 */
export const dynamic = "force-dynamic";

/**
 * GET /api/report?userId=user-a&date=2026-09-13
 *
 * 光合作用报告（契约 §4 / §5.4）。
 * 预生成的产物只覆盖演示的「今天」；请求其它日期时走确定性降级版。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = parseUserId(url);
  if (!userId) return fail("userId 必须是 user-a / user-b / user-c");

  const dateParam = url.searchParams.get("date");
  const date = parseDateParam(url, "date");
  if (dateParam !== null && date === null) return fail("date 需为 YYYY-MM-DD 格式");

  const user = loadDemoUser(userId);
  const forest = loadForest(userId);
  const artifact = loadReportArtifact(userId);

  const day = date ? dayIndexOf(`${date}T12:00:00+08:00`) : TOTAL_DAYS;
  const useArtifact = artifact !== null && (date === null || artifact.date === date);

  return ok(useArtifact ? artifact : fallbackReport(userId, user.contents, forest, day));
}
