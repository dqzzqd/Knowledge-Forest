/**
 * 反馈信号（浇水 / 修剪）对森林的作用。
 *
 * 纯函数、不可变更新——每次反馈产出一份**新快照**，不改原对象。
 * 与 lib/replay.ts 同一套约定：服务端路由与将来可能的客户端乐观更新
 * 可以共用这段逻辑，不必各写一份。
 *
 * 无状态：这里不落盘、不记日志。云函数（AiWorks / CloudBase）的代码目录只读，
 * 任何"写到 data/"的持久化在线上都会静默失败，所以宁可不假装能存。
 */
import type { FeedbackRequest, ForestSnapshot, Leaf } from "./contract";

/** 反馈不合法（叶子不存在 / 不属于该树）——路由据此回 400，而不是 500 */
export class FeedbackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedbackError";
  }
}

export interface FeedbackOutcome {
  forest: ForestSnapshot;
  /** 被操作的那片叶子，更新后的样子 */
  leaf: Leaf;
}

export function applyFeedback(
  forest: ForestSnapshot,
  request: FeedbackRequest,
  now: string,
): FeedbackOutcome {
  const { treeId, leafId, action } = request;

  const leaf = forest.leaves.find((l) => l.leafId === leafId);
  if (!leaf) {
    throw new FeedbackError(`找不到叶子 ${leafId}`);
  }

  const tree = forest.trees.find((t) => t.treeId === treeId);
  if (!tree) {
    throw new FeedbackError(`找不到主题树 ${treeId}`);
  }

  if (!tree.leafIds.includes(leafId)) {
    throw new FeedbackError(
      `叶子 ${leafId} 不在「${tree.name}」上——它可能已被修剪`,
    );
  }

  const nextLeaf = action === "water" ? waterLeaf(leaf, now) : leaf;
  const nextForest =
    action === "water"
      ? {
          ...forest,
          leaves: forest.leaves.map((l) => (l.leafId === leafId ? nextLeaf : l)),
        }
      : prune(forest, treeId, leafId);

  return { forest: nextForest, leaf: nextLeaf };
}

/** 浇水后叶子的样子：回到新鲜、次数 +1、活跃时间推到此刻 */
function waterLeaf(leaf: Leaf, now: string): Leaf {
  return {
    ...leaf,
    state: "fresh",
    waterCount: leaf.waterCount + 1,
    lastActiveAt: now,
  };
}

/**
 * 修剪：叶子从树上摘掉，并记入 `prunedLeafIds`。
 *
 * 叶子本身仍留在 `forest.leaves` 里——`LeafState` 的取值（fresh/fading/withered）
 * 没有"已修剪"这一档，删掉对象又会让叶子详情查不到。前端按树的 `leafIds`
 * 渲染，所以摘掉即从树上消失，而详情仍可回溯。
 */
function prune(forest: ForestSnapshot, treeId: string, leafId: string): ForestSnapshot {
  const trees = forest.trees.map((t) =>
    t.treeId === treeId
      ? {
          ...t,
          leafIds: t.leafIds.filter((id) => id !== leafId),
          prunedLeafIds: t.prunedLeafIds.includes(leafId)
            ? t.prunedLeafIds
            : [...t.prunedLeafIds, leafId],
        }
      : t,
  );
  return { ...forest, trees };
}
