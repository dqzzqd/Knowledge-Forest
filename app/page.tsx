import ForestCanvas from "@/components/ForestCanvas";
import { forestStats, loadDemoUser, loadForest } from "@/lib/forest";
import { CATEGORY_LABELS, type TopicCategory } from "@/lib/contract";

export default function Home() {
  const user = loadDemoUser("user-a");
  const forest = loadForest("user-a");
  const stats = forestStats(forest);

  const categories = forest.trees
    .map((t) => CATEGORY_LABELS[t.category as TopicCategory])
    .filter((v, i, a) => a.indexOf(v) === i);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F7FBF4] to-[#EEF6EA]">
      <header className="mx-auto w-full max-w-6xl px-6 pt-10 pb-2">
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

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="主题树" value={stats.trees} />
          <Stat label="叶子" value={stats.totalLeaves} />
          <Stat label="内容" value={stats.totalContents} />
          <Stat
            label="枯萎中"
            value={stats.fading + stats.withered}
            hint={`其中 ${stats.withered} 片已枯萎`}
          />
        </dl>
      </header>

      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <ForestCanvas forest={forest} />
      </section>

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
