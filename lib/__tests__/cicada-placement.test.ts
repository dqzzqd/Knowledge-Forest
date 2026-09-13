import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CANVAS_W,
  REPLAY_BAR_TOP,
  SPRITE_H,
  SPRITE_TOP,
  SPRITE_W,
  canopyOverlapArea,
  labelOverlapArea,
  placeCicada,
  statText,
  type TreeLabelGeometry,
} from "../cicada-placement.ts";

/** 树冠椭圆的算法与 ForestCanvas 的 buildScene 一致（叶子就撒在这个椭圆里） */
function withCanopy(
  tree: Omit<TreeLabelGeometry, "canopyY" | "canopyRx" | "canopyRy"> & {
    height: number;
  },
): TreeLabelGeometry {
  const { height, ...rest } = tree;
  return {
    ...rest,
    canopyY: rest.baseY - height * 0.63,
    canopyRx: rest.width * 0.29,
    canopyRy: height * 0.23,
  };
}

/**
 * user-a 森林的**真实几何**（在浏览器里按 <image> 与树名坐标量出来的，
 * 不是估的）。回归测试的价值就在这里：这一组数字正是"气泡压住
 * 「职业发展」下面那两行小字 / 盖住它的叶子"那次故障的现场。
 */
const USER_A: TreeLabelGeometry[] = [
  withCanopy({
    treeId: "tree_fitness",
    x: 147.8,
    baseY: 432.4,
    width: 227.6,
    height: 180,
    name: "健身",
    statText: statText(6, "小树"),
  }),
  withCanopy({
    treeId: "tree_startup",
    x: 291.1,
    baseY: 496,
    width: 295.5,
    height: 233.6,
    name: "创业与产品",
    statText: statText(11, "成树"),
  }),
  withCanopy({
    treeId: "tree_career",
    x: 542.6,
    baseY: 368.4,
    width: 183.2,
    height: 152.7,
    name: "职业发展",
    statText: statText(6, "小树"),
  }),
  withCanopy({
    treeId: "tree_ai",
    x: 757.2,
    baseY: 450,
    width: 340.3,
    height: 283.7,
    name: "人工智能",
    statText: statText(30, "繁茂"),
  }),
  withCanopy({
    treeId: "tree_psych",
    x: 1018.1,
    baseY: 523.3,
    width: 295.9,
    height: 233.9,
    name: "心理学",
    statText: statText(7, "小树"),
  }),
];

/** 精灵真的会说出口的几句（含最长的那句——气泡宽度全看它） */
const LINES = [
  "「程序员职业」好久没浇水了，要不要回去看看？",
  "「人工智能」喝饱水啦，叶子亮晶晶的～",
  "「职业发展」修剪好啦，这块地方留给更想看的～",
  "有些叶子已经枯了，我来扫一扫～",
  "今天森林很安静，我在这儿守着～",
];

/** 旧公式：固定落在草地上 y=396、横向偏出树宽的 0.3 —— 就是出故障的那版 */
function legacySpot(tree: TreeLabelGeometry) {
  return {
    x: Math.min(CANVAS_W - 110, Math.max(110, tree.x + tree.width * 0.3)),
    y: 396,
  };
}

test("回归：旧的固定落点会压住「职业发展」的小字，新落点不会", () => {
  const career = USER_A.find((t) => t.treeId === "tree_career");
  assert.ok(career);
  const line = LINES[0];

  assert.ok(
    labelOverlapArea(USER_A, legacySpot(career), line) > 0,
    "旧公式应当被这条测试判为遮挡——否则说明测试没测到真问题",
  );
  assert.equal(labelOverlapArea(USER_A, placeCicada(USER_A, "tree_career", line), line), 0);
});

test("站到任何一棵树上，都不压**别的**树的树名", () => {
  for (const tree of USER_A) {
    for (const line of LINES) {
      const spot = placeCicada(USER_A, tree.treeId, line);
      assert.equal(
        labelOverlapArea(USER_A, spot, line, tree.treeId),
        0,
        `目标「${tree.name}」+ 台词「${line}」时落点 ${JSON.stringify(spot)} 压到了别人的树名`,
      );
    }
  }
});

