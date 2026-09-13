"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ForestCanvas from "@/components/ForestCanvas";
import SceneBubble, { DiaryIcon, ReportIcon } from "@/components/SceneBubble";
import {
  TOTAL_DAYS,
  dayToDate,
  eventsAtDay,
  forestAtDay,
  replayStats,
  type ReplayEventKind,
} from "@/lib/replay";
import { applyOverlay, type FeedbackOverlay } from "@/lib/feedback";
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
  contents,
  forest,
  cicada,
  hour,
}: {
  contents: ContentItem[];
  forest: ForestSnapshot;
  /** 精灵状态（后端决策）。回放的是历史帧，精灵只跟着"现在"走 */
  cicada?: CicadaState;
  /** 当前小时（0–23）：决定场景的昼夜氛围。由服务端算好传下来 */
  hour?: number;
}) {
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
          body: JSON.stringify({ userId: forest.userId, treeId, leafId, action }),
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
    [forest.userId],
  );

  return (
    <section className="relative mx-auto w-full max-w-[1500px] flex-1 px-3 pb-3 sm:px-6">
      {/* 三个入口。
          窄屏排在场景上方——手机上的场景只有两百来像素高，再往上叠 UI 会糊成一团。
          桌面才浮到天区两角，那时场景够大，压不到树。 */}
      <div className="mb-2 flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-1 sm:pointer-events-none sm:absolute sm:inset-x-0 sm:top-3 sm:z-20 sm:mb-0 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="pointer-events-auto">
            <SceneBubble
              href="/diary"
              label="农夫日记"
              hint="了解最近的自己"
              icon={DiaryIcon}
              tail="right"
            />
          </div>

          <Link
            href="/profile"
            className="group pointer-events-auto flex flex-col items-center gap-1"
          >
            <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-white/92 shadow-lg ring-2 ring-white transition-transform duration-200 group-hover:-translate-y-1 sm:h-16 sm:w-16">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/cicada-640.webp"
                alt=""
                className="h-[84%] w-[84%] object-contain"
              />
            </span>
            <span className="rounded-full bg-white/85 px-2 py-0.5 text-[11px] text-[#4a5b47] backdrop-blur">
              灵魂画像
            </span>
          </Link>
        </div>

        <div className="pointer-events-auto">
          <SceneBubble
            href="/report"
            label="光合作用报告"
            hint="看看昨天吸收了什么"
            icon={ReportIcon}
            tail="left"
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

        {/* 回放条。
            窄屏在场景下方的流里，实底保证可读；
            桌面浮在林地上，带一层向上的渐隐。 */}
        <div className="border-t border-stone-200/70 bg-white/95 px-3 py-2.5 sm:pointer-events-none sm:absolute sm:inset-x-0 sm:bottom-0 sm:z-20 sm:border-0 sm:bg-transparent sm:bg-gradient-to-t sm:from-[#24422f]/60 sm:via-[#24422f]/22 sm:to-transparent sm:px-5 sm:pb-3 sm:pt-10">
          <div className="pointer-events-auto mx-auto w-full sm:w-[min(78%,42rem)] sm:rounded-2xl sm:bg-white/90 sm:px-3 sm:py-2 sm:shadow-lg sm:backdrop-blur">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <button
                type="button"
                onClick={onPlay}
                className="shrink-0 rounded-full bg-[#5BA87A] px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#4E9669] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#2F5541]"
              >
                {playing ? "暂停" : atEnd ? "播放生长过程" : "继续播放"}
              </button>

              <div className="min-w-[120px] flex-1">
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
                <p className="text-sm font-semibold text-stone-700">
                  {dayToDate(day)}
                </p>
                <p className="text-[11px] text-stone-400">
                  第 {day} / {TOTAL_DAYS} 天 · {stats.trees} 树 · {stats.contents} 条
                </p>
              </div>
            </div>

            <div className="mt-1.5 flex min-h-[22px] flex-wrap items-center gap-1.5">
              {events.length === 0 ? (
                <span className="text-[11px] text-stone-400">
                  这天没有特别的事发生
                </span>
              ) : (
                events.map((e) => (
                  <span
                    key={`${e.kind}-${e.label}`}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] ring-1 ${EVENT_STYLE[e.kind]}`}
                  >
                    {e.label}
                  </span>
                ))
              )}
            </div>

            {error ? (
              <p role="alert" className="mt-1 text-[11px] text-[#B4553F]">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
