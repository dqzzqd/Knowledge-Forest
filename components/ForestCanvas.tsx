"use client";

import { useMemo, useState } from "react";
import Cicada from "@/components/Cicada";
import { atmosphereFor, type Atmosphere } from "@/lib/atmosphere";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  STAGE_LABELS,
  STATE_LABELS,
  type CicadaState,
  type FeedbackAction,
  type ForestSnapshot,
  type Leaf,
} from "@/lib/contract";

/**
 * 森林场景。
 *
 * 「写实」靠两件事：**水彩树插画**（public/tree-*.webp，已抠底）+ **分层景深**
 * （远山→林地→树，远的更小更淡，近的更大更实）。不是 3D——
 * 《项目交接简报》明确否掉了 3D，风格定的是"治愈系手绘、好看第一位"。
 */

const W = 1200;
const H = 760;
/** 地平线：天空占上面三分之一左右，再高就把树挤到 UI 里去了 */
const HORIZON = 250;
/** 树基线的纵向范围：越靠下 = 离你越近。
 *  下界刻意收在 560，好给底部的回放条留出前景草地，
 *  否则最大的那棵树会被条挡住。 */
const BASE_FAR = 340;
const BASE_NEAR = 560;
/** 树的基准宽度，再按内容量与景深放大 */
const TREE_BASE_W = 150;
/** 相邻两棵树的中心至少要隔开「半径和 × 这个系数」；略小于 1 是允许一点交叠做景深 */
const MIN_GAP = 0.82;
const GOLDEN_ANGLE = 2.399963;

/** 三张水彩树：宽高比写死，画的时候按高算宽才不会拉伸 */
const TREE_ART = [
  { src: "/tree-a.webp", ratio: 950 / 792 },
  { src: "/tree-b.webp", ratio: 1160 / 917 },
  { src: "/tree-c.webp", ratio: 1375 / 956 },
];

/**
 * 树 → 配图。
 *
 * **必须按 treeId 定，不能按数组下标**：回放时每一帧传进来的森林只含
 * "当天已经长出来的树"，下标会变——同一棵树会随着生长换一张图。
 * treeId 按契约跨天稳定，所以拿它做确定性哈希。
 */
function artIndexFor(treeId: string): number {
  let hash = 0;
  for (let i = 0; i < treeId.length; i++) {
    hash = (hash * 31 + treeId.charCodeAt(i)) >>> 0;
  }
  return hash % TREE_ART.length;
}

const clamp = (v: number, min: number, max: number) =>
  max < min ? v : Math.min(max, Math.max(min, v));

interface PlacedLeaf extends Leaf {
  cx: number;
  cy: number;
  rot: number;
  size: number;
  /** 所属大类：卡片上要写出来，替代原来的图例 */
  category: keyof typeof CATEGORY_COLORS;
}

interface PlacedTree {
  treeId: string;
  name: string;
  category: keyof typeof CATEGORY_COLORS;
  stage: keyof typeof STAGE_LABELS;
  total: number;
  art: number;
  x: number;
  y: number;
  width: number;
  height: number;
  canopyY: number;
  canopyRx: number;
  canopyRy: number;
  opacity: number;
  leaves: PlacedLeaf[];
}

/** 叶形：一个尖头椭圆，参数化大小 */
function leafPath(s: number): string {
  return `M 0 ${-s} C ${s * 0.66} ${-s * 0.42}, ${s * 0.66} ${s * 0.42}, 0 ${s} C ${-s * 0.66} ${s * 0.42}, ${-s * 0.66} ${-s * 0.42}, 0 ${-s} Z`;
}

