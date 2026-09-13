"use client";

import { useEffect, useRef, useState } from "react";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type PersonalityProfile,
  type PhotosynthesisReport,
} from "@/lib/contract";

/**
 * 分享卡片。
 *
 * **为什么用 canvas 而不是 SVG**：SVG 转成图片时，`<img>` 里不能加载外部字体，
 * 卡片上的站酷快乐体会掉成默认字体——"所见"和"所得"就对不上了。
 * canvas 画在同一页面上，能直接用已加载的字体，导出的 PNG 才是所见即所得。
 */

/**
 * canvas 的 font 是**字体简写字符串**，不解析 CSS 变量——
 * 写 "ZCOOL KuaiLe" 整条声明会被丢弃、静默回退成默认字体。
 * 所以下面一律写真实字体名 "ZCOOL KuaiLe"。
 */

/** 卡片逻辑尺寸（3:4，适合转发） */
const W = 900;
const H = 1200;
/** 导出倍率：2 倍，PNG 是 1800×2400 */
const DPR = 2;

const PAD = 70;

const C = {
  paperTop: "#FCFEF9",
  paperBottom: "#EFF6EA",
  ink: "#2F3A2E",
  near: "#2F5541",
  mid: "#5D9270",
  wood: "#8B6239",
  seal: "#9D4231",
  muted: "#6F7568",
  hair: "rgba(139, 98, 57, 0.22)",
};

export interface ShareCardUser {
  nickname: string;
  displayName: string;
  treeCount: number;
  leafCount: number;
}

type CardData =
  | { kind: "profile"; profile: PersonalityProfile }
  | { kind: "report"; report: PhotosynthesisReport; titles?: Record<string, string[]> };

/** 按实际测量换行（中文按字断行即可，浏览器量宽更准） */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    if (ch === "\n") {
      lines.push(line);
      line = "";
      continue;
    }
    const next = line + ch;
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line);
      line = ch;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * 截断到指定行数；真被截了就在末行加省略号——
 * 卡片高度固定，硬切会在句子中间断掉，看起来像坏了。
 */
function capLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number,
): string[] {
  const lines = wrap(ctx, text, maxW);
  if (lines.length <= maxLines) return lines;
  const out = lines.slice(0, maxLines);
  out[maxLines - 1] = `${out[maxLines - 1].replace(/[，、\s]+$/, "")}…`;
  return out;
}

/** 截成一行，超出加省略号 */
function oneLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let out = "";
  for (const ch of text) {
    if (ctx.measureText(`${out}${ch}…`).width > maxW) break;
    out += ch;
  }
  return `${out}…`;
}

function hairline(ctx: CanvasRenderingContext2D, y: number) {
  ctx.save();
  ctx.strokeStyle = C.hair;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  ctx.restore();
}