test("允许压的是「自己的」树名——换来的是精灵始终贴着自己那棵树站", () => {
  for (const tree of USER_A) {
    for (const line of LINES) {
      const spot = placeCicada(USER_A, tree.treeId, line);
      // 放宽自己树名之后，落点应当留在本树的横向范围内（最多到树冠边缘）。
      // 这条是那个取舍的**兑现检查**：不放宽的话实测会飘到 380px 外去。
      assert.ok(
        Math.abs(spot.x - tree.x) <= tree.width * 0.6,
        `目标「${tree.name}」时横向偏了 ${Math.round(spot.x - tree.x)}（树宽 ${tree.width}）`,
      );
    }
  }
});

test("站到任何一棵树上，也都不压树冠——叶子是能点的，挡住就没法点了", () => {
  for (const tree of USER_A) {
    for (const line of LINES) {
      const spot = placeCicada(USER_A, tree.treeId, line);
      assert.equal(
        canopyOverlapArea(USER_A, spot, line),
        0,
        `目标「${tree.name}」+ 台词「${line}」时落点 ${JSON.stringify(spot)} 压到了树冠`,
      );
    }
  }
});

test("「职业发展」的落点：在它下方、两棵树之间，且不压回放条", () => {
  const line = LINES[0];
  const spot = placeCicada(USER_A, "tree_career", line);
  const career = USER_A.find((t) => t.treeId === "tree_career");
  const startup = USER_A.find((t) => t.treeId === "tree_startup");
  const ai = USER_A.find((t) => t.treeId === "tree_ai");
  assert.ok(career && startup && ai);

  // 横向夹在「创业与产品」和「人工智能」之间
  assert.ok(spot.x > startup.x && spot.x < ai.x, `x=${spot.x} 不在两棵树之间`);
  // 纵向在「职业发展」之下
  assert.ok(spot.y > career.baseY, `y=${spot.y} 不在树基之下`);
  // 精灵不能站到回放条上——它压在画布底部，而且视口越窄压得越多
  const spriteBottom = spot.y + SPRITE_TOP + SPRITE_H;
  assert.ok(
    spriteBottom <= REPLAY_BAR_TOP,
    `精灵底边 ${spriteBottom} 压到回放条（上限 ${REPLAY_BAR_TOP}）`,
  );
});

test("任何树、任何台词，精灵都不会站到回放条上", () => {
  for (const tree of USER_A) {
    for (const line of LINES) {
      const spot = placeCicada(USER_A, tree.treeId, line);
      const spriteBottom = spot.y + SPRITE_TOP + SPRITE_H;
      assert.ok(
        spriteBottom <= REPLAY_BAR_TOP,
        `目标「${tree.name}」时精灵底边 ${spriteBottom} 压到回放条（上限 ${REPLAY_BAR_TOP}）`,
      );
    }
  }
});

test("没有目标树（待机 / 空森林）时也给得出落点，且不压树名", () => {
  for (const line of LINES) {
    const withForest = placeCicada(USER_A, null, line);
    assert.equal(labelOverlapArea(USER_A, withForest, line), 0);
    assert.equal(labelOverlapArea([], withForest, line), 0);
  }
});

test("落点始终在画布内：精灵不出界，气泡不出界", () => {
  for (const tree of USER_A) {
    for (const line of LINES) {
      const spot = placeCicada(USER_A, tree.treeId, line);
      assert.ok(
        spot.x - SPRITE_W / 2 >= 0 && spot.x + SPRITE_W / 2 <= CANVAS_W,
        `精灵横向出画：${JSON.stringify(spot)}`,
      );
      assert.ok(spot.y > 0 && spot.y < 760, `精灵纵向出画：${JSON.stringify(spot)}`);
    }
  }
});

test("同一片森林每次算出同一个落点——精灵不能每次跳不同地方", () => {
  for (const tree of USER_A) {
    const a = placeCicada(USER_A, tree.treeId, LINES[0]);
    const b = placeCicada(USER_A, tree.treeId, LINES[0]);
    assert.deepEqual(a, b);
  }
});