function buildScene(forest: ForestSnapshot): PlacedTree[] {
  // 第一遍：每棵树的尺寸与初始落点
  const boxes = forest.layout
    .map((layout) => {
      const tree = forest.trees.find((t) => t.treeId === layout.treeId);
      if (!tree) return null;

      // layout.y 当景深用：0 = 远，1 = 近
      const depth = clamp(layout.y, 0, 1);
      const scale = 0.62 + depth * 0.58;

      // 按**宽度**定尺寸而不是高度：三张图宽高比差得多（1.2 对 1.44），
      // 按高度算会让宽的那张占地过大，几棵树糊成一坨。
      const art = TREE_ART[artIndexFor(tree.treeId)];
      const width =
        (TREE_BASE_W + Math.min(tree.totalContentCount, 30) * 4.6) * scale;
      const height = width / art.ratio;
      const baseY = BASE_FAR + depth * (BASE_NEAR - BASE_FAR);

      return {
        tree,
        depth,
        art: artIndexFor(tree.treeId),
        width,
        height,
        baseY,
        x: (0.10 + layout.x * 0.80) * W,
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  // 第二遍：横向让位。布局给的 x 有的挨得很近，加上树的宽度就会互相压住——
  // 曾经把最大那棵的树名整块盖掉。从左往右依次推开。
  const byX = boxes.map((b) => ({ ...b })).sort((a, b) => a.x - b.x);
  for (let i = 1; i < byX.length; i++) {
    const gap = ((byX[i - 1].width + byX[i].width) / 2) * MIN_GAP;
    const need = byX[i - 1].x + gap;
    if (byX[i].x < need) byX[i].x = need;
  }
  // 推开后整排可能越界，一起平移回来再夹紧
  const last = byX[byX.length - 1];
  const overflow = last ? last.x + last.width / 2 + 6 - W : 0;
  for (const b of byX) {
    b.x = clamp(
      b.x - Math.max(0, overflow),
      b.width / 2 + 6,
      W - b.width / 2 - 6,
    );
  }

  // 第三遍：按最终的 x 算树冠与叶子
  return byX
    .map((b) => {
      const { tree } = b;
      // 树冠：树叶撒在这个椭圆里
      const canopyY = b.baseY - b.height * 0.63;
      const canopyRx = b.width * 0.29;
      const canopyRy = b.height * 0.23;

      const own = forest.leaves.filter((l) => l.treeId === tree.treeId);
      const leaves: PlacedLeaf[] = own.map((leaf, i) => {
        const n = Math.max(own.length, 1);
        const angle = i * GOLDEN_ANGLE;
        const r = Math.sqrt((i + 0.5) / n);
        return {
          ...leaf,
          cx: b.x + canopyRx * r * Math.cos(angle),
          cy: canopyY + canopyRy * r * Math.sin(angle),
          // 每片叶子定个朝向，散得自然些
          rot: ((i * 137.5) % 360) - 180,
          size: 5 + Math.min(leaf.contentIds.length, 12) * 0.55,
          category: tree.category,
        };
      });

      return {
        treeId: tree.treeId,
        name: tree.name,
        category: tree.category,
        stage: tree.stage,
        total: tree.totalContentCount,
        art: b.art,
        x: b.x,
        y: b.baseY - b.height,
        width: b.width,
        height: b.height,
        canopyY,
        canopyRx,
        canopyRy,
        // 空气透视：远的淡一点
        opacity: 0.82 + b.depth * 0.18,
        leaves,
      };
    })
    // 远的先画，近的压在上面，层次才对
    .sort((a, b) => a.y - b.y);
}

/** 枯萎/凋零时叶片转成枯色 */
function leafTone(leaf: Leaf) {
  if (leaf.state === "withered") return { fill: "#B8A88A", opacity: 0.55 };
  if (leaf.state === "fading") return { fill: "#C9BC93", opacity: 0.75 };
  return { fill: null, opacity: 0.9 };
}

/** 用户对某片叶子表态：浇水（想继续看）或修剪（不感兴趣） */
export type FeedbackHandler = (
  leafId: string,
  treeId: string,
  action: FeedbackAction,
) => void;

export default function ForestCanvas({
  forest,
  cicada,
  onFeedback,
  feedbackPending = false,
  hour = 12,
}: {
  forest: ForestSnapshot;
  /** 后端算好的精灵状态；不传就不画精灵（回放各帧没有精灵） */
  cicada?: CicadaState;
  /** 不传就不给操作入口（回放的是历史帧，改不了） */
  onFeedback?: FeedbackHandler;
  feedbackPending?: boolean;
  /** 当前小时（0–23），决定昼夜氛围。由服务端算好传下来 */
  hour?: number;
}) {
  const atm = useMemo(() => atmosphereFor(hour), [hour]);
  // 只记 leafId，不存整个对象——回放时 forest 每帧都变，
  // 存对象会让卡片停留在旧的一天（叶子已消失却还在显示）。
  const [activeId, setActiveId] = useState<string | null>(null);
  const trees = useMemo(() => buildScene(forest), [forest]);

  const active = useMemo(() => {
    if (!activeId) return null;
    for (const t of trees) {
      const found = t.leaves.find((l) => l.leafId === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, trees]);

  // 精灵落在目标树冠的右上方；夹取是因为画布上缘会切掉高树
  const cicadaAnchor = useMemo(() => {
    if (!cicada) return null;
    const target = cicada.targetTreeId
      ? trees.find((t) => t.treeId === cicada.targetTreeId)
      : undefined;
    if (!target) return { x: W / 2, y: HORIZON * 0.5 };
    return {
      x: clamp(target.x + target.width * 0.36, 70, W - 70),
      y: Math.max(HORIZON * 0.34, target.canopyY - target.height * 0.2),
    };
  }, [cicada, trees]);

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full select-none"
        role="img"
        aria-label="知了森林"
      >
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={atm.sky[0]} />
            <stop offset="52%" stopColor={atm.sky[1]} />
            <stop offset="100%" stopColor={atm.sky[2]} />
          </linearGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={atm.ground[0]} />
            <stop offset="100%" stopColor={atm.ground[1]} />
          </linearGradient>
          <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={atm.light} stopOpacity={atm.lightOpacity} />
            <stop offset="100%" stopColor={atm.light} stopOpacity="0" />
          </radialGradient>
          <filter id="haze" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>

        {/* 天空 */}
        <rect width={W} height={H} fill="url(#sky)" />
        {/* 斜上方的光，给画面一个光源 */}
        <ellipse cx={W * 0.26} cy={HORIZON * 0.34} rx={W * 0.4} ry={HORIZON * 0.5} fill="url(#sun)" />

        {/* 远山：三层，越远越淡（空气透视）。颜色跟着时段走 */}
        <path
          d={`M0 ${HORIZON} Q ${W * 0.16} ${HORIZON - 96} ${W * 0.38} ${HORIZON - 26}
              T ${W * 0.72} ${HORIZON - 54} T ${W} ${HORIZON - 16}
              L ${W} ${HORIZON + 60} L 0 ${HORIZON + 60} Z`}
          fill={atm.hill}
          opacity={0.34}
          filter="url(#haze)"
        />
        <path
          d={`M0 ${HORIZON + 6} Q ${W * 0.24} ${HORIZON - 62} ${W * 0.5} ${HORIZON + 4}
              T ${W} ${HORIZON - 34} L ${W} ${HORIZON + 70} L 0 ${HORIZON + 70} Z`}
          fill={atm.hill}
          opacity={0.26}
          filter="url(#haze)"
        />
        <path
          d={`M0 ${HORIZON + 26} Q ${W * 0.34} ${HORIZON - 24} ${W * 0.62} ${HORIZON + 30}
              T ${W} ${HORIZON + 12} L ${W} ${HORIZON + 80} L 0 ${HORIZON + 80} Z`}
          fill={atm.hill}
          opacity={0.4}
        />

        {/* 林地 */}
        <path
          d={`M0 ${HORIZON + 46} Q ${W * 0.5} ${HORIZON - 6} ${W} ${HORIZON + 58}
              L ${W} ${H} L 0 ${H} Z`}
          fill="url(#ground)"
        />

        {/* 树：远的先画 */}
        {trees.map((tree) => (
          <TreeShape
            key={tree.treeId}
            tree={tree}
            onLeaf={(l) => setActiveId(l?.leafId ?? null)}
            activeId={active?.leafId ?? null}
          />
        ))}

        {/* 树名统一压在最后，不会被别的树盖住 */}
        {trees.map((tree) => (
          <TreeLabel key={tree.treeId} tree={tree} atm={atm} />
        ))}

        {/* 换光：叠一层色罩。树还是那棵树，只是换了光线——
            直接改插画配色的话，一到夜里就糊了 */}
        <rect
          width={W}
          height={H}
          fill={atm.tint}
          opacity={atm.tintOpacity}
          pointerEvents="none"
        />
        {atm.stars > 0 ? <Stars opacity={atm.stars} /> : null}

        {/* 精灵画在最后 = 叠在最上层，且**在色罩之上**——
            夜里它是唯一还亮着的东西（技术设计 §5.1） */}
        {cicada && cicadaAnchor ? (
          <Cicada cicada={cicada} anchor={cicadaAnchor} canvasWidth={W} />
        ) : null}
      </svg>

      {/* 图例：挪到天区正中，避开两角的气泡；压得很轻，只做说明 */}
      <div className="pointer-events-none absolute inset-x-0 top-[13%] flex justify-center px-3">
        <Legend />
      </div>

      <LeafCard
        leaf={active}
        onClose={() => setActiveId(null)}
        onFeedback={onFeedback}
        pending={feedbackPending}
      />

      {/* 台词是信息，不能只画进 SVG：父级 svg 是 role="img"，
          里面的文字辅助技术读不到，所以另起一个 live region 播报。 */}
      {cicada ? (
        <p className="sr-only" aria-live="polite">
          {cicada.line}
        </p>
      ) : null}
    </div>
  );
}

function TreeShape({
  tree,
  onLeaf,
  activeId,
}: {
  tree: PlacedTree;
  onLeaf: (l: PlacedLeaf | null) => void;
  activeId: string | null;
}) {
  const baseColor = CATEGORY_COLORS[tree.category];
  const isDim = activeId !== null && !tree.leaves.some((l) => l.leafId === activeId);

  return (
    <g opacity={isDim ? 0.75 : 1} className="transition-opacity duration-200">
      {/* 树影：贴在草地上，让树"站"进去 */}
      <ellipse
        cx={tree.x}
        cy={tree.y + tree.height}
        rx={tree.width * 0.34}
        ry={tree.height * 0.05}
        fill="#7f9a72"
        opacity={0.22 * tree.opacity}
      />

      {/* 树冠底下的颜色光晕：把大类颜色带进画面，但不盖住插画 */}
      <ellipse
        cx={tree.x}
        cy={tree.canopyY}
        rx={tree.canopyRx * 1.16}
        ry={tree.canopyRy * 1.3}
        fill={baseColor}
        opacity={0.1}
        filter="url(#haze)"
      />

      <image
        href={TREE_ART[tree.art].src}
        x={tree.x - tree.width / 2}
        y={tree.y}
        width={tree.width}
        height={tree.height}
        opacity={tree.opacity}
        preserveAspectRatio="xMidYMid meet"
      />

      {/* 树叶：每个小主题一片 */}
      {tree.leaves.map((leaf) => {
        const tone = leafTone(leaf);
        const fill = tone.fill ?? baseColor;
        const isActive = leaf.leafId === activeId;
        return (
          <g
            key={leaf.leafId}
            className="cursor-pointer"
            onMouseEnter={() => onLeaf(leaf)}
            onClick={() => onLeaf(leaf)}
          >
            {/* 命中区，比叶子本身大得多，好点 */}
            <circle cx={leaf.cx} cy={leaf.cy} r={22} fill="transparent" />
            <path
              d={leafPath(leaf.size * (isActive ? 1.4 : 1))}
              transform={`translate(${leaf.cx} ${leaf.cy}) rotate(${leaf.rot})`}
              fill={fill}
              opacity={isActive ? 1 : tone.opacity * tree.opacity}
              stroke={isActive ? "#2F3A2E" : "rgba(255,255,255,.62)"}
              strokeWidth={isActive ? 1.5 : 1}
            />
          </g>
        );
      })}
    </g>
  );
}

/**
 * 树名单独一层画。
 * 之前树名跟着各自的树画，结果被更近的树整块盖住（最大那棵的名字就丢过）。
 * 现在所有树画完再统一画名字，谁也不会挡住谁。
 * 描一圈浅色底，压在草地上也读得清。
 */
function TreeLabel({ tree, atm }: { tree: PlacedTree; atm: Atmosphere }) {
  const baseY = tree.y + tree.height;
  const outline = {
    stroke: atm.labelStroke,
    strokeWidth: 3.5,
    paintOrder: "stroke" as const,
  };
  return (
    <g aria-hidden="true">
      <text
        x={tree.x}
        y={baseY + 26}
        textAnchor="middle"
        fontSize={16}
        fontWeight={600}
        fill={atm.labelFill}
        {...outline}
      >
        {tree.name}
      </text>
      <text
        x={tree.x}
        y={baseY + 45}
        textAnchor="middle"
        fontSize={12}
        fill={atm.labelFill}
        opacity={0.82}
        {...outline}
      >
        {tree.total} 条 · {STAGE_LABELS[tree.stage]}
      </text>
    </g>
  );
}

/** 星空：只在夜里画。位置用三角函数算，**不能用 Math.random**——
 *  服务端和客户端得画出同一片天，否则会 hydration 不一致。 */
function Stars({ opacity }: { opacity: number }) {
  const stars = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        x: (((i * 137.508) % 100) / 100) * W,
        y: (((i * 61.803) % 46) / 100) * HORIZON,
        r: 0.8 + ((i * 7) % 5) * 0.32,
        o: 0.3 + ((i * 3) % 6) * 0.1,
      })),
    [],
  );
  return (
    <g pointerEvents="none" opacity={opacity}>
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#F4F8FF" opacity={s.o} />
      ))}
    </g>
  );
}

