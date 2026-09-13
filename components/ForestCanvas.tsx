"use client";

import { useMemo, useState } from "react";
import Cicada from "@/components/Cicada";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  STAGE_LABELS,
  STATE_LABELS,
  type CicadaState,
  type ForestSnapshot,
  type Leaf,
  type TreeLayout,
} from "@/lib/contract";

/** 画布尺寸：宽大于高，减少留白 */
const W = 1000;
const H = 700;
const GROUND_Y = 600;
const GOLDEN_ANGLE = 2.399963;

/** 一棵「小主题」上的内容条数 → 渲染成多少片小叶 */
const miniLeafCount = (leaf: Leaf) => Math.max(3, Math.min(leaf.contentIds.length, 9));

interface MiniLeaf {
  dx: number;
  dy: number;
  rot: number;
}

interface PlacedLeaf extends Leaf {
  cx: number;
  cy: number;
  minis: MiniLeaf[];
}

interface PlacedTree {
  layout: TreeLayout;
  name: string;
  category: keyof typeof CATEGORY_COLORS;
  stage: keyof typeof STAGE_LABELS;
  total: number;
  leaves: PlacedLeaf[];
  baseX: number;
  baseY: number;
  crownY: number;
  crownR: number;
}

/** 把 0-1 归一化坐标映射到画面中「树应该站的位置」 */
const mapX = (x: number) => (0.10 + x * 0.80) * W;
const mapY = (y: number) => (0.30 + y * 0.42) * H;

function buildTrees(forest: ForestSnapshot): PlacedTree[] {
  return forest.layout.map((layout) => {
    const tree = forest.trees.find((t) => t.treeId === layout.treeId)!;
    const leaves = forest.leaves.filter((l) => l.treeId === layout.treeId);

    const baseX = mapX(layout.x);
    const baseY = mapY(layout.y);

    // 树冠随内容量增长，但封顶，避免大树溢出画布
    const crownR = 62 * layout.scale * (1 + Math.min(tree.totalContentCount, 30) / 45);
    const trunkH = crownR * 0.95;
    const crownY = baseY - trunkH;

    const placed: PlacedLeaf[] = leaves.map((leaf, i) => {
      const angle = i * GOLDEN_ANGLE;
      const radius =
        crownR * Math.sqrt((i + 0.5) / Math.max(leaves.length, 1)) * 0.78;
      const cx = baseX + radius * Math.cos(angle);
      const cy = crownY + radius * Math.sin(angle) * 0.8;

      // 每片「小主题」内部，把内容条数渲染成一小簇叶子
      const n = miniLeafCount(leaf);
      const clusterR = 12 + Math.min(n, 9) * 2.2;
      const minis: MiniLeaf[] = Array.from({ length: n }, (_, k) => {
        const a = k * GOLDEN_ANGLE + i;
        const r = clusterR * Math.sqrt((k + 0.5) / n);
        return { dx: r * Math.cos(a), dy: r * Math.sin(a) * 0.85, rot: (a * 180) / Math.PI };
      });

      return { ...leaf, cx, cy, minis };
    });

    return {
      layout,
      name: tree.name,
      category: tree.category,
      stage: tree.stage,
      total: tree.totalContentCount,
      leaves: placed,
      baseX,
      baseY,
      crownY,
      crownR,
    };
  });
}

/** 枯萎/凋零时叶片变色 */
function leafTone(leaf: Leaf) {
  if (leaf.state === "withered") return { fill: "#B8A88A", opacity: 0.6 };
  if (leaf.state === "fading") return { fill: "#C9BC93", opacity: 0.8 };
  return { fill: null, opacity: 1 };
}

