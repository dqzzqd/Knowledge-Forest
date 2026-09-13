import { fail, ok, parseUserId } from "@/lib/api";
import { loadProfileArtifact } from "@/lib/ai/artifacts";
import { fallbackProfile } from "@/lib/ai/fallback";
import { loadDemoUser, loadForest } from "@/lib/forest";

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

  const user = loadDemoUser(userId);
  const forest = loadForest(userId);

  return ok(loadProfileArtifact(userId) ?? fallbackProfile(userId, user.contents, forest));
}
