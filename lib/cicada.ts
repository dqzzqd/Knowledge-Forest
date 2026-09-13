/**
 * 知了精灵的"大脑"：决定它此刻该做什么、去哪棵树、说什么。
 *
 * 契约 §3 把 `cicada` 放在 ForestState 上，技术设计 §5.3 则明确
 * "精灵行为由数据驱动，前端只做插值与播放，不做决策"——所以决策在这里，
 * 是一个纯函数，不是前端的一堆 if。
 *
 * 两条驱动路径：
 *   反应式——用户刚浇过水/修剪过，精灵飞过去应答（有 feedback 时）
 *   主动式——没人操作时精灵自己巡视，先救还救得回来的（fading），
 *           没救了才去清理（sweep），一切安好就待机（idle）
 *
 * 全程无随机：多片叶子同样紧急时按 leafId 定序。理由与布局算法拒绝力导向相同
 * （技术设计 §7.2）——每次跳不同位置会破坏"这座森林是稳定的"这一观感。
 */
import type {
  CicadaState,
  FeedbackRequest,
  ForestSnapshot,
  Leaf,
} from "./contract";

export function deriveCicada(
  forest: ForestSnapshot,
  now: string,
  feedback?: FeedbackRequest,
): CicadaState {
  return feedback
    ? reactTo(forest, now, feedback)
    : patrol(forest, now);
}

/** 应答刚发生的反馈 */
function reactTo(
  forest: ForestSnapshot,
  now: string,
  feedback: FeedbackRequest,
): CicadaState {
  const name = treeName(forest, feedback.treeId);

  if (feedback.action === "water") {
    return {
      action: "water",
      targetTreeId: feedback.treeId,
      line: `「${name}」喝饱水啦，叶子亮晶晶的～`,
      updatedAt: now,
    };
  }

  return {
    action: "prune",
    targetTreeId: feedback.treeId,
    line: `「${name}」修剪好啦，这块地方留给更想看的～`,
    updatedAt: now,
  };
}

/** 无人操作时的自主巡视 */
function patrol(forest: ForestSnapshot, now: string): CicadaState {
  const fading = forest.leaves.filter((l) => l.state === "fading");
  if (fading.length > 0) {
    const target = [...fading].sort(byUrgency)[0];
    return {
      action: "fly",
      targetTreeId: target.treeId,
      line: `「${target.name}」好久没浇水了，要不要回去看看？`,
      updatedAt: now,
    };
  }

  const withered = forest.leaves.filter((l) => l.state === "withered");
  if (withered.length > 0) {
    return {
      action: "sweep",
      targetTreeId: withered[0].treeId,
      line: `有些叶子已经枯了，我来扫一扫～`,
      updatedAt: now,
    };
  }

  return {
    action: "idle",
    targetTreeId: null,
    line: `今天森林很安静，我在这儿守着～`,
    updatedAt: now,
  };
}

/** 最久没动的排前面——它最急着被想起；完全并列时按 leafId 定序 */
function byUrgency(a: Leaf, b: Leaf): number {
  return a.lastActiveAt.localeCompare(b.lastActiveAt) || a.leafId.localeCompare(b.leafId);
}

function treeName(forest: ForestSnapshot, treeId: string): string {
  return forest.trees.find((t) => t.treeId === treeId)?.name ?? treeId;
}
