import { z } from "zod";
import { fail, isDemoUserId, nowIso, ok } from "@/lib/api";
import { deriveCicada } from "@/lib/cicada";
import type { FeedbackRequest, FeedbackResult, FeedbackSignal } from "@/lib/contract";
import { FeedbackError, applyFeedback } from "@/lib/feedback";
import { loadForest } from "@/lib/forest";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  userId: z.string(),
  treeId: z.string(),
  leafId: z.string(),
  action: z.enum(["prune", "water"]),
});

const BAD_BODY = "body 需为 { userId, treeId, leafId, action: 'prune' | 'water' }";

/**
 * POST /api/feedback
 *
 * 提交修剪 / 浇水（契约 §3 / §4）。返回**反馈生效后的完整状态**，
 * 前端一次往返就能重绘森林并让精灵演出，不必再拉一次 /api/forest。
 *
 * 无状态：不落盘、不写 /tmp。AiWorks 部署在 CloudBase 云函数上，
 * 代码目录只读、实例间不共享内存，任何"存下来"的假象都会在演示时穿帮。
 * 效果由纯函数算出，因此本地与线上行为完全一致。
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(BAD_BODY);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail(BAD_BODY);

  const { userId, treeId, leafId, action } = parsed.data;
  if (!isDemoUserId(userId)) return fail("userId 必须是 user-a / user-b / user-c");

  const feedback = { userId, treeId, leafId, action } satisfies FeedbackRequest;
  const forest = loadForest(userId);
  const now = nowIso();

  try {
    const { forest: grown } = applyFeedback(forest, feedback, now);
    const cicada = deriveCicada(grown, now, feedback);

    const data: FeedbackResult = {
      forest: { ...grown, cicada },
      cicada,
      signal: {
        signalId: `signal_${now.replace(/\D/g, "").slice(0, 14)}_${leafId}`,
        ...feedback,
        createdAt: now,
      } satisfies FeedbackSignal,
    };
    return ok(data, { cache: false });
  } catch (error) {
    // 叶子不存在 / 不属于该树：是请求错，不是服务错
    if (error instanceof FeedbackError) return fail(error.message);
    throw error;
  }
}
