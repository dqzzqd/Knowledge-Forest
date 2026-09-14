"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Cicada from "@/components/Cicada";
import { useAssetUrl } from "@/components/use-asset-url";
import "./wood.css";
import { atmosphereFor, type Atmosphere } from "@/lib/atmosphere";
import {
  LABEL_NAME_DY,
  LABEL_NAME_SIZE,
  LABEL_STAT_DY,
  LABEL_STAT_SIZE,
  placeCicada,
  statText,
} from "@/lib/cicada-placement";
import { zhihuTopicUrl } from "@/lib/zhihu";
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
const TREE_BASE_W = 236;
/** 相邻两棵树的中心至少要隔开「半径和 × 这个系数」；略小于 1 是允许一点交叠做景深 */
const MIN_GAP = 0.82;
/** 树冠离画布左右边缘至少留这么多，免得贴着边框显得被裁 */
const EDGE = 34;
/** 天空装饰（日月云）的纵向带。上避开入口木牌、下避开远山——
 *  远山压低之后（见下面的山形路径），这条带子才有地方。 */
const DECOR_TOP = HORIZON * 0.52;
const DECOR_SPAN = HORIZON * 0.23;
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

  /**
   * 摆不下就整体缩小。
   *
   * 下面的「推开 → 平移 → 夹紧」只在**排得下**的时候成立。user-c 有 10 棵树，
   * 按原始尺寸排开要 2066px，可用宽度只有 1132px——推开后末端越界 934px，
   * 一起左移再夹紧，就会把 6 棵树压进 x=125~250 那一小段里叠成一坨。
   *
   * 但**差一点点不算**：user-a/b 只超出约 4%，靠左右平移就吸收了。
   * 树的大小是刻意调过的（缩太多画面会显得空），不该为这点溢出去动它。
   * 所以只在超出 15% 以上、平移已经救不回来时，才一次缩到刚好放下。
   */
  const available = W - 2 * EDGE;
  const OVERFLOW_TOLERANCE = 1.15;

  const spanAt = (fit: number) => {
    const row = boxes
      .map((b) => ({ x: b.x, w: b.width * fit }))
      .sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++) {
      const need = row[i - 1].x + ((row[i - 1].w + row[i].w) / 2) * MIN_GAP;
      if (row[i].x < need) row[i].x = need;
    }
    const first = row[0];
    const last = row[row.length - 1];
    return last.x + last.w / 2 - (first.x - first.w / 2);
  };

  let fit = 1;
  if (boxes.length > 1 && spanAt(1) > available * OVERFLOW_TOLERANCE) {
    // 跨度大致随缩放系数线性变化，迭代几次就收敛
    for (let pass = 0; pass < 4; pass++) {
      const span = spanAt(fit);
      if (span <= available) break;
      fit *= available / span;
    }
    // 留个下限：真到了这一步说明数据离谱，宁可轻微重叠也别把树缩成芝麻
    fit = Math.max(fit, 0.45);
  }
  if (fit < 1) {
    for (const b of boxes) {
      b.width *= fit;
      b.height *= fit;
    }
  }

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
  const overflow = last ? last.x + last.width / 2 + EDGE - W : 0;
  for (const b of byX) {
    b.x = clamp(
      b.x - Math.max(0, overflow),
      b.width / 2 + EDGE,
      W - b.width / 2 - EDGE,
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

      // 只渲染**还挂在这棵树上**的叶子。
      // 修剪是把 leafId 从树的 leafIds 里摘掉（见 lib/feedback.ts），
      // 叶子对象仍留在 forest.leaves 里供回溯——所以这里必须看 leafIds，
      // 只看 treeId 的话修剪过的叶子还会照画不误。
      const own = forest.leaves.filter(
        (l) => l.treeId === tree.treeId && tree.leafIds.includes(l.leafId),
      );
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

  // 卡片要贴着**被点的那片叶子**出现，而不是固定在角上。
  // 落点全部在 hover 事件里算：叶子的 cx/cy 是 SVG 用户坐标（0–1200 × 0–760），
  // 视口一变就和屏幕对不上，得直接量 getBoundingClientRect；
  // 而且渲染期不能读 ref（React 的反模式，lint 也会拦）。
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cardPos, setCardPos] = useState<{ left: number; top: number } | null>(null);

  /**
   * 算出卡片该落哪：优先放叶子**右边**，右边放不下翻到左边；垂直居中并夹在容器内。
   * 窄屏（< 640px）返回 null，交给 CSS 走底部整条的老版式——手机上贴着叶子放会挤成一团。
   */
  const positionCard = (el: Element | null) => {
    const wrap = wrapRef.current;
    if (!el || !wrap) return null;
    const box = wrap.getBoundingClientRect();
    const leaf = el.getBoundingClientRect();
    if (box.width < 640) return null;

    const x = leaf.left + leaf.width / 2 - box.left;
    const y = leaf.top + leaf.height / 2 - box.top;

    // 卡片宽度是 CSS 里写死的 11.5rem(184px)；高度随内容变，用估值夹取即可
    const CARD_W = 184;
    const CARD_H = 168;
    const GAP = 24;
    const PAD = 12;

    const flip = x + GAP + CARD_W > box.width - PAD;
    return {
      left: Math.max(PAD, Math.min(flip ? x - GAP - CARD_W : x + GAP, box.width - CARD_W - PAD)),
      top: Math.max(PAD, Math.min(y - CARD_H / 2, box.height - CARD_H - PAD)),
    };
  };

  // 鼠标移开叶子就收起卡片。但**不能立刻收**——
  // 从叶子移到卡片上也会触发"离开"，那样就点不到浇水/修剪了。
  // 所以延时收，指针一进卡片就取消。
  const closeTimer = useRef<number | null>(null);
  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    // 420ms 而不是 280：卡片紧贴叶子虽然近，但从叶子挪到按钮上仍要一点时间，
    // 太快收会让人点不到「浇点水 / 修剪掉」。
    closeTimer.current = window.setTimeout(() => setActiveId(null), 420);
  };
  useEffect(() => cancelClose, []);

  const active = useMemo(() => {
    if (!activeId) return null;
    for (const t of trees) {
      const found = t.leaves.find((l) => l.leafId === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, trees]);

  // 精灵落点由 lib/cicada-placement 算：它避开所有树名（树名两行是信息，
  // 被盖上就等于信息丢了）与树冠（叶子能点），优先站在目标树脚下的草地上，
  // 挤不下才退到树名之上。
  const cicadaAnchor = useMemo(() => {
    if (!cicada) return null;
    return placeCicada(
      trees.map((t) => ({
        treeId: t.treeId,
        x: t.x,
        baseY: t.y + t.height,
        width: t.width,
        canopyY: t.canopyY,
        canopyRx: t.canopyRx,
        canopyRy: t.canopyRy,
        name: t.name,
        statText: statText(t.total, STAGE_LABELS[t.stage]),
      })),
      cicada.targetTreeId,
      cicada.line,
    );
  }, [cicada, trees]);

  return (
    <div ref={wrapRef} className="relative h-full w-full">
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
        {/* 太阳 / 月亮 / 云 / 星：按时段画。位置全写死，两端必须画出同一片天 */}
        <SkyDecor atm={atm} />

        {/* 远山：三层，越远越淡（空气透视）。颜色跟着时段走。
            山压得比较矮——留出天空给日月云，否则装饰全被山盖住 */}
        <path
          d={`M0 ${HORIZON} Q ${W * 0.16} ${HORIZON - 52} ${W * 0.38} ${HORIZON - 14}
              T ${W * 0.72} ${HORIZON - 30} T ${W} ${HORIZON - 9}
              L ${W} ${HORIZON + 60} L 0 ${HORIZON + 60} Z`}
          fill={atm.hill}
          opacity={0.34}
          filter="url(#haze)"
        />
        <path
          d={`M0 ${HORIZON + 6} Q ${W * 0.24} ${HORIZON - 34} ${W * 0.5} ${HORIZON + 4}
              T ${W} ${HORIZON - 19} L ${W} ${HORIZON + 70} L 0 ${HORIZON + 70} Z`}
          fill={atm.hill}
          opacity={0.26}
          filter="url(#haze)"
        />
        <path
          d={`M0 ${HORIZON + 26} Q ${W * 0.34} ${HORIZON - 13} ${W * 0.62} ${HORIZON + 30}
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

        {/* 草地细节：前景一簇簇小草。画在树之前，不会挡住树 */}
        <Grass atm={atm} />

        {/* 树：远的先画 */}
        {trees.map((tree) => (
          <TreeShape
            key={tree.treeId}
            tree={tree}
            onLeaf={(l, el) => {
              cancelClose();
              setActiveId(l?.leafId ?? null);
              setCardPos(l ? positionCard(el ?? null) : null);
            }}
            onLeafLeave={scheduleClose}
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

        {/* 精灵画在最后 = 叠在最上层，且**在色罩之上**——
            夜里它是唯一还亮着的东西（技术设计 §5.1） */}
        {cicada && cicadaAnchor ? (
          <Cicada cicada={cicada} anchor={cicadaAnchor} />
        ) : null}
      </svg>

      <LeafCard
        leaf={active}
        atm={atm}
        pos={cardPos}
        onClose={() => setActiveId(null)}
        onEnter={cancelClose}
        onLeave={scheduleClose}
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
  onLeafLeave,
  activeId,
}: {
  tree: PlacedTree;
  /** 第二参是叶子元素本身：卡片要靠它算出「贴着叶子」的落点 */
  onLeaf: (l: PlacedLeaf | null, el?: Element | null) => void;
  onLeafLeave: () => void;
  activeId: string | null;
}) {
  const baseColor = CATEGORY_COLORS[tree.category];
  const isDim = activeId !== null && !tree.leaves.some((l) => l.leafId === activeId);
  const artUrl = useAssetUrl(TREE_ART[tree.art].src);

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

      {/* 素材没到位就先不画：宁可空着，也不要一个断图图标 */}
      {artUrl ? (
        <image
          href={artUrl}
          x={tree.x - tree.width / 2}
          y={tree.y}
          width={tree.width}
          height={tree.height}
          opacity={tree.opacity}
          preserveAspectRatio="xMidYMid meet"
          /* 插画是纯装饰，**不能吃指针事件**：它是矩形，透明的地方照样拦截鼠标，
             会把压在下面的叶子变成点不到的死区 */
          pointerEvents="none"
        />
      ) : null}

      {/* 树叶：每个小主题一片 */}
      {tree.leaves.map((leaf) => {
        const tone = leafTone(leaf);
        const fill = tone.fill ?? baseColor;
        const isActive = leaf.leafId === activeId;
        return (
          <g
            key={leaf.leafId}
            className="cursor-pointer"
            onMouseEnter={(e) => onLeaf(leaf, e.currentTarget)}
            onMouseLeave={onLeafLeave}
            onClick={(e) => onLeaf(leaf, e.currentTarget)}
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
 *
 * 字号/基线都取自 lib/cicada-placement——那里的落点算法按同一组数
 * 算"精灵会不会压住这行字"，两处必须同源。
 */
function TreeLabel({ tree, atm }: { tree: PlacedTree; atm: Atmosphere }) {
  const baseY = tree.y + tree.height;
  const outline = {
    stroke: atm.labelStroke,
    strokeWidth: 4,
    paintOrder: "stroke" as const,
  };
  return (
    <g aria-hidden="true">
      <text
        x={tree.x}
        y={baseY + LABEL_NAME_DY}
        textAnchor="middle"
        fontSize={LABEL_NAME_SIZE}
        fontWeight={700}
        fill={atm.labelFill}
        {...outline}
      >
        {tree.name}
      </text>
      <text
        x={tree.x}
        y={baseY + LABEL_STAT_DY}
        textAnchor="middle"
        fontSize={LABEL_STAT_SIZE}
        fill={atm.labelFill}
        opacity={0.82}
        {...outline}
      >
        {statText(tree.total, STAGE_LABELS[tree.stage])}
      </text>
    </g>
  );
}

/**
 * 天空装饰：星 → 太阳/月亮 → 云（云画在最上，可以飘在日月前面）。
 * **位置全部写死或用三角函数算，绝不用 Math.random**——
 * 服务端与客户端必须画出同一片天，否则 hydration 不一致。
 */
function SkyDecor({ atm }: { atm: Atmosphere }) {
  const d = atm.decor;
  const stars = useMemo(
    () =>
      Array.from({ length: d.stars }, (_, i) => ({
        x: (((i * 137.508) % 100) / 100) * W,
        y: (((i * 61.803) % 54) / 100) * HORIZON,
        r: 0.7 + ((i * 7) % 5) * 0.34,
        o: 0.28 + ((i * 3) % 6) * 0.11,
      })),
    [d.stars],
  );

  // 日/月/云挂在这条带子里：上边避开顶部那排入口木牌，下边不越过地平线。
  // （早先按 0–1 直接映射到整块天空，结果全被木牌挡住了）
  const skyY = (v: number) => DECOR_TOP + v * DECOR_SPAN;

  return (
    <g pointerEvents="none">
      {stars.map((s, i) => (
        <circle key={`star-${i}`} cx={s.x} cy={s.y} r={s.r} fill="#F4F8FF" opacity={s.o} />
      ))}

      {d.sun ? (
        <>
          <circle
            cx={d.sun.x * W}
            cy={skyY(d.sun.y)}
            r={d.sun.r * 4.4}
            fill={d.sun.color}
            opacity={0.24 * d.sun.glow}
            filter="url(#haze)"
          />
          <circle
            cx={d.sun.x * W}
            cy={skyY(d.sun.y)}
            r={d.sun.r}
            fill={d.sun.color}
            opacity={0.88}
            filter="url(#haze)"
          />
        </>
      ) : null}

      {d.moon ? (
        <>
          <circle
            cx={d.moon.x * W}
            cy={skyY(d.moon.y)}
            r={d.moon.r * 3.6}
            fill="#DCE6F5"
            opacity={0.18}
            filter="url(#haze)"
          />
          <circle
            cx={d.moon.x * W}
            cy={skyY(d.moon.y)}
            r={d.moon.r}
            fill="#F2F6FF"
            opacity={0.94}
          />
          {/* 拿一块天色的圆咬出弯月。夜空顶部接近纯色，这里够用 */}
          <circle
            cx={d.moon.x * W + d.moon.r * 0.44}
            cy={skyY(d.moon.y) - d.moon.r * 0.34}
            r={d.moon.r * 0.88}
            fill={atm.sky[0]}
          />
        </>
      ) : null}

      {/* 一条云 = 三个叠起来的椭圆。底下先垫一层淡影，云才有厚度 */}
      {d.clouds.map((c, i) => {
        const cx = c.x * W;
        const cy = skyY(c.y);
        const s = c.scale;
        return (
          <g key={`cloud-${i}`} opacity={c.opacity} filter="url(#haze)">
            <ellipse cx={cx} cy={cy + 6 * s} rx={59 * s} ry={21 * s} fill={d.cloudShade} />
            <ellipse
              cx={cx - 36 * s}
              cy={cy + 12 * s}
              rx={37 * s}
              ry={15 * s}
              fill={d.cloudShade}
            />
            <ellipse
              cx={cx + 38 * s}
              cy={cy + 11 * s}
              rx={33 * s}
              ry={13 * s}
              fill={d.cloudShade}
            />
            <ellipse cx={cx} cy={cy} rx={56 * s} ry={21 * s} fill={d.cloudColor} />
            <ellipse
              cx={cx - 36 * s}
              cy={cy + 7 * s}
              rx={35 * s}
              ry={15 * s}
              fill={d.cloudColor}
            />
            <ellipse
              cx={cx + 38 * s}
              cy={cy + 6 * s}
              rx={31 * s}
              ry={13 * s}
              fill={d.cloudColor}
            />
          </g>
        );
      })}
    </g>
  );
}

/**
 * 草地元素。
 *
 * 用的是抠好的草簇贴图（public/grass.webp），**手工摆位**而不是公式生成——
 * 位置高低错落、大小不一，看着才像有人打理过。
 * 只铺在前景（树基之下），而且画在树之前，不会挡住树和叶子。
 */
const GRASS_BASE_Y = 572;
const GRASS_SPAN_Y = 108;

/** x 是归一化横坐标，y 是前景带内的 0–1，w 是草簇宽度（用户坐标）。
 *  刻意做得高低错落、大小悬殊——一致的话会读成一条绿边，而不是一丛丛草 */
const GRASS_SPOTS: { x: number; y: number; w: number; o: number }[] = [
  { x: 0.03, y: 0.62, w: 128, o: 0.8 },
  { x: 0.15, y: 0.16, w: 246, o: 0.97 },
  { x: 0.3, y: 0.74, w: 96, o: 0.72 },
  { x: 0.42, y: 0.34, w: 188, o: 0.9 },
  { x: 0.56, y: 0.88, w: 232, o: 1 },
  { x: 0.68, y: 0.06, w: 118, o: 0.76 },
  { x: 0.79, y: 0.56, w: 205, o: 0.94 },
  { x: 0.91, y: 0.22, w: 88, o: 0.7 },
  { x: 0.99, y: 0.8, w: 172, o: 0.88 },
];

function Grass({ atm }: { atm: Atmosphere }) {
  const grassUrl = useAssetUrl("/grass.webp");
  return (
    <g pointerEvents="none">
      {GRASS_SPOTS.map((g, i) => {
        if (!grassUrl) return null;
        const w = g.w;
        const h = w / (420 / 202);
        const cx = g.x * W;
        const baseY = GRASS_BASE_Y + g.y * GRASS_SPAN_Y;
        return (
          <image
            key={i}
            href={grassUrl}
            x={cx - w / 2}
            y={baseY - h}
            width={w}
            height={h}
            opacity={g.o}
            /* 夜色里草会暗下来，和场景一起换光 */
            style={
              atm.tintOpacity > 0.2
                ? { filter: `brightness(${1 - atm.tintOpacity * 0.95})` }
                : undefined
            }
          />
        );
      })}
    </g>
  );
}

function LeafCard({
  leaf,
  atm,
  pos,
  onClose,
  onEnter,
  onLeave,
  onFeedback,
  pending,
}: {
  leaf: PlacedLeaf | null;
  /** 用于提示文字取色：白天深字、夜里浅字，跟着时段走 */
  atm: Atmosphere;
  /** 贴着叶子的落点（容器内像素）。窄屏为 null，改走底部整条版式 */
  pos: { left: number; top: number } | null;
  onClose: () => void;
  /** 指针进卡片：取消"移开叶子就收起"的延时，否则点不到按钮 */
  onEnter: () => void;
  /** 指针离开卡片：同样延时收起 */
  onLeave: () => void;
  onFeedback?: FeedbackHandler;
  pending: boolean;
}) {
  if (!leaf) {
    // 提示只是一行字，**不垫木板**——它不该和树抢注意力
    return (
      <p
        className="pointer-events-none absolute bottom-3 left-3 right-3 text-center text-[13px] font-semibold sm:bottom-[5.6rem] sm:left-[11%] sm:right-auto sm:text-left"
        style={{
          color: atm.labelFill,
          textShadow: `0 0 4px ${atm.labelStroke}, 0 0 4px ${atm.labelStroke}, 0 1px 8px ${atm.labelStroke}`,
        }}
      >
        点一片叶子，看看你收藏了什么
      </p>
    );
  }

  // 叶子本身已经带着大类颜色，把大类名写出来，就省掉了单独的图例
  return (
    <div
      className={
        pos
          ? "board-card absolute w-[11.5rem] p-2.5"
          : "board-card absolute bottom-3 left-3 right-3 p-2.5 sm:bottom-[6.5rem] sm:left-[5%] sm:right-auto sm:w-[11.5rem]"
      }
      style={pos ? { left: pos.left, top: pos.top } : undefined}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[13px] font-bold leading-snug text-[#33210c]">
          {leaf.name}
        </h3>
        <button
          onClick={onClose}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/65 text-sm leading-none text-[#4a2f14] transition-colors hover:bg-white/90"
          aria-label="关闭"
        >
          ×
        </button>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-1 text-[10px] font-medium leading-snug text-[#6b4a25]">
        <span
          className="mr-0.5 inline-block h-2 w-2 rounded-full ring-1 ring-white/50"
          style={{ background: CATEGORY_COLORS[leaf.category] }}
          aria-hidden="true"
        />
        {CATEGORY_LABELS[leaf.category]} · {STATE_LABELS[leaf.state]} · 关联{" "}
        {leaf.contentIds.length} 条
        {leaf.waterCount > 0 ? ` · 已浇 ${leaf.waterCount} 次` : ""}
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-[#402c13]">
        {leaf.summary}
      </p>

      {onFeedback ? (
        <div className="mt-2 flex gap-1.5">
          {/*
            用真正的 <a> 而不是 button + window.open：
            真实导航不会被弹窗拦截，右键/中键也能直接打开——
            演示现场评审的浏览器与扩展常常拦弹窗，弹窗一拦就等于这个功能没做。
          */}
          <a
            href={zhihuTopicUrl(leaf.name)}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={pending}
            onClick={(event) => {
              if (pending) {
                event.preventDefault();
                return;
              }
              // 浇水 = 这个主题我还想继续看 → 把人送回知乎这个主题下
              onFeedback(leaf.leafId, leaf.treeId, "water");
            }}
            className={`inline-flex flex-1 items-center justify-center rounded-full bg-[#5BA87A] px-2 py-1 text-[11px] font-medium text-white shadow-sm transition-colors hover:bg-[#4E9669] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#2F5541] ${
              pending ? "pointer-events-none opacity-50" : ""
            }`}
          >
            浇点水
          </a>
          <button
            type="button"
            disabled={pending}
            onClick={() => onFeedback(leaf.leafId, leaf.treeId, "prune")}
            className="flex-1 rounded-full bg-white px-2 py-1 text-[11px] font-medium text-[#5a4630] ring-1 ring-[#a98b5f]/60 transition-colors hover:bg-white/80 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#2F5541] disabled:cursor-not-allowed disabled:opacity-50"
          >
            修剪掉
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** 大类图例。原先浮在天区，会被顶部的木牌压住；现在挪进底部**深色木条**里。
 *  字号压到 9px：它只是备注，别跟树抢注意力 */
export function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-[#E2D0AE]">
      {Object.entries(CATEGORY_COLORS)
        .filter(([k]) => k !== "other")
        .map(([k, c]) => (
          <span key={k} className="flex items-center gap-1">
            <i
              className="inline-block h-1.5 w-1.5 rounded-full shadow-[0_1px_1px_rgba(0,0,0,.4)]"
              style={{ background: c }}
            />
            {CATEGORY_LABELS[k as keyof typeof CATEGORY_LABELS]}
          </span>
        ))}
    </div>
  );
}
