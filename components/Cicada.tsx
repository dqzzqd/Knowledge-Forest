"use client";

import type { CicadaState } from "@/lib/contract";
import "./Cicada.css";

/** 精灵在画布上的落点（SVG 用户坐标） */
export interface CicadaAnchor {
  x: number;
  y: number;
}

interface CicadaProps {
  cicada: CicadaState;
  anchor: CicadaAnchor;
  /** 画布宽度，用来把台词气泡夹在画面内，避免长句被裁掉 */
  canvasWidth: number;
}

/**
 * 精灵贴图。原图是 2048×2048 的白底 jpg，抠底后裁到精灵包围盒、
 * 压成 640px WebP（55KB）。见 imgtool/cutout.mjs。
 */
const SPRITE_SRC = "/cicada-640.webp";
/** 贴图原始宽高比（640×490），用它算高度才不会拉伸 */
const SPRITE_RATIO = 640 / 490;
/** 显示尺寸（SVG 用户坐标）——比树冠小一档，是"落在一棵树上"的比例 */
const SPRITE_W = 64;
const SPRITE_H = Math.round(SPRITE_W / SPRITE_RATIO);

/** 台词气泡的安全边距（用户坐标） */
const EDGE = 10;
/** 台词字号；中日韩字符约等于 1em，用它估算气泡宽度 */
const FONT_SIZE = 18;
/** 气泡到精灵头顶的距离 */
const BUBBLE_OFFSET = 54;

const clamp = (value: number, min: number, max: number) =>
  max < min ? value : Math.min(max, Math.max(min, value));

/**
 * 知了精灵。
 *
 * 只负责**演出**：往哪飞、做什么、说什么，全部来自 `cicada`
 * （后端 lib/cicada.ts 决策）。这里不含任何"该去哪"的判断——
 * 前端一有决策逻辑，精灵就会开始和森林的状态各说各话。
 */
export default function Cicada({ cicada, anchor, canvasWidth }: CicadaProps) {
  const { action, line } = cicada;

  const bubbleWidth = Math.max(140, line.length * FONT_SIZE + 34);
  // 气泡挂在 anchor 的局部坐标系里，所以夹取时要先把 anchor 的位移算回去
  const bubbleX = clamp(
    0,
    EDGE + bubbleWidth / 2 - anchor.x,
    canvasWidth - EDGE - bubbleWidth / 2 - anchor.x,
  );

  return (
    <g
      className={`cicada cicada--${action}`}
      style={{ transform: `translate(${anchor.x}px, ${anchor.y}px)` }}
    >
      <g className="cicada__body">
        {/* 贴图：身体略微上移，让视觉重心落在锚点上 */}
        <image
          className="cicada__sprite"
          href={SPRITE_SRC}
          x={-SPRITE_W / 2}
          y={-SPRITE_H * 0.7}
          width={SPRITE_W}
          height={SPRITE_H}
          preserveAspectRatio="xMidYMid meet"
        />

        {action === "water" ? <Droplets /> : null}
        {action === "prune" ? <Snips /> : null}
        {action === "sweep" ? <Dust /> : null}
      </g>

      {action !== "idle" ? (
        <g className="cicada__bubble" transform={`translate(${bubbleX}, ${-BUBBLE_OFFSET})`}>
          <rect
            x={-bubbleWidth / 2}
            y={-17}
            width={bubbleWidth}
            height={34}
            rx={17}
            fill="#FFFDF7"
            stroke="#DCB684"
            strokeWidth={1.5}
          />
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={FONT_SIZE}
            fill="#2F3A2E"
          >
            {line}
          </text>
        </g>
      ) : null}
    </g>
  );
}

/** 浇水：三滴水珠往下落 */
function Droplets() {
  return (
    <g className="cicada__droplets">
      {[0, 1, 2].map((i) => (
        <ellipse
          key={i}
          className="cicada__drop"
          cx={-6 + i * 6}
          cy={22}
          rx={2.6}
          ry={3.6}
          fill="#9CC7E0"
          style={{ animationDelay: `${i * 0.28}s` }}
        />
      ))}
    </g>
  );
}

/** 修剪：一把小剪刀剪两下 */
function Snips() {
  return (
    <g className="cicada__snips">
      <path d="M 6 20 L 20 32" className="cicada__snip cicada__snip--a" stroke="#8B6239" strokeWidth={2.2} strokeLinecap="round" />
      <path d="M 6 32 L 20 20" className="cicada__snip cicada__snip--b" stroke="#8B6239" strokeWidth={2.2} strokeLinecap="round" />
    </g>
  );
}

/** 清理枯叶：扫起的几缕尘 */
function Dust() {
  return (
    <g className="cicada__dust">
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          className="cicada__puff"
          d={`M ${-14 + i * 13} 24 q 5 -6 10 0`}
          stroke="#C9BC93"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </g>
  );
}
