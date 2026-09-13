import SiteNav from "@/components/SiteNav";
import ShareCard from "@/components/ShareCard";
import "./card.css";
import { getProfile, getReport } from "@/lib/ai/serve";
import { loadDemoUser, loadForest } from "@/lib/forest";

const DEMO_USER = "user-a";

/**
 * GET /card?type=profile|report&date=YYYY-MM-DD
 *
 * PRD F11：把画像和报告做成可保存的卡片。卡片本体在客户端用 canvas 画，
 * 所以这里只负责取数。
 */
export default async function CardPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[]; date?: string | string[] }>;
}) {
  const params = await searchParams;
  const userId = DEMO_USER;
  const user = loadDemoUser(userId);
  const forest = loadForest(userId);

  const isReport = params.type === "report";
  const date = typeof params.date === "string" ? params.date : undefined;

  const cardUser = {
    nickname: user.nickname,
    displayName: user.displayName,
    treeCount: forest.trees.length,
    leafCount: forest.leaves.length,
  };

  // 报告卡上要带上当天真实读到的标题——既是排版需要，
  // 也是"AI 确实读了东西"的证据
  const report = isReport ? getReport(userId, date) : null;
  const byId = new Map(user.contents.map((c) => [c.contentId, c]));
  const titles: Record<string, string[]> = {};
  for (const h of report?.highlights ?? []) {
    titles[h.treeId] = h.contentIds
      .map((id) => byId.get(id))
      .filter((c) => c !== undefined)
      .sort((a, b) => b.voteUpCount - a.voteUpCount)
      .slice(0, 3)
      .map((c) => c.title.replace(/\s*-\s*知乎$/, ""));
  }

  const data =
    report !== null
      ? { kind: "report" as const, report, titles }
      : { kind: "profile" as const, profile: getProfile(userId) };

  return (
    <main className="cardpage">
      <div className="cardpage__inner">
        <SiteNav current="/card" />
        <h1 className="cardpage__title">
          {isReport ? "光合作用报告卡" : "灵魂画像卡"}
        </h1>
        <p className="cardpage__hint">
          长按图片保存，或点下面的按钮下载。图片直接发出去就行。
        </p>
        <ShareCard user={cardUser} data={data} />
      </div>
    </main>
  );
}
