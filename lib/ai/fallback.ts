/**
 * AI 三件套的**确定性降级生成**（契约 §5 要求每项都有降级策略）。
 *
 * 用途：当 `mock-data/ai/` 下的模型产物缺失或损坏时，路由改用这里的规则版结果，
 * 保证接口永远不 500、页面永远不空。
 *
 * 这里不调用任何模型，全部由真实数据推导（兴趣分布、事件差分、内容质量），
 * 所以降级结果依然是"从你的真实收藏里算出来的"，只是文字不如模型灵动。
 */
import { CATEGORY_LABELS } from "@/lib/contract";
import type {
  ContentItem,
  DiaryEntry,
  ForestState,
  PersonalityProfile,
  PhotosynthesisReport,
  TopicCategory,
} from "@/lib/contract";
import { dayIndexOf, dayToDate, forestAtDay } from "@/lib/replay";

/** 内容 → 所属树，用于把当天内容按树归拢 */
function contentToTree(forest: ForestState): Map<string, string> {
  const map = new Map<string, string>();
  for (const leaf of forest.leaves) {
    for (const id of leaf.contentIds) map.set(id, leaf.treeId);
  }
  return map;
}

function categoryWeights(contents: ContentItem[]): { category: TopicCategory; weight: number }[] {
  const counts = new Map<TopicCategory, number>();
  for (const c of contents) {
    if (!c.category) continue;
    counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((s, n) => s + n, 0) || 1;
  return [...counts.entries()]
    .map(([category, n]) => ({ category, weight: Math.round((n / total) * 100) }))
    .sort((a, b) => b.weight - a.weight);
}

/** 光合作用报告：某一天读了什么、长了多少 */
export function fallbackReport(
  userId: string,
  contents: ContentItem[],
  forest: ForestState,
  day: number,
): PhotosynthesisReport {
  const date = dayToDate(day);
  const owner = contentToTree(forest);

  const todays = contents.filter((c) => dayIndexOf(c.interactedAt) === day);
  const grouped = new Map<string, ContentItem[]>();
  for (const c of todays) {
    const treeId = owner.get(c.contentId);
    if (!treeId) continue;
    grouped.set(treeId, [...(grouped.get(treeId) ?? []), c]);
  }

  const leaves = forest.leaves.filter((l) => dayIndexOf(l.createdAt) === day);
  const trees = forest.trees.filter((t) => dayIndexOf(t.createdAt) === day);

  const highlights = [...grouped.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 4)
    .map(([treeId, items]) => {
      const tree = forest.trees.find((t) => t.treeId === treeId);
      const label = tree ? CATEGORY_LABELS[tree.category] : "其它";
      return {
        treeId,
        treeName: tree?.name ?? treeId,
        category: tree?.category ?? ("other" as TopicCategory),
        // 降级摘要：点出条数与最热门的标题，不做文学加工
        summary: `这天你在「${tree?.name ?? treeId}」下读了 ${items.length} 条${label}内容，其中《${items[0].title.replace(/\s*-\s*知乎$/, "")}》赞同数最高。`,
        contentIds: items.map((c) => c.contentId),
      };
    });

  const headline =
    highlights.length === 0
      ? `这天森林很安静，没有新的收藏落进来。`
      : highlights.length === 1
        ? `今天你在「${highlights[0].treeName}」的森林里走了很远。`
        : `今天你走过 ${highlights.length} 棵树，重心在「${highlights[0].treeName}」。`;

  return {
    reportId: `report_${date.replace(/-/g, "")}`,
    userId,
    date,
    headline,
    highlights,
    stats: {
      newLeafCount: leaves.length,
      newTreeCount: trees.length,
      totalContentCount: grouped.size > 0 ? todays.length : 0,
    },
  };
}

/** 农夫日记：把一段时间内的森林变化翻译成拟人叙事 */
export function fallbackDiary(
  userId: string,
  contents: ContentItem[],
  forest: ForestState,
  periodStart: number,
  periodEnd: number,
  limit = 8,
): DiaryEntry[] {
  const before = forestAtDay(contents, forest, Math.max(1, periodStart - 1));
  const after = forestAtDay(contents, forest, periodEnd);
  const startDate = dayToDate(periodStart);
  const endDate = dayToDate(periodEnd);

  const prevTrees = new Map(before.trees.map((t) => [t.treeId, t]));
  const prevLeaves = new Map(before.leaves.map((l) => [l.leafId, l]));
  const entries: DiaryEntry[] = [];
  let seq = 0;
  const nextId = () => `entry_${endDate.replace(/-/g, "")}_${String(++seq).padStart(2, "0")}`;

  const base = {
    userId,
    createdAt: `${endDate}T22:00:00+08:00`,
    periodStart: `${startDate}T00:00:00+08:00`,
    periodEnd: `${endDate}T23:59:59+08:00`,
  };

  for (const tree of after.trees) {
    const prev = prevTrees.get(tree.treeId);
    if (!prev) {
      const leafIds = tree.leafIds;
      entries.push({
        ...base,
        entryId: nextId(),
        eventType: "newTree",
        treeId: tree.treeId,
        treeName: tree.name,
        leafIds,
        message: `你种下了一棵新树：「${tree.name}」。它还很矮，但已经站住了。`,
        suggestedAction: "water",
      });
      continue;
    }

    const gained = tree.totalContentCount - prev.totalContentCount;
    if (gained >= 3) {
      entries.push({
        ...base,
        entryId: nextId(),
        eventType: "surge",
        treeId: tree.treeId,
        treeName: tree.name,
        leafIds: tree.leafIds,
        message: `这段时间你对「${tree.name}」的关注猛地涨了起来，多吸收了 ${gained} 条内容。`,
        suggestedAction: "water",
      });
    }
  }

  for (const leaf of after.leaves) {
    const prev = prevLeaves.get(leaf.leafId);
    if (!prev) continue;
    if (prev.state === leaf.state) continue;

    if (prev.state === "fresh" && leaf.state !== "fresh") {
      entries.push({
        ...base,
        entryId: nextId(),
        eventType: "decay",
        treeId: leaf.treeId,
        treeName: forest.trees.find((t) => t.treeId === leaf.treeId)?.name ?? leaf.treeId,
        leafIds: [leaf.leafId],
        message: `「${leaf.name}」这阵子没人浇水，叶子开始打卷了。要不要回去看看？`,
        suggestedAction: "prune",
      });
    } else if (prev.state !== "fresh" && leaf.state === "fresh") {
      entries.push({
        ...base,
        entryId: nextId(),
        eventType: "revive",
        treeId: leaf.treeId,
        treeName: forest.trees.find((t) => t.treeId === leaf.treeId)?.name ?? leaf.treeId,
        leafIds: [leaf.leafId],
        message: `「${leaf.name}」又活过来了——你回去找它了。`,
        suggestedAction: "none",
      });
    }
  }

  return entries.slice(0, limit);
}

/** 兴趣画像：从分布与节奏里读性格 */
export function fallbackProfile(
  userId: string,
  contents: ContentItem[],
  forest: ForestState,
): PersonalityProfile {
  const topCategories = categoryWeights(contents);
  const top = topCategories[0];
  const withering = forest.leaves.filter((l) => l.state !== "fresh").length;

  return {
    userId,
    generatedAt: forest.generatedAt,
    // 演示用户的 displayName 本身就是人设标签（如「深潜型探索者」）
    soulType: forest.displayName,
    soulTypeEmoji: top ? EMOJI_BY_CATEGORY[top.category] : "🌱",
    description: `你的森林里有 ${forest.trees.length} 棵树、${forest.leaves.length} 片叶子。${top ? `注意力最集中的方向是「${CATEGORY_LABELS[top.category]}」，占了全部内容的 ${top.weight}%。` : ""}${withering > 0 ? `另外有 ${withering} 片叶子在枯萎——你曾经很在意，后来走开了。` : ""}`,
    traits: buildTraits(forest, topCategories),
    topCategories,
  };
}

const EMOJI_BY_CATEGORY: Record<TopicCategory, string> = {
  tech: "🤖",
  humanities: "📜",
  business: "📈",
  science: "🔬",
  life: "🌿",
  arts: "🎨",
  social: "👥",
  other: "🌱",
};

function buildTraits(
  forest: ForestState,
  topCategories: { category: TopicCategory; weight: number }[],
) {
  const top = topCategories[0];
  const oldest = [...forest.trees].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )[0];
  const biggest = [...forest.trees].sort(
    (a, b) => b.totalContentCount - a.totalContentCount,
  )[0];
  const dormant = forest.leaves.filter((l) => l.state === "withered").length;

  return [
    {
      label: "专注深潜",
      score: Math.min(100, top?.weight ?? 50),
      evidence: top
        ? `「${CATEGORY_LABELS[top.category]}」一个方向就占了全部内容的 ${top.weight}%。`
        : "内容分布比较平均。",
    },
    {
      label: "长期在场",
      score: Math.min(100, Math.round((forest.trees.length / 10) * 100)),
      evidence: `从 ${oldest?.createdAt.slice(0, 10) ?? "最早"} 起，你已经养着 ${forest.trees.length} 个主题。`,
    },
    {
      label: "阅读深度",
      score: Math.min(100, Math.round(((biggest?.totalContentCount ?? 0) / 30) * 100)),
      evidence: biggest ? `最深的一棵「${biggest.name}」积累了 ${biggest.totalContentCount} 条。` : "还没有特别深的树。",
    },
    {
      label: "兴趣流动",
      score: Math.min(100, Math.round((dormant / Math.max(1, forest.leaves.length)) * 100)),
      evidence: `${dormant} 片叶子已经枯萎，说明你的注意力在移动，而不是原地不动。`,
    },
  ].filter((t) => t.score > 0);
}
