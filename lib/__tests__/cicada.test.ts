import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveCicada } from "../cicada.ts";
import { T0, makeForest, makeLeaf, makeTree } from "./fixtures.ts";

const NOW = "2026-09-14T09:00:00+08:00";

test("刚浇过水时，精灵飞到那棵树上浇水", () => {
  const forest = makeForest(
    [makeTree({ treeId: "tree_ai", name: "人工智能", leafIds: ["leaf_ai_rag"] })],
    [makeLeaf({ leafId: "leaf_ai_rag", treeId: "tree_ai", name: "RAG" })],
  );

  const cicada = deriveCicada(forest, NOW, {
    userId: "user-test",
    treeId: "tree_ai",
    leafId: "leaf_ai_rag",
    action: "water",
  });

  assert.equal(cicada.action, "water");
  assert.equal(cicada.targetTreeId, "tree_ai");
  assert.equal(cicada.updatedAt, NOW);
  assert.ok(cicada.line.includes("人工智能"));
});

test("刚修剪过时，精灵执行修剪动作", () => {
  const forest = makeForest(
    [makeTree({ treeId: "tree_ai", name: "人工智能", leafIds: ["leaf_ai_rag"] })],
    [makeLeaf({ leafId: "leaf_ai_rag", treeId: "tree_ai", name: "RAG" })],
  );

  const cicada = deriveCicada(forest, NOW, {
    userId: "user-test",
    treeId: "tree_ai",
    leafId: "leaf_ai_rag",
    action: "prune",
  });

  assert.equal(cicada.action, "prune");
  assert.equal(cicada.targetTreeId, "tree_ai");
});

test("无人操作时，精灵主动飞去提醒快枯的叶子", () => {
  const forest = makeForest(
    [makeTree({ treeId: "tree_ai", name: "人工智能", leafIds: ["leaf_ai_rag"] })],
    [
      makeLeaf({ leafId: "leaf_ai_rag", treeId: "tree_ai", name: "RAG", state: "fading" }),
    ],
  );

  const cicada = deriveCicada(forest, NOW);

  assert.equal(cicada.action, "fly");
  assert.equal(cicada.targetTreeId, "tree_ai");
  assert.ok(cicada.line.includes("RAG"), `台词应点到叶子名：${cicada.line}`);
});

test("叶子全新鲜时，精灵待机", () => {
  const forest = makeForest(
    [makeTree({ treeId: "tree_ai", leafIds: ["leaf_ai_rag"] })],
    [makeLeaf({ leafId: "leaf_ai_rag", treeId: "tree_ai", state: "fresh" })],
  );

  const cicada = deriveCicada(forest, NOW);

  assert.equal(cicada.action, "idle");
  assert.equal(cicada.targetTreeId, null);
});

test("只剩彻底枯萎的叶子时，精灵去清理而不是提醒", () => {
  const forest = makeForest(
    [makeTree({ treeId: "tree_ai", name: "人工智能", leafIds: ["leaf_ai_rag"] })],
    [
      makeLeaf({ leafId: "leaf_ai_rag", treeId: "tree_ai", name: "RAG", state: "withered" }),
    ],
  );

  const cicada = deriveCicada(forest, NOW);

  assert.equal(cicada.action, "sweep");
});

test("fading 优先于 withered——先救还能救的", () => {
  const forest = makeForest(
    [
      makeTree({ treeId: "tree_ai", leafIds: ["leaf_ai_rag"] }),
      makeTree({ treeId: "tree_history", leafIds: ["leaf_history_ming"] }),
    ],
    [
      makeLeaf({ leafId: "leaf_ai_rag", treeId: "tree_ai", state: "withered" }),
      makeLeaf({ leafId: "leaf_history_ming", treeId: "tree_history", state: "fading" }),
    ],
  );

  assert.equal(deriveCicada(forest, NOW).action, "fly");
  assert.equal(deriveCicada(forest, NOW).targetTreeId, "tree_history");
});

test("多片快枯时选最久没动的，结果稳定不随机", () => {
  const forest = makeForest(
    [
      makeTree({ treeId: "tree_ai", leafIds: ["leaf_ai_rag"] }),
      makeTree({ treeId: "tree_history", leafIds: ["leaf_history_ming"] }),
    ],
    [
      makeLeaf({
        leafId: "leaf_ai_rag",
        treeId: "tree_ai",
        state: "fading",
        lastActiveAt: "2026-09-05T10:00:00+08:00",
      }),
      makeLeaf({
        leafId: "leaf_history_ming",
        treeId: "tree_history",
        state: "fading",
        lastActiveAt: "2026-09-01T10:00:00+08:00",
      }),
    ],
  );

  assert.equal(deriveCicada(forest, NOW).targetTreeId, "tree_history");

  // 同样的输入再来一次，必须还是同一棵树——精灵不能每次跳不同地方
  assert.equal(deriveCicada(forest, NOW).targetTreeId, "tree_history");
});

test("同为最久没动时，按 leafId 定序，仍然是确定性的", () => {
  const forest = makeForest(
    [
      makeTree({ treeId: "tree_ai", leafIds: ["leaf_ai_rag"] }),
      makeTree({ treeId: "tree_history", leafIds: ["leaf_history_ming"] }),
    ],
    [
      makeLeaf({
        leafId: "leaf_ai_rag",
        treeId: "tree_ai",
        state: "fading",
        lastActiveAt: T0,
      }),
      makeLeaf({
        leafId: "leaf_history_ming",
        treeId: "tree_history",
        state: "fading",
        lastActiveAt: T0,
      }),
    ],
  );

  assert.equal(deriveCicada(forest, NOW).targetTreeId, "tree_ai");
});

test("空森林里精灵安静待机", () => {
  const cicada = deriveCicada(makeForest([], []), NOW);

  assert.equal(cicada.action, "idle");
  assert.equal(cicada.targetTreeId, null);
});
