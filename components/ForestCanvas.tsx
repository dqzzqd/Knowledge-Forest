"use client";

import { useMemo, useState } from "react";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  STAGE_LABELS,
  STATE_LABELS,
  type ForestState,
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

function buildTrees(forest: ForestState): PlacedTree[] {
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

export default function ForestCanvas({ forest }: { forest: ForestState }) {
  const [active, setActive] = useState<PlacedLeaf | null>(null);
  const trees = useMemo(() => buildTrees(forest), [forest]);

  return (
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
            onLeaf={setActive}
            activeId={active?.leafId ?? null}
          />
        ))}
      </svg>

      <LeafCard leaf={active} onClose={() => setActive(null)} />
      <Legend />
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
      />

      {/* 树冠光晕 */}
      <circle
        cx={tree.baseX}
        cy={tree.crownY}
        r={tree.crownR * 1.05}
        fill={color}
        opacity={0.16}
        filter="url(#blur)"
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
                className="transition-all duration-200 hover:brightness-110"
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
    <div className="absolute top-3 right-3 flex flex-wrap justify-end gap-x-3 gap-y-1 text-xs text-stone-500">
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
