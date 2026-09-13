"use client";

import { useEffect, useMemo, useState } from "react";
import ForestCanvas from "@/components/ForestCanvas";
import {
  TOTAL_DAYS,
  dayToDate,
  eventsAtDay,
  forestAtDay,
  replayStats,
  type ReplayEventKind,
} from "@/lib/replay";
import type { ContentItem, ForestState } from "@/lib/contract";

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
}: {
  contents: ContentItem[];
  forest: ForestState;
}) {
  const [day, setDay] = useState(1);
  const [playing, setPlaying] = useState(false);

  // 30 天的森林全部预先算好，拖动时间轴时零延迟
  const frames = useMemo(
    () =>
      Array.from({ length: TOTAL_DAYS }, (_, i) =>
        forestAtDay(contents, forest, i + 1),
      ),
    [contents, forest],
  );

  const current = frames[day - 1];
  const stats = replayStats(current);
  const events = useMemo(
    () => eventsAtDay(day > 1 ? frames[day - 2] : null, frames[day - 1]),
    [frames, day],
  );

  // 进页面自动播一遍——评委要看到森林是「长出来」的
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDay(TOTAL_DAYS);
      return;
    }
    setPlaying(true);
  }, []);

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

  const replay = () => {
    setDay(1);
    setPlaying(true);
  };

  const toggle = () => {
    if (day >= TOTAL_DAYS && !playing) {
      replay();
      return;
    }
    setPlaying((p) => !p);
  };

  const atEnd = day >= TOTAL_DAYS;

  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-16">
      <div className="rounded-2xl bg-white/75 p-4 shadow-sm ring-1 ring-stone-200/70">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            className="w-20 rounded-full bg-[#5BA87A] px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#4E9669]"
          >
            {playing ? "暂停" : atEnd ? "重播" : "继续"}
          </button>

          <div className="min-w-[220px] flex-1">
            <input
              type="range"
              min={1}
              max={TOTAL_DAYS}
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
              className="w-full accent-[#5BA87A]"
              aria-label="生长时间轴"
            />
            <div className="mt-0.5 flex justify-between text-[11px] text-stone-400">
              <span>{dayToDate(1)}</span>
              <span>{dayToDate(TOTAL_DAYS)}</span>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm font-semibold text-stone-700">{dayToDate(day)}</p>
            <p className="text-xs text-stone-400">
              第 {day} / {TOTAL_DAYS} 天
            </p>
          </div>
        </div>

        <div className="mt-3 flex min-h-[28px] flex-wrap items-center gap-1.5">
          {events.length === 0 ? (
            <span className="text-xs text-stone-400">这天没有特别的事发生</span>
          ) : (
            events.map((e) => (
              <span
                key={`${e.kind}-${e.label}`}
                className={`rounded-full px-2.5 py-0.5 text-xs ring-1 ${EVENT_STYLE[e.kind]}`}
              >
                {e.label}
              </span>
            ))
          )}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="主题树" value={stats.trees} />
        <Stat label="叶子" value={stats.leaves} />
        <Stat label="内容" value={stats.contents} />
        <Stat
          label="枯萎中"
          value={stats.fading + stats.withered}
          hint={`其中 ${stats.withered} 片已枯萎`}
        />
      </dl>

      <div className="mt-4">
        <ForestCanvas forest={current} />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-white/70 px-4 py-3 ring-1 ring-stone-200/70">
      <dt className="text-xs text-stone-400">{label}</dt>
      <dd className="mt-0.5 text-2xl font-semibold text-stone-700">{value}</dd>
      {hint ? <p className="mt-0.5 text-[11px] text-stone-400">{hint}</p> : null}
    </div>
  );
}
