import type { CSSProperties } from "react";
import ExitForest from "@/components/ExitForest";
import "./diary.css";
import { DIARY_WINDOW_DAYS, getDiary } from "@/lib/ai/serve";
import { loadDemoUser } from "@/lib/forest";
import { getDemoUserId } from "@/lib/session";
import { TOTAL_DAYS, dayToDate } from "@/lib/replay";
import type { DiaryEventType } from "@/lib/contract";

const EVENT_LABEL: Record<DiaryEventType, string> = {
  newTree: "新树",
  surge: "爆发",
  decay: "凋零",
  revive: "复苏",
};

const ACTION_HINT: Record<"water" | "prune" | "none", string | null> = {
  water: "该浇水了",
  prune: "可以修剪",
  none: null,
};

export default async function DiaryPage() {
  const userId = await getDemoUserId();
  const user = loadDemoUser(userId);

  const fromDay = TOTAL_DAYS - DIARY_WINDOW_DAYS + 1;
  // getDiary 已经按时间排好序并补上了 day，页面只管渲染
  const entries = getDiary(userId, 50);

  return (
    <main className="notebook">
      <div className="notebook__page">
        <ExitForest />

        <header className="cover">
          {/* 头像跟着 cookie 里的演示用户走——写死 user-a 的话，
              切换用户后名字变了、头像不变 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="cover__avatar"
            src={`/avatars/${userId}.svg`}
            alt=""
            width={60}
            height={60}
          />
          <div>
            <h1 className="cover__name">{user.nickname}</h1>
            <p className="cover__kind">{user.displayName}</p>
          </div>
        </header>

        {/* 画像已经独立成 /profile，这一页只留日记本身 */}
        <section className="entries" aria-labelledby="entries-title">
          <div className="entries__head">
            <h2 className="entries__title" id="entries-title">
              近三周
            </h2>
            <p className="entries__range">
              {dayToDate(fromDay)} – {dayToDate(TOTAL_DAYS)}
            </p>
          </div>

          <ol className="vine">
            {entries.map((entry, index) => {
              const hint = ACTION_HINT[entry.suggestedAction];
              return (
                <li
                  key={entry.entryId}
                  className="vine__entry"
                  data-event={entry.eventType}
                  style={{ "--i": index } as CSSProperties}
                >
                  <span className="vine__date">
                    {entry.day === null ? "" : dayToDate(entry.day).slice(5)}
                  </span>
                  <span className="vine__marker" aria-hidden="true" />
                  <div className="vine__body">
                    <p className="vine__meta">
                      <span className="vine__event">
                        {EVENT_LABEL[entry.eventType]}
                      </span>
                      <span className="vine__tree">{entry.treeName}</span>
                    </p>
                    <p className="vine__message">{entry.message}</p>
                    {hint ? <p className="vine__hint">{hint}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <footer className="notebook__foot">
          <p>
            日记由大模型根据你的真实收藏变化写成。内容来自知乎公开内容，时间线为演示编排。
          </p>
        </footer>
      </div>
    </main>
  );
}