function LeafCard({
  leaf,
  onClose,
  onFeedback,
  pending,
}: {
  leaf: PlacedLeaf | null;
  onClose: () => void;
  onFeedback?: FeedbackHandler;
  pending: boolean;
}) {
  if (!leaf) {
    return (
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-xl bg-white/85 px-4 py-2 text-center text-sm text-stone-500 backdrop-blur sm:bottom-[5.5rem] sm:left-5 sm:right-auto sm:text-left">
        点一片叶子，看看你收藏了什么
      </div>
    );
  }

  // 叶子本身已经带着大类颜色，把大类名写出来，就省掉了单独的图例
  return (
    <div className="absolute bottom-3 left-3 right-3 rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:bottom-[5.5rem] sm:left-5 sm:right-auto sm:w-80">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-stone-800">{leaf.name}</h3>
        <button
          onClick={onClose}
          className="text-lg leading-none text-stone-400 hover:text-stone-600"
          aria-label="关闭"
        >
          ×
        </button>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-stone-400">
        <span
          className="mr-0.5 inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: CATEGORY_COLORS[leaf.category] }}
          aria-hidden="true"
        />
        {CATEGORY_LABELS[leaf.category]} · {STATE_LABELS[leaf.state]} · 关联{" "}
        {leaf.contentIds.length} 条内容
        {leaf.waterCount > 0 ? ` · 已浇过 ${leaf.waterCount} 次` : ""}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">{leaf.summary}</p>

      {onFeedback ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => onFeedback(leaf.leafId, leaf.treeId, "water")}
            className="flex-1 rounded-full bg-[#5BA87A] px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#4E9669] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#2F5541] disabled:cursor-not-allowed disabled:opacity-50"
          >
            浇点水
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onFeedback(leaf.leafId, leaf.treeId, "prune")}
            className="flex-1 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-stone-600 ring-1 ring-stone-300 transition-colors hover:bg-stone-50 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#2F5541] disabled:cursor-not-allowed disabled:opacity-50"
          >
            修剪掉
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Legend() {
  return (
    <div className="pointer-events-none flex flex-wrap justify-end gap-x-3 gap-y-1 px-2 text-[11px] text-stone-400">
      {Object.entries(CATEGORY_COLORS)
        .filter(([k]) => k !== "other")
        .map(([k, c]) => (
          <span key={k} className="flex items-center gap-1">
            <i
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: c }}
            />
            {CATEGORY_LABELS[k as keyof typeof CATEGORY_LABELS]}
          </span>
        ))}
    </div>
  );
}