/** 印章：竖排文字，中文印章的本来写法 */
function drawSeal(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  const size = 46;
  const h = Math.min(230, text.length * size + 40);
  const w = size + 34;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((-2.5 * Math.PI) / 180);

  ctx.strokeStyle = C.seal;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 8);
  ctx.stroke();

  ctx.fillStyle = C.seal;
  ctx.font = `600 ${size * 0.8}px "ZCOOL KuaiLe", "PingFang SC", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  [...text].slice(0, 6).forEach((ch, i) => {
    ctx.fillText(ch, w / 2, 30 + size * 0.5 * i + i * 6);
  });

  ctx.restore();
  return { w, h };
}

export default function ShareCard({
  user,
  data,
}: {
  user: ShareCardUser;
  data: CardData;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 等字体就绪，否则截图里会是回退字体——这是卡片最容易翻车的地方
    const draw = () => {
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, C.paperTop);
      bg.addColorStop(1, C.paperBottom);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      ctx.textBaseline = "top";
      ctx.save();
      // 卡片高度固定，内容多了不能压到页脚：先把内容裁在页脚之上。
      // 这是兜底——排版本身也要收紧（见下面各处 slice 的上限）。
      ctx.beginPath();
      ctx.rect(0, 0, W, H - 116);
      ctx.clip();
      if (data.kind === "profile") drawProfile(ctx, user, data.profile);
      else drawReport(ctx, user, data.report, data.titles);
      ctx.restore();

      drawFooter(ctx);
      setReady(true);
    };

    if (document.fonts?.ready) void document.fonts.ready.then(draw);
    else draw();
  }, [user, data]);

  const download = () => {
    const canvas = ref.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `知了森林-${data.kind === "profile" ? "灵魂画像" : "光合作用报告"}-${user.nickname}.png`;
    a.click();
  };

  return (
    <div className="cardwrap">
      <canvas
        ref={ref}
        className="cardwrap__canvas"
        style={{ aspectRatio: `${W} / ${H}` }}
        role="img"
        aria-label="分享卡片"
      />
      <button type="button" className="cardwrap__btn" onClick={download} disabled={!ready}>
        {ready ? "下载图片" : "正在生成…"}
      </button>
    </div>
  );
}

/* ────────────────────── 画像卡 ────────────────────── */

function drawProfile(
  ctx: CanvasRenderingContext2D,
  user: ShareCardUser,
  p: PersonalityProfile,
) {
  let y = 88;

  ctx.fillStyle = C.mid;
  ctx.font = '400 24px "PingFang SC", sans-serif';
  ctx.textAlign = "left";
  ctx.fillText("灵 魂 画 像", PAD, y);
  y += 46;

  ctx.fillStyle = C.near;
  ctx.font = '600 54px "ZCOOL KuaiLe", "PingFang SC", sans-serif';
  ctx.fillText(user.nickname, PAD, y);
  y += 74;

  ctx.fillStyle = C.muted;
  ctx.font = '400 22px "PingFang SC", sans-serif';
  ctx.fillText(
    `${user.displayName} · ${user.treeCount} 棵树 · ${user.leafCount} 片叶子`,
    PAD,
    y,
  );
  y += 44;

  hairline(ctx, y);
  y += 40;

  // 印章 + 自述
  const seal = drawSeal(ctx, PAD, y, p.soulType);
  const textX = PAD + seal.w + 40;
  const textW = W - PAD - textX;

  ctx.fillStyle = C.ink;
  ctx.font = '400 26px "PingFang SC", sans-serif';
  const descLines = capLines(ctx, `${p.soulTypeEmoji} ${p.description}`, textW, 5);
  descLines.forEach((line, i) => {
    ctx.fillText(line, textX, y + i * 38);
  });

  y = Math.max(y + seal.h, y + descLines.length * 38) + 44;

  // 特质：只放 3 条，多了会顶到页脚
  p.traits.slice(0, 3).forEach((t) => {
    hairline(ctx, y);
    y += 22;

    ctx.fillStyle = C.near;
    ctx.font = '600 26px "PingFang SC", sans-serif';
    ctx.textAlign = "left";
    ctx.fillText(t.label, PAD, y);

    ctx.fillStyle = C.wood;
    ctx.font = '500 24px "PingFang SC", sans-serif';
    ctx.textAlign = "right";
    ctx.fillText(String(t.score), W - PAD, y);

    y += 36;
    ctx.fillStyle = C.muted;
    ctx.font = '400 21px "PingFang SC", sans-serif';
    ctx.textAlign = "left";
    capLines(ctx, t.evidence, W - PAD * 2, 2).forEach((line) => {
      ctx.fillText(line, PAD, y);
      y += 30;
    });
    y += 10;
  });

  // 注意力分布
  const cats = p.topCategories.filter((c) => c.weight > 0).slice(0, 4);
  if (cats.length) {
    y += 14;
    hairline(ctx, y);
    y += 30;

    ctx.fillStyle = C.mid;
    ctx.font = '400 23px "PingFang SC", sans-serif';
    ctx.fillText("注 意 力 分 布", PAD, y);
    y += 42;

    const trackX = PAD + 106;
    const trackW = W - PAD - trackX - 78;
    cats.forEach((c) => {
      ctx.fillStyle = C.ink;
      ctx.font = '400 22px "PingFang SC", sans-serif';
      ctx.textAlign = "left";
      ctx.fillText(CATEGORY_LABELS[c.category], PAD, y);

      ctx.fillStyle = "rgba(93, 146, 112, 0.16)";
      ctx.beginPath();
      ctx.roundRect(trackX, y + 6, trackW, 11, 6);
      ctx.fill();

      ctx.fillStyle = CATEGORY_COLORS[c.category];
      ctx.beginPath();
      ctx.roundRect(trackX, y + 6, Math.max(12, (trackW * c.weight) / 100), 11, 6);
      ctx.fill();

      ctx.fillStyle = C.muted;
      ctx.font = '400 21px "PingFang SC", sans-serif';
      ctx.textAlign = "right";
      ctx.fillText(`${c.weight}%`, W - PAD, y);

      y += 41;
    });
  }
}

/* ────────────────────── 报告卡 ────────────────────── */

function drawReport(
  ctx: CanvasRenderingContext2D,
  user: ShareCardUser,
  r: PhotosynthesisReport,
  titles?: Record<string, string[]>,
) {
  let y = 88;

  ctx.fillStyle = C.mid;
  ctx.font = '400 24px "PingFang SC", sans-serif';
  ctx.textAlign = "left";
  ctx.fillText("光 合 作 用 报 告", PAD, y);

  // 日期戳
  ctx.strokeStyle = C.wood;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(W - PAD - 210, y - 12, 210, 50, 8);
  ctx.stroke();
  ctx.fillStyle = C.wood;
  ctx.font = '400 24px "PingFang SC", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(r.date, W - PAD - 105, y + 2);
  y += 82;

  // 标题（模型写的当天主线）
  ctx.fillStyle = C.near;
  ctx.font = '600 42px "ZCOOL KuaiLe", "PingFang SC", sans-serif';
  ctx.textAlign = "left";
  capLines(ctx, r.headline, W - PAD * 2, 3).forEach((line) => {
    ctx.fillText(line, PAD, y);
    y += 56;
  });
  y += 16;

  ctx.fillStyle = C.muted;
  ctx.font = '400 22px "PingFang SC", sans-serif';
  ctx.fillText(
    `${user.nickname} · 这天读了 ${r.stats.totalContentCount} 条，走过 ${r.highlights.length} 棵树`,
    PAD,
    y,
  );
  y += 52;

  hairline(ctx, y);
  y += 36;

  // 每棵树一段
  r.highlights.slice(0, 3).forEach((h) => {
    const cat = h.category;
    ctx.fillStyle = CATEGORY_COLORS[cat];
    ctx.beginPath();
    ctx.arc(PAD + 11, y + 13, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = C.near;
    ctx.font = '600 30px "ZCOOL KuaiLe", "PingFang SC", sans-serif';
    ctx.textAlign = "left";
    ctx.fillText(h.treeName, PAD + 40, y);

    ctx.fillStyle = C.muted;
    ctx.font = '400 20px "PingFang SC", sans-serif';
    ctx.textAlign = "right";
    ctx.fillText(CATEGORY_LABELS[cat], W - PAD, y + 6);
    y += 50;

    ctx.fillStyle = C.ink;
    ctx.font = '400 24px "PingFang SC", sans-serif';
    ctx.textAlign = "left";
    capLines(ctx, h.summary, W - PAD * 2, 3).forEach((line) => {
      ctx.fillText(line, PAD, y);
      y += 34;
    });
    y += 16;

    // 当天真实读到的标题（按赞同数取前三）——"AI 确实读了东西"的证据
    (titles?.[h.treeId] ?? []).forEach((title) => {
      ctx.fillStyle = "rgba(93, 146, 112, 0.1)";
      ctx.beginPath();
      ctx.roundRect(PAD, y - 6, W - PAD * 2, 44, 8);
      ctx.fill();

      ctx.fillStyle = C.ink;
      ctx.font = '400 21px "PingFang SC", sans-serif';
      ctx.textAlign = "left";
      ctx.fillText(oneLine(ctx, title, W - PAD * 2 - 28), PAD + 14, y + 6);
      y += 54;
    });
    y += 22;
  });

  y += 6;
  hairline(ctx, y);
  y += 34;

  // 当日收支
  const stats: [string, number][] = [
    ["读入内容", r.stats.totalContentCount],
    ["新生叶片", r.stats.newLeafCount],
    ["新栽树苗", r.stats.newTreeCount],
  ];
  stats.forEach(([label, value], i) => {
    const x = PAD + i * 240;
    ctx.fillStyle = C.muted;
    ctx.font = '400 21px "PingFang SC", sans-serif';
    ctx.textAlign = "left";
    ctx.fillText(label, x, y);

    ctx.fillStyle = C.near;
    ctx.font = '600 40px "PingFang SC", sans-serif';
    ctx.fillText(String(value), x, y + 32);
  });
}

function drawFooter(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = C.muted;
  ctx.font = '400 20px "PingFang SC", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("知了森林 · 知乎黑客松 2026", W / 2, H - 62);
  ctx.font = '400 17px "PingFang SC", sans-serif';
  ctx.fillStyle = "rgba(111, 117, 104, 0.75)";
  ctx.fillText("内容来自知乎公开内容，时间线为演示编排", W / 2, H - 34);
}
