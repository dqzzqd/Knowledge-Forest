import DayReplay from "@/components/DayReplay";
import SiteNav from "@/components/SiteNav";
import { nowIso } from "@/lib/api";
import { deriveCicada } from "@/lib/cicada";
import { loadDemoUser, loadForest } from "@/lib/forest";
import { CATEGORY_LABELS, type TopicCategory } from "@/lib/contract";

export default function Forest() {
  const user = loadDemoUser("user-a");
  const forest = loadForest("user-a");
  // 精灵的"此刻"在服务端定一次，随首屏一起送达，前端不用再拉一次接口
  const cicada = deriveCicada(forest, nowIso());

  const categories = forest.trees
    .map((t) => CATEGORY_LABELS[t.category as TopicCategory])
    .filter((v, i, a) => a.indexOf(v) === i);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F7FBF4] to-[#EEF6EA]">
      <header className="mx-auto w-full max-w-6xl px-6 pt-10 pb-6">
        <SiteNav current="/forest" />
        <div className="flex items-start gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/avatars/user-a.svg"
            alt={user.nickname}
            width={72}
            height={72}
            className="h-[72px] w-[72px] rounded-full shadow-sm"
          />
          <div className="flex-1">
            <p className="text-sm text-stone-400">你的森林</p>
            <h1 className="mt-0.5 text-2xl font-bold text-stone-800">
              {user.nickname}
              <span className="ml-2 align-middle text-sm font-normal text-stone-400">
                {user.displayName}
              </span>
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-stone-500">
              {user.bio}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {user.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-white/70 px-3 py-0.5 text-xs text-stone-500 ring-1 ring-stone-200"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      <DayReplay contents={user.contents} forest={forest} cicada={cicada} />

      <footer className="mx-auto w-full max-w-6xl space-y-1 px-6 pb-10 text-xs leading-relaxed text-stone-400">
        <p>
          演示数据：内容来自知乎真实作者的创作（经知乎官方 CLI 检索），时间线为演示编排。
          点击叶子可查看。数据说明见{" "}
          <code className="rounded bg-white/70 px-1">mock-data/README.md</code>。
        </p>
        <p>主题大类：{categories.join(" · ")}</p>
      </footer>
    </main>
  );
}
