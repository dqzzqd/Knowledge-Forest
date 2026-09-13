/**
 * 纯函数测试的最小夹具。
 *
 * 只构造被测逻辑真正会读到的字段——不照抄 mock-data 的完整形状，
 * 否则数据一改测试就跟着碎，却测不出任何真东西。
 */
import type { ForestSnapshot, Leaf, TopicTree } from "../contract";

export const T0 = "2026-09-13T22:00:00+08:00";

export function makeLeaf(
  over: Partial<Leaf> & Pick<Leaf, "leafId" | "treeId">,
): Leaf {
  return {
    name: over.leafId,
    summary: "",
    contentIds: [],
    state: "fresh",
    createdAt: "2026-08-15T10:00:00+08:00",
    lastActiveAt: T0,
    waterCount: 0,
    ...over,
  };
}

export function makeTree(
  over: Partial<TopicTree> & Pick<TopicTree, "treeId">,
): TopicTree {
  return {
    name: over.treeId,
    category: "tech",
    stage: "young",
    leafIds: [],
    totalContentCount: 1,
    createdAt: "2026-08-15T10:00:00+08:00",
    lastGrownAt: T0,
    prunedLeafIds: [],
    ...over,
  };
}

export function makeForest(
  trees: TopicTree[],
  leaves: Leaf[],
): ForestSnapshot {
  return {
    userId: "user-test",
    displayName: "测试用户",
    nickname: "测试",
    bio: "",
    tags: [],
    avatar: "",
    generatedAt: T0,
    trees,
    leaves,
    layout: trees.map((t, i) => ({
      treeId: t.treeId,
      x: 0.5,
      y: 0.5,
      scale: 1 + i * 0.1,
    })),
  };
}