export default function ForestCanvas({
  forest,
  cicada,
}: {
  forest: ForestSnapshot;
  /** 后端算好的精灵状态；不传就不画精灵（回放各帧没有精灵） */
  cicada?: CicadaState;
}) {
  // 只记 leafId，不存整个对象——回放时 forest 每帧都变，
  // 存对象会让卡片停留在旧的一天（叶子已消失却还在显示）。
  const [activeId, setActiveId] = useState<string | null>(null);
  const trees = useMemo(() => buildTrees(forest), [forest]);

  const active = useMemo(() => {
    if (!activeId) return null;
    for (const t of trees) {
      const found = t.leaves.find((l) => l.leafId === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, trees]);

  // 精灵落点：站在目标树冠的右上方。夹取是因为画布上缘会切掉高树，
  // 精灵飘出去就再也看不见了。
  const cicadaAnchor = useMemo(() => {
    if (!cicada) return null;
    const target = cicada.targetTreeId
      ? trees.find((t) => t.layout.treeId === cicada.targetTreeId)
      : undefined;
    if (!target) return { x: W / 2, y: 175 };
    return {
      x: Math.min(W - 60, target.baseX + target.crownR * 0.9),
      y: Math.max(175, target.crownY - target.crownR * 0.1),
    };
  }, [cicada, trees]);

  return (
    <div className="w-full">
      <Legend />
      <div className="relative w-full">
        <svg
          viewBox={`0 110 ${W} ${H - 110}`}
          className="h-auto w-full select-none"
          role="img"
          aria-label="知了森林"
        >
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EAF4FB" />
              <stop offset="55%" stopColor="#F6FBF6" />
              <stop offset="100%" stopColor="#EFF6E8" />
            </linearGradient>
            <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#DCE9D0" />
              <stop offset="100%" stopColor="#C9DCBA" />
            </linearGradient>
            <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="10" />
            </filter>
          </defs>

          <rect width={W} height={H} fill="url(#sky)" />
          <ellipse cx={W / 2} cy={GROUND_Y + 90} rx={W * 0.62} ry={150} fill="url(#ground)" />

          {trees.map((t) => (
            <TreeShape
              key={t.layout.treeId}
              tree={t}
              onLeaf={(l) => setActiveId(l?.leafId ?? null)}
              activeId={active?.leafId ?? null}
            />
          ))}

          {/* 精灵画在最后 = 叠在最上层（技术设计 §5.1） */}
          {cicada && cicadaAnchor ? (
            <Cicada cicada={cicada} anchor={cicadaAnchor} canvasWidth={W} />
          ) : null}
        </svg>

        <LeafCard leaf={active} onClose={() => setActiveId(null)} />

        {/* 台词是信息，不能只画进 SVG：父级 svg 是 role="img"，
            里面的文字辅助技术读不到，所以另起一个 live region 播报。 */}
        {cicada ? (
          <p className="sr-only" aria-live="polite">
            {cicada.line}
          </p>
        ) : null}
      </div>
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
  const color = CATEGORY_COLORS[tree.category];
  const trunkW = 9 + Math.min(tree.total, 30) * 0.5;
  const trunkH = tree.baseY - tree.crownY;
  const isDim = activeId !== null && !tree.leaves.some((l) => l.leafId === activeId);

  return (
    <g opacity={isDim ? 0.72 : 1} className="transition-opacity duration-200">
      <ellipse
        cx={tree.baseX}
        cy={tree.baseY + 5}
        rx={trunkW * 3.4}
        ry={trunkW * 1.3}
        fill="#A8BC9C"
        opacity={0.3}
        style={{ transition: "rx 0.5s ease" }}
      />

      {/* 树干 */}
      <path
        d={`M ${tree.baseX - trunkW / 2} ${tree.baseY}
            C ${tree.baseX - trunkW / 2.4} ${tree.baseY - trunkH * 0.5},
              ${tree.baseX - trunkW / 3} ${tree.baseY - trunkH * 0.78},
              ${tree.baseX - trunkW / 4} ${tree.crownY + 6}
            L ${tree.baseX + trunkW / 4} ${tree.crownY + 6}
            C ${tree.baseX + trunkW / 3} ${tree.baseY - trunkH * 0.78},
              ${tree.baseX + trunkW / 2.4} ${tree.baseY - trunkH * 0.5},
              ${tree.baseX + trunkW / 2} ${tree.baseY} Z`}
        fill="#A9856B"
        style={{ transition: "d 0.5s ease" }}
      />

      {/* 树冠光晕 */}
      <circle
        cx={tree.baseX}
        cy={tree.crownY}
        r={tree.crownR * 1.05}
        fill={color}
        opacity={0.16}
        filter="url(#blur)"
        style={{ transition: "r 0.5s ease, cy 0.5s ease" }}
      />

      {/* 叶簇：每个小主题 = 一簇小叶 */}
      {tree.leaves.map((leaf) => {
        const tone = leafTone(leaf);
        const fill = tone.fill ?? color;
        const isActive = leaf.leafId === activeId;
        return (
          <g
            key={leaf.leafId}
            className="cursor-pointer"
            onMouseEnter={() => onLeaf(leaf)}
            onClick={() => onLeaf(leaf)}
          >
            {/* 命中区域，方便悬停 */}
            <circle cx={leaf.cx} cy={leaf.cy} r={30} fill="transparent" />
            {leaf.minis.map((m, k) => (
              <ellipse
                key={k}
                cx={leaf.cx + m.dx}
                cy={leaf.cy + m.dy}
                rx={9}
                ry={6}
                fill={fill}
                opacity={tone.opacity * (isActive ? 1 : 0.92)}
                transform={`rotate(${m.rot} ${leaf.cx + m.dx} ${leaf.cy + m.dy})`}
                stroke={isActive ? "#3F3F3F" : "rgba(255,255,255,.5)"}
                strokeWidth={isActive ? 1.6 : 0.8}
                style={{ transition: "cx 0.5s ease, cy 0.5s ease, rx 0.5s ease" }}
                className="duration-500 hover:brightness-110"
              />
            ))}
          </g>
        );
      })}

      <text
        x={tree.baseX}
        y={tree.baseY + 34}
        textAnchor="middle"
        fontSize={17}
        fontWeight={600}
        fill="#57534E"
      >
        {tree.name}
      </text>
      <text x={tree.baseX} y={tree.baseY + 53} textAnchor="middle" fontSize={13} fill="#A8A29E">
        {tree.total} 条 · {STAGE_LABELS[tree.stage]}
      </text>
    </g>
  );
}

function LeafCard({ leaf, onClose }: { leaf: PlacedLeaf | null; onClose: () => void }) {
  if (!leaf) {
    return (
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl bg-white/85 px-4 py-2 text-sm text-stone-500 backdrop-blur">
        把鼠标移到叶子上，看看你收藏了什么
      </div>
    );
  }
  return (
    <div className="absolute bottom-4 left-4 w-80 rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-lg backdrop-blur">
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
      <p className="mt-1 text-xs text-stone-400">
        {STATE_LABELS[leaf.state]} · 关联 {leaf.contentIds.length} 条内容
      </p>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">{leaf.summary}</p>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 px-1 pb-2 text-xs text-stone-500">
      {Object.entries(CATEGORY_COLORS)
        .filter(([k]) => k !== "other")
        .map(([k, c]) => (
          <span key={k} className="flex items-center gap-1">
            <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />
            {CATEGORY_LABELS[k as keyof typeof CATEGORY_LABELS]}
          </span>
        ))}
    </div>
  );
}
