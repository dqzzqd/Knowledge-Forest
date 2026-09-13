import { fail, ok, parseUserId } from "@/lib/api";
import { loadDemoUser, loadForest } from "@/lib/forest";

/** 需要请求时读 mock-data/，不能预渲染 */
export const dynamic = "force-dynamic";

/**
 * GET /api/trees/:treeId?userId=user-a
 *
 * 契约 §4：取一棵树的详情——树本身、它的叶子、以及这些叶子关联的内容。
 * 前端点开某棵树做深读时用；也给不习惯整份森林的消费方一个细粒度入口。
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ treeId: string }> },
) {
  const url = new URL(request.url);
  const userId = parseUserId(url);
  if (!userId) return fail("userId 必须是 user-a / user-b / user-c");

  const { treeId } = await ctx.params;
  const forest = loadForest(userId);
  const tree = forest.trees.find((t) => t.treeId === treeId);
  if (!tree) return fail(`找不到树：${treeId}`, 404);

  const leaves = forest.leaves.filter((l) => l.treeId === treeId);

  // 只回这棵树叶子关联的内容，最近的排前面
  const wanted = new Set(leaves.flatMap((l) => l.contentIds));
  const contents = loadDemoUser(userId)
    .contents.filter((c) => wanted.has(c.contentId))
    .sort((a, b) => b.interactedAt.localeCompare(a.interactedAt));

  return ok({ tree, leaves, contents });
}
