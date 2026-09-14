"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ForestCanvas, { Legend } from "@/components/ForestCanvas";
import SceneBubble, { DiaryIcon, ReportIcon } from "@/components/SceneBubble";
import { useAssetUrl } from "@/components/use-asset-url";
// 回放条也用同一份木料；显式引入，不依赖 SceneBubble 间接带上
import "./wood.css";
import {
  TOTAL_DAYS,
  dayToDate,
  eventsAtDay,
  forestAtDay,
  replayStats,
  type ReplayEventKind,
} from "@/lib/replay";
import { applyOverlay, type FeedbackOverlay } from "@/lib/feedback";
import type { DemoUserId } from "@/lib/demo-user";
import type {
  ApiEnvelope,
  CicadaState,
  ContentItem,
  FeedbackAction,
  FeedbackResult,
  ForestSnapshot,
} from "@/lib/contract";

/** 每一帧停留时长（毫秒），30 帧约 19 秒播完 */
const FRAME_MS = 620;

const EVENT_STYLE: Record<ReplayEventKind, string> = {
  newTree: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  surge: "bg-amber-50 text-amber-700 ring-amber-200",
  decay: "bg-stone-100 text-stone-600 ring-stone-300",
  revive: "bg-teal-50 text-teal-700 ring-teal-200",
};

