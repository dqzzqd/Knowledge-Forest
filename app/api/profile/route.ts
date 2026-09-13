import { getProfile } from "@/lib/ai/serve";
import { fail, ok, parseUserId } from "@/lib/api";

/** 需要请求时读 mock-data/ai/，不能预渲染 */
export const dynamic = "force-dynamic";

/**
 * GET /api/profile?userId=user-a
 *
 * 兴趣画像（契约 §4 / §5.5）。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = parseUserId(url);
  if (!userId) return fail("userId 必须是 user-a / user-b / user-c");

  return ok(getProfile(userId));
}
