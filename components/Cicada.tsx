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

/** 台词气泡的安全边距（用户坐标） */
const EDGE = 10;
/** 台词字号；中日韩字符约等于 1em，用它估算气泡宽度 */
const FONT_SIZE = 18;
/** 气泡到精灵头顶的距离 */
const BUBBLE_OFFSET = 48;

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
        {/* 翅膀在下、身体在上——SVG 按文档顺序绘制 */}
        <ellipse className="cicada__wing cicada__wing--left" cx={-10} cy={-5} rx={18} ry={7} transform="rotate(-26 -10 -5)" />
        <ellipse className="cicada__wing cicada__wing--right" cx={10} cy={-5} rx={18} ry={7} transform="rotate(26 10 -5)" />

        <ellipse cx={0} cy={3} rx={11} ry={16} fill="#8B6239" />
        <circle cx={0} cy={-13} r={9.5} fill="#5E4022" />

        <circle cx={-4.5} cy={-14} r={2.6} fill="#2F3A2E" />
        <circle cx={4.5} cy={-14} r={2.6} fill="#2F3A2E" />
        <circle cx={-3.7} cy={-15} r={0.9} fill="#FFFFFF" opacity={0.9} />
        <circle cx={5.3} cy={-15} r={0.9} fill="#FFFFFF" opacity={0.9} />

        <path
          d="M -4 -21 C -8 -29, -12 -31, -15 -30"
          stroke="#5E4022"
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 4 -21 C 8 -29, 12 -31, 15 -30"
          stroke="#5E4022"
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
        />

        <path
          d="M -3 -9 Q 0 -6.5 3 -9"
          stroke="#2F3A2E"
          strokeWidth={1.4}
          strokeLinecap="round"
          fill="none"
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
