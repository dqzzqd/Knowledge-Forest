import { test } from "node:test";
import assert from "node:assert/strict";
import { FeedbackError, applyFeedback } from "../feedback.ts";
import { T0, makeForest, makeLeaf, makeTree } from "./fixtures.ts";

const NOW = "2026-09-14T09:00:00+08:00";

function forestWithLeaf(state: "fresh" | "fading" | "withered") {
  const leaf = makeLeaf({ leafId: "leaf_ai_rag", treeId: "tree_ai", state });
  const tree = makeTree({ treeId: "tree_ai", leafIds: ["leaf_ai_rag"] });
  return { forest: makeForest([tree], [leaf]), leaf, tree };
}

test("浇水把叶子拉回新鲜，并累加浇水次数", () => {
  const { forest } = forestWithLeaf("withered");

  const after = applyFeedback(
    forest,
    { userId: "user-test", treeId: "tree_ai", leafId: "leaf_ai_rag", action: "water" },
    NOW,
  );

  const leaf = after.forest.leaves.find((l) => l.leafId === "leaf_ai_rag")!;
  assert.equal(leaf.state, "fresh");
  assert.equal(leaf.waterCount, 1);
  assert.equal(leaf.lastActiveAt, NOW);
});

test("浇水不修改原森林（不可变更新）", () => {
  const { forest } = forestWithLeaf("withered");

  applyFeedback(
    forest,
    { userId: "user-test", treeId: "tree_ai", leafId: "leaf_ai_rag", action: "water" },
    NOW,
  );

  const before = forest.leaves.find((l) => l.leafId === "leaf_ai_rag")!;
  assert.equal(before.state, "withered");
  assert.equal(before.waterCount, 0);
});

test("反复浇水把次数累加上去", () => {
  const { forest } = forestWithLeaf("fresh");
  const req = {
    userId: "user-test",
    treeId: "tree_ai",
    leafId: "leaf_ai_rag",
    action: "water" as const,
  };

  const once = applyFeedback(forest, req, NOW);
  const twice = applyFeedback(once.forest, req, NOW);

  assert.equal(
    twice.forest.leaves.find((l) => l.leafId === "leaf_ai_rag")!.waterCount,
    2,
  );
});

test("修剪把叶子记入 prunedLeafIds 并从树上摘掉", () => {
  const { forest } = forestWithLeaf("fresh");

  const after = applyFeedback(
    forest,
    { userId: "user-test", treeId: "tree_ai", leafId: "leaf_ai_rag", action: "prune" },
    NOW,
  );

  const tree = after.forest.trees.find((t) => t.treeId === "tree_ai")!;
  assert.deepEqual(tree.prunedLeafIds, ["leaf_ai_rag"]);
  assert.deepEqual(tree.leafIds, []);
});

test("修剪只影响目标树，不碰别的树", () => {
  const a = makeTree({ treeId: "tree_ai", leafIds: ["leaf_ai_rag"] });
  const b = makeTree({ treeId: "tree_history", leafIds: ["leaf_history_ming"] });
  const forest = makeForest(
    [a, b],
    [
      makeLeaf({ leafId: "leaf_ai_rag", treeId: "tree_ai" }),
      makeLeaf({ leafId: "leaf_history_ming", treeId: "tree_history" }),
    ],
  );

  const after = applyFeedback(
    forest,
    { userId: "user-test", treeId: "tree_ai", leafId: "leaf_ai_rag", action: "prune" },
    NOW,
  );

  const other = after.forest.trees.find((t) => t.treeId === "tree_history")!;
  assert.deepEqual(other.leafIds, ["leaf_history_ming"]);
  assert.deepEqual(other.prunedLeafIds, []);
});

test("叶子不存在时拒绝，且报出是哪片", () => {
  const { forest } = forestWithLeaf("fresh");

  assert.throws(
    () =>
      applyFeedback(
        forest,
        { userId: "user-test", treeId: "tree_ai", leafId: "leaf_nope", action: "water" },
        NOW,
      ),
    (error: unknown) =>
      error instanceof FeedbackError && error.message.includes("leaf_nope"),
  );
});

test("叶子不属于该树时拒绝——防止跨树误操作", () => {
  const forest = makeForest(
    [
      makeTree({ treeId: "tree_ai", leafIds: ["leaf_ai_rag"] }),
      makeTree({ treeId: "tree_history", leafIds: ["leaf_history_ming"] }),
    ],
    [
      makeLeaf({ leafId: "leaf_ai_rag", treeId: "tree_ai" }),
      makeLeaf({ leafId: "leaf_history_ming", treeId: "tree_history" }),
    ],
  );

  assert.throws(
    () =>
      applyFeedback(
        forest,
        { userId: "user-test", treeId: "tree_history", leafId: "leaf_ai_rag", action: "water" },
        NOW,
      ),
    FeedbackError,
  );
});

test("给已修剪的叶子浇水会被拒绝（它已经不在树上了）", () => {
  const { forest } = forestWithLeaf("fresh");
  const req = {
    userId: "user-test",
    treeId: "tree_ai",
    leafId: "leaf_ai_rag",
    action: "prune" as const,
  };
  const pruned = applyFeedback(forest, req, NOW);

  assert.throws(
    () => applyFeedback(pruned.forest, { ...req, action: "water" }, NOW),
    FeedbackError,
  );
});
