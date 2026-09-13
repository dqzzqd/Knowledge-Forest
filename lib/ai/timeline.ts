import type { ContentItem, DiaryEntry, DiaryEventType, ForestSnapshot } from "@/lib/contract";
import { forestAtDay } from "@/lib/replay";

/**
 * 给农夫日记条目回算「这件事发生在第几天」。
 *
 * 产物里只有 createdAt / periodStart / periodEnd，没有逐条日期——因为契约 §5.3 的
 * 变化检测是**按时间段对比两端**得出事件的，本身不知道发生在段内哪一天。
 * 但日记的时间轴要立得住就必须有真实日期，所以这里按同一套判定口径逐天扫一遍。
 *
 * 回算不出来时 `day` 为 null（页面只显示时段，不编日期）。
 */

export interface DatedDiaryEntry extends DiaryEntry {
  /** 事件发生在第几天（1..30）；无法回算时为 null */
  day: number | null;
}

function findEventDay(
  entry: DiaryEntry,
  contents: ContentItem[],
  forest: ForestSnapshot,
  from: number,
  to: number,
): number | null {
  if (entry.eventType === "surge") {
    return findBusiestDay(entry.treeId, contents, forest, from, to);
  }

  for (let day = from; day <= to; day++) {
    const before = forestAtDay(contents, forest, day - 1);
    const after = forestAtDay(contents, forest, day);

    if (entry.eventType === "newTree") {
      const had = before.trees.some((t) => t.treeId === entry.treeId);
      const has = after.trees.some((t) => t.treeId === entry.treeId);
      if (!had && has) return day;
      continue;
    }

    const leafId = entry.leafIds[0];
    if (!leafId) return null;
    const b = before.leaves.find((l) => l.leafId === leafId);
    const a = after.leaves.find((l) => l.leafId === leafId);
    if (!b || !a || b.state === a.state) continue;

    if (entry.eventType === "decay" && b.state === "fresh") return day;
    if (entry.eventType === "revive" && a.state === "fresh") return day;
  }
  return null;
}

/**
 * 「爆发」在产物里是整段时间的累计增涨（可能摊在多天），单日未必达到阈值。
 * 取窗内单日增涨最多的一天作为爆发日——那天确实是长得最猛的一天。
 */
function findBusiestDay(
  treeId: string,
  contents: ContentItem[],
  forest: ForestSnapshot,
  from: number,
  to: number,
): number | null {
  const countOn = (day: number) =>
    forestAtDay(contents, forest, day).trees.find((t) => t.treeId === treeId)
      ?.totalContentCount ?? 0;

  let best: number | null = null;
  let bestGain = 0;
  let previous = countOn(from - 1);
  for (let day = from; day <= to; day++) {
    const current = countOn(day);
    const gain = current - previous;
    if (gain > bestGain) {
      bestGain = gain;
      best = day;
    }
    previous = current;
  }
  return bestGain > 0 ? best : null;
}

export function withEventDays(
  entries: DiaryEntry[],
  contents: ContentItem[],
  forest: ForestSnapshot,
  fromDay: number,
  toDay: number,
): DatedDiaryEntry[] {
  return entries
    .map((entry) => ({
      ...entry,
      day: findEventDay(entry, contents, forest, fromDay, toDay),
    }))
    .sort(compareByDay);
}

/**
 * 时间轴必须按时间排。产物是「先全部爆发、再全部凋零」的生成顺序，
 * 直接渲染会得到 09-05 → 08-26 → 08-24 这种倒错的顺序。
 * 同一天内按 新树 → 爆发 → 复苏 → 凋零 读起来最顺（先立后破）。
 */
const EVENT_ORDER: Record<DiaryEventType, number> = {
  newTree: 0,
  surge: 1,
  revive: 2,
  decay: 3,
};

function compareByDay(a: DatedDiaryEntry, b: DatedDiaryEntry): number {
  // 回算不出日期的条目沉到末尾，不污染时间轴
  if (a.day === null && b.day === null) return EVENT_ORDER[a.eventType] - EVENT_ORDER[b.eventType];
  if (a.day === null) return 1;
  if (b.day === null) return -1;
  return a.day - b.day || EVENT_ORDER[a.eventType] - EVENT_ORDER[b.eventType];
}
