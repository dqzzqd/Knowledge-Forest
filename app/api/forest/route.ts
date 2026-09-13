import { fail, nowIso, ok, parseUserId } from "@/lib/api";
import { deriveCicada } from "@/lib/cicada";
import { loadForest } from "@/lib/forest";

/** 精灵状态随请求时刻推导，不能预渲染 */
export const dynamic = "force-dynamic";

/**
 * GET /api/forest?userId=user-a
 *
 * 森林快照（契约 §4）——前端渲染的唯一数据源。
 * 比 mock-data 里的快照多一个 `cicada`：精灵不落静态数据，
 * 由 lib/cicada.ts 在请求时按森林自身状态推导（主动巡视）。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = parseUserId(url);
  if (!userId) return fail("userId 必须是 user-a / user-b / user-c");

  const forest = loadForest(userId);
  const now = nowIso();

  return ok({ ...forest, cicada: deriveCicada(forest, now) });
}
