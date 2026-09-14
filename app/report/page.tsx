import Link from "next/link";
import ExitForest from "@/components/ExitForest";
import { TextureVars } from "@/components/use-asset-url";
import "./report.css";
import { availableReportDates, getReport } from "@/lib/ai/serve";
import { loadDemoUser } from "@/lib/forest";
import { getDemoUserId } from "@/lib/session";
import { dayIndexOf } from "@/lib/replay";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type ContentItem,
} from "@/lib/contract";

/** 这一页的 CSS 背景素材。模块级常量——每次渲染新建数组会让 effect 反复重跑 */
const PAGE_TEXTURES = ["/paper-grain.webp", "/wood-pill.webp"] as const;

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const userId = await getDemoUserId();
  const user = loadDemoUser(userId);

  const dates = availableReportDates(userId);
  const requested = (await searchParams).date;
  const picked =
    typeof requested === "string" && dates.includes(requested)
      ? requested
      : undefined;

  const report = getReport(userId, picked);
  const byId = new Map(user.contents.map((c) => [c.contentId, c]));

  // 每个日子有多少条内容——放在切换器上，让「哪天的报告更厚」一眼可见
  const countOn = (date: string) =>
    user.contents.filter(
      (c) => dayIndexOf(c.interactedAt) === dayIndexOf(`${date}T12:00:00+08:00`),
    ).length;

  // 每天都生成了产物，所以整段日子都列出来——任意一天都点得到，不用猜哪天有货
  const chips = [...dates].reverse();

  // 把 contentId 还原成真实内容，并按赞同数排序——赞同数是「高质量输入」的判据
  const highlights = report.highlights.map((highlight) => ({
    ...highlight,
    items: highlight.contentIds
      .map((id) => byId.get(id))
      .filter((item): item is ContentItem => item !== undefined)
      .sort((a, b) => b.voteUpCount - a.voteUpCount),
  }));

  const readCount = report.stats.totalContentCount;
  const newLeaves = report.stats.newLeafCount;
  // 读到的条数里，只有归入某棵树的部分会出现在下面的高亮里；
  // 生活杂事（洗衣机、路由器之类）不进主题，所以两个数常常不相等。
  const absorbed = highlights.reduce((n, h) => n + h.items.length, 0);

  const lede =
    readCount === 0
      ? "这天没有新的内容落进来。"
      : `这天你读了 ${readCount} 条内容，${absorbed} 条长进了森林的 ${highlights.length} 棵树里。${
          newLeaves > 0 ? `这天新长出 ${newLeaves} 片叶子。` : ""
        }`;

  return (
    <main className="sheet">
      <TextureVars srcs={PAGE_TEXTURES} />
      <div className="sheet__page">
        <ExitForest />

        <div className="rpt__head">
          <h1 className="rpt__title">光合作用报告</h1>
          <span className="stamp">{report.date}</span>
        </div>

        {chips.length > 1 ? (
          <nav className="rpt__days" aria-label="按天查看报告">
            {chips.map((date) => (
              <Link
                key={date}
                href={`/report?date=${date}`}
                className="rpt__day"
                aria-current={date === report.date ? "date" : undefined}
              >
                <span className="rpt__day-date">{date.slice(5)}</span>
                <span className="rpt__day-count">{countOn(date)} 条</span>
              </Link>
            ))}
          </nav>
        ) : null}

        <section className="rpt__panel">
          <p className="rpt__headline">{report.headline}</p>
          <p className="rpt__lede">{lede}</p>

          {highlights.length === 0 ? (
            <p className="rpt__empty">
              这天森林很安静。安静也是生长的一部分——没有新叶，但树都还在。
            </p>
          ) : (
            <ul className="rpt__list">
              {highlights.map((highlight) => (
                <li key={highlight.treeId} className="rpt__tree">
                  <p className="rpt__treehead">
                    <span
                      className="rpt__dot"
                      style={{ background: CATEGORY_COLORS[highlight.category] }}
                      aria-hidden="true"
                    />
                    <span className="rpt__name">{highlight.treeName}</span>
                    <span className="rpt__cat">
                      {CATEGORY_LABELS[highlight.category]}
                    </span>
                  </p>
                  <p className="rpt__summary">{highlight.summary}</p>

                  {highlight.items.length > 0 ? (
                    <ul className="rpt__contents">
                      {highlight.items.map((item) => (
                        <li key={item.contentId}>
                          {item.url ? (
                            <a
                              className="rpt__content"
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <span className="rpt__content-title">
                                {item.title}
                              </span>
                              {item.voteUpCount > 0 ? (
                                <span className="rpt__votes">
                                  {item.voteUpCount} 赞同
                                </span>
                              ) : null}
                            </a>
                          ) : (
                            <span className="rpt__content">
                              <span className="rpt__content-title">
                                {item.title}
                              </span>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {/* 当日收支：农户记账的口吻，所以「0」也是正常的读数 */}
          <dl className="rpt__ledger">
            <div>
              <dt>读入内容</dt>
              <dd>{report.stats.totalContentCount}</dd>
            </div>
            <div>
              <dt>新生叶片</dt>
              <dd>{report.stats.newLeafCount}</dd>
            </div>
            <div>
              <dt>新栽树苗</dt>
              <dd>{report.stats.newTreeCount}</dd>
            </div>
          </dl>
        </section>

        <div className="mt-9 flex justify-center">
          <Link
            href={`/card?type=report&date=${report.date}`}
            className="inline-flex items-center rounded-full bg-[#5BA87A] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#4E9669] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#2F5541]"
          >
            做成分享卡
          </Link>
        </div>

        <footer className="rpt__foot">
          报告由大模型根据当天的真实收藏写成；少数日期若没有模型产物，则由确定性规则按真实数据降级生成。标题与链接指向知乎原文。时间线为演示编排。
        </footer>
      </div>
    </main>
  );
}
