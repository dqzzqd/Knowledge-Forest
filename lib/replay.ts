/**
 * 按天回放：由「最终森林 + 全部内容」推算第 N 天的森林。
 *
 * 纯函数、无副作用，服务端与客户端都能引用（不含 node:fs）。
 * 生长与凋零规则与 mock-data/build-dataset.js 完全一致，
 * 因此第 30 天的结果与 expected-forest/*.json 严格吻合。
 *
 *   叶片   state = (N - 最后活跃日) >= 8 → withered，>= 4 → fading，否则 fresh
 *   主题树 stage = 内容数 >= 15 → flourishing，>= 8 → mature，>= 4 → young，否则 sprout
 */
import type {
  ContentItem,
  ForestSnapshot,
  Leaf,
  LeafState,
  TopicTree,
  TreeStage,
} from "./contract";

const MS_PER_DAY = 86_400_000;
/** 第 1 天 = 2026-08-15 */
const DAY_ONE_UTC = Date.UTC(2026, 7, 15);

export const TOTAL_DAYS = 30;

/** 第 N 天（1 起）→ "2026-08-15" */
export function dayToDate(day: number): string {
  return new Date(DAY_ONE_UTC + (day - 1) * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

/**
 * ISO 时间戳 → 第几天（1..30）。
 * 数据里的时间戳自带 +08:00，取日期前缀即为当天，与生成器的
 * `interactedAt.startsWith(date)` 切片口径一致。
 */
export function dayIndexOf(iso: string): number {
  const t = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(t)) return 1;
  return Math.min(TOTAL_DAYS, Math.max(1, Math.round((t - DAY_ONE_UTC) / MS_PER_DAY) + 1));
}

function leafStateAt(lastDay: number, day: number): LeafState {
  const gap = day - lastDay;
  if (gap >= 8) return "withered";
  if (gap >= 4) return "fading";
  return "fresh";
}

function treeStageOf(contentCount: number): TreeStage {
  if (contentCount >= 15) return "flourishing";
  if (contentCount >= 8) return "mature";
  if (contentCount >= 4) return "young";
  return "sprout";
}

/**
 * 第 N 天的森林快照。
 *
 * @param contents 该用户的全部内容（含 interactedAt），来自 mock/user-*.json
 * @param forest   最终森林，提供树的骨架、叶的归属与布局坐标
 */
export function forestAtDay(
  contents: ContentItem[],
  forest: ForestSnapshot,
  day: number,
): ForestSnapshot {
  const byId = new Map(contents.map((c) => [c.contentId, c]));

  // 每片叶子只保留第 N 天（含）之前互动过的内容；一条都没有 = 还没长出来
  const grown = new Map<string, { ids: string[]; first: number; last: number }>();
  for (const leaf of forest.leaves) {
    const ids: string[] = [];
    let first = TOTAL_DAYS;
    let last = 1;
    for (const id of leaf.contentIds) {
      const item = byId.get(id);
      if (!item) continue;
      const d = dayIndexOf(item.interactedAt);
      if (d > day) continue;
      ids.push(id);
      if (d < first) first = d;
      if (d > last) last = d;
    }
    if (ids.length > 0) grown.set(leaf.leafId, { ids, first, last });
  }

  const leaves: Leaf[] = [];
  for (const leaf of forest.leaves) {
    const g = grown.get(leaf.leafId);
    if (!g) continue;
    leaves.push({
      ...leaf,
      contentIds: g.ids,
      state: leafStateAt(g.last, day),
      createdAt: `${dayToDate(g.first)}T10:00:00+08:00`,
      lastActiveAt: `${dayToDate(g.last)}T22:00:00+08:00`,
    });
  }

  const trees: TopicTree[] = [];
  for (const tree of forest.trees) {
    const own = leaves.filter((l) => l.treeId === tree.treeId);
    if (own.length === 0) continue;
    const count = own.reduce((s, l) => s + l.contentIds.length, 0);
    const lastDay = own.reduce(
      (m, l) => Math.max(m, dayIndexOf(l.lastActiveAt)),
      1,
    );
    trees.push({
      ...tree,
      leafIds: own.map((l) => l.leafId),
      totalContentCount: count,
      stage: treeStageOf(count),
      createdAt: own.reduce(
        (m, l) => (l.createdAt < m ? l.createdAt : m),
        own[0].createdAt,
      ),
      lastGrownAt: `${dayToDate(lastDay)}T22:00:00+08:00`,
    });
  }

  const visibleTrees = new Set(trees.map((t) => t.treeId));
  return {
    ...forest,
    generatedAt: `${dayToDate(day)}T22:00:00+08:00`,
    trees,
    leaves,
    layout: forest.layout.filter((l) => visibleTrees.has(l.treeId)),
  };
}

export type ReplayEventKind = "newTree" | "surge" | "decay" | "revive";

export interface ReplayEvent {
  kind: ReplayEventKind;
  label: string;
}

/** 对比相邻两天，得出「这天发生了什么」 */
export function eventsAtDay(
  prev: ForestSnapshot | null,
  cur: ForestSnapshot,
): ReplayEvent[] {
  const out: ReplayEvent[] = [];

  if (!prev) {
    return cur.trees.length > 0
      ? [{ kind: "newTree", label: `「${cur.trees[0].name}」种下了第一棵树` }]
      : out;
  }

  const prevTreeIds = new Set(prev.trees.map((t) => t.treeId));
  for (const t of cur.trees) {
    if (!prevTreeIds.has(t.treeId)) {
      out.push({ kind: "newTree", label: `新主题「${t.name}」萌芽` });
    }
  }

  const prevCount = new Map(prev.trees.map((t) => [t.treeId, t.totalContentCount]));
  for (const t of cur.trees) {
    const before = prevCount.get(t.treeId);
    if (before === undefined) continue;
    const delta = t.totalContentCount - before;
    if (delta >= 3) out.push({ kind: "surge", label: `「${t.name}」一天吸收 ${delta} 条` });
  }

  const prevState = new Map(prev.leaves.map((l) => [l.leafId, l.state]));
  for (const l of cur.leaves) {
    const before = prevState.get(l.leafId);
    if (before === undefined || before === l.state) continue;
    if (before === "fresh") out.push({ kind: "decay", label: `「${l.name}」开始枯萎` });
    else if (l.state === "fresh") out.push({ kind: "revive", label: `「${l.name}」复苏了` });
  }

  return out;
}

/** 某一帧的森林概览 */
export function replayStats(forest: ForestSnapshot) {
  return {
    trees: forest.trees.length,
    leaves: forest.leaves.length,
    contents: forest.trees.reduce((s, t) => s + t.totalContentCount, 0),
    fading: forest.leaves.filter((l) => l.state === "fading").length,
    withered: forest.leaves.filter((l) => l.state === "withered").length,
  };
}