export default function DayReplay({
  userId,
  contents,
  forest,
  cicada,
  hour,
}: {
  /**
   * 演示用户的**键**（"user-a"），不是森林数据里的 userId。
   * 数据里那个是 "user_a_shenqian" 这种展示用 ID，接口白名单不认它——
   * 之前直接把 forest.userId 提交上去，导致浇水/修剪永远被拒。
   */
  userId: DemoUserId;
  contents: ContentItem[];
  forest: ForestSnapshot;
  /** 精灵状态（后端决策）。回放的是历史帧，精灵只跟着"现在"走 */
  cicada?: CicadaState;
  /** 当前小时（0–23）：决定场景的昼夜氛围。由服务端算好传下来 */
  hour?: number;
}) {
  const wreathUrl = useAssetUrl("/wreath.webp");

  // 进来先看到**完整的森林**。生长过程要用户主动点才播——
  // 自动播放会让人一进页面就懵：画面自己在动，却不知道在看什么。
  const [day, setDay] = useState(TOTAL_DAYS);
  const [playing, setPlaying] = useState(false);

  // 反馈是"此刻"发生的事，叠加在正在看的这一帧上；
  // 精灵也换成本次应答后的状态，首屏那份由 props 提供
  const [overlay, setOverlay] = useState<FeedbackOverlay | null>(null);
  const [liveCicada, setLiveCicada] = useState<CicadaState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 30 天的森林全部预先算好，拖动时间轴时零延迟
  const frames = useMemo(
    () =>
      Array.from({ length: TOTAL_DAYS }, (_, i) =>
        forestAtDay(contents, forest, i + 1),
      ),
    [contents, forest],
  );

  const current = frames[day - 1];
  // 叠加是逐帧的：拖到叶子还没长出来的那天，这次浇水自然就不显示了
  const shown = useMemo(
    () => (overlay ? applyOverlay(current, overlay) : current),
    [current, overlay],
  );
  const stats = replayStats(shown);
  const events = useMemo(
    () => eventsAtDay(day > 1 ? frames[day - 2] : null, frames[day - 1]),
    [frames, day],
  );

  useEffect(() => {
    if (!playing) return;
    if (day >= TOTAL_DAYS) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(
      () => setDay((d) => Math.min(TOTAL_DAYS, d + 1)),
      FRAME_MS,
    );
    return () => clearTimeout(timer);
  }, [playing, day]);

  const atEnd = day >= TOTAL_DAYS;

  const onPlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    // 已经在终点（或还没开始）时，从头播一遍
    if (atEnd) setDay(1);
    setPlaying(true);
  };

  /**
   * 提交浇水 / 修剪。
   *
   * 一次往返就能把闭环走完：后端返回生效后的那一片叶子 + 精灵的应答，
   * 这里把叶子叠到当前帧、把精灵换成新状态——于是"点一下 → 叶子回鲜 →
   * 知了应声飞过来"是同时发生的，不用再拉一次森林。
   */
  const onFeedback = useCallback(
    async (leafId: string, treeId: string, action: FeedbackAction) => {
      setPending(true);
      setError(null);
      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId, treeId, leafId, action }),
        });
        const body = (await res.json()) as ApiEnvelope<FeedbackResult>;

        if (!body.success || !body.data) {
          setError(body.error ?? "这次没提交成功，再试一次？");
          return;
        }

        const leaf = body.data.forest.leaves.find((l) => l.leafId === leafId);
        if (!leaf) {
          setError("提交成功了，但这片叶子在森林里找不到了");
          return;
        }

        setOverlay({ leafId, treeId, leaf, action });
        setLiveCicada(body.data.cicada);
      } catch {
        setError("网络不太顺，待会儿再试一次");
      } finally {
        setPending(false);
      }
    },
    [userId],
  );

  return (
    <section className="relative mx-auto w-full max-w-[1500px] flex-1 px-3 pb-3 sm:px-6">
      {/* 三个入口：木牌 — 花环精灵 — 木牌，左右两块等宽、等距。
          木牌**做小了、也往上提了一点**，把画面让给树。
          窄屏排在场景上方；桌面浮在天区，往中间收，不贴着画布边缘。
          这一排和底部回放条是"周边"，都要比树小一号——它们是入口，不是主角。 */}
      <div className="mb-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-3 sm:pointer-events-none sm:absolute sm:inset-x-0 sm:-top-2 sm:z-20 sm:mb-0 sm:px-[8%] lg:px-[11%]">
        <div className="pointer-events-auto">
          <SceneBubble
            href="/diary"
            label="农夫日记"
            hint="了解最近的自己"
            icon={DiaryIcon}
          />
        </div>

        {/* 花环精灵。**不带木底座**——贴图自己就是完整的圆环构图；
            下面的「灵魂画像」也**不再是木牌**，就是一行文字。
            往下让一点点，免得顶着画面最上沿像要掉出去 */}
        <Link
          href="/profile"
          className="group pointer-events-auto mt-1 flex flex-col items-center gap-0.5 sm:mt-2"
        >
          {/* 素材没到位时用等大白块占位，避免花环位置塌下去 */}
          {wreathUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={wreathUrl}
                alt=""
                className="h-14 w-14 object-contain transition-transform duration-200 group-hover:-translate-y-1 lg:h-[4.5rem] lg:w-[4.5rem]"
              />
            </>
          ) : (
            <span
              className="h-14 w-14 lg:h-[4.5rem] lg:w-[4.5rem]"
              aria-hidden="true"
            />
          )}
          {/* 标签就是下面这行文字，不放在木牌上。
              窄屏要小一号：场景矮，台词气泡的像素位置更靠上，花环大了就压上去 */}
          <span className="text-[10px] font-bold tracking-[0.16em] text-[#2F554A] [text-shadow:0_1px_2px_rgba(255,255,255,0.9),0_0_8px_rgba(255,255,255,0.75)]">
            灵魂画像
          </span>
        </Link>

        <div className="pointer-events-auto">
          <SceneBubble
            href="/report"
            label="光合作用报告"
            hint="看看昨天吸收了什么"
            icon={ReportIcon}
          />
        </div>
      </div>

      {/* 场景：这一页的主体就是森林本身 */}
      <div className="relative overflow-hidden rounded-2xl ring-1 ring-stone-200/60 sm:rounded-3xl">

        <ForestCanvas
          forest={shown}
          cicada={liveCicada ?? cicada}
          onFeedback={onFeedback}
          feedbackPending={pending}
          hour={hour}
        />

        {/* 回放条：一条**细**长木纹。刻意做小做细——树才是主体，别喧宾夺主。
            窄屏在场景下方的流里；桌面浮在林地上，带一层向上的渐隐。 */}
        <div className="px-3 pb-2 pt-2 sm:pointer-events-none sm:absolute sm:inset-x-0 sm:bottom-0 sm:z-20 sm:bg-gradient-to-t sm:from-[#24422f]/46 sm:via-[#24422f]/14 sm:to-transparent sm:px-[12%] sm:pb-2 sm:pt-6">
          <div className="bar-wood pointer-events-auto mx-auto w-full px-3 py-1 lg:w-[min(70%,35rem)]">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <button
                type="button"
                onClick={onPlay}
                className="shrink-0 rounded-full bg-[#5BA87A] px-3 py-1 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#4E9669] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#2F5541]"
              >
                {playing ? "暂停" : atEnd ? "播放生长过程" : "继续播放"}
              </button>

              <div className="min-w-[110px] flex-1">
                <input
                  type="range"
                  min={1}
                  max={TOTAL_DAYS}
                  value={day}
                  onChange={(e) => setDay(Number(e.target.value))}
                  className="w-full accent-[#5BA87A]"
                  aria-label="生长时间轴"
                />
              </div>

              <div className="shrink-0 text-right leading-tight">
                <p className="text-[12px] font-bold text-[#F7E9CE]">
                  {dayToDate(day)}
                </p>
                <p className="text-[9px] text-[#CDB693]">
                  第 {day} / {TOTAL_DAYS} 天 · {stats.trees} 树 · {stats.contents} 条
                </p>
              </div>
            </div>

            <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 border-t border-white/15 pt-0.5">
              <div className="flex flex-wrap items-center gap-1">
                {events.length === 0 ? (
                  <span className="text-[9px] text-[#CDB693]">
                    这天没有特别的事发生
                  </span>
                ) : (
                  events.map((e) => (
                    <span
                      key={`${e.kind}-${e.label}`}
                      className={`rounded-full px-1.5 py-px text-[9px] ring-1 ${EVENT_STYLE[e.kind]}`}
                    >
                      {e.label}
                    </span>
                  ))
                )}
              </div>
              {/* 图例跟着木条走，不再浮在天区被入口木牌压住 */}
              <Legend />
            </div>

            {error ? (
              <p role="alert" className="mt-0.5 text-[10px] font-semibold text-[#FFB9A4]">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
