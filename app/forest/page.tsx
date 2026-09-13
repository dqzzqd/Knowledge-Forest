import DayReplay from "@/components/DayReplay";
import { nowIso } from "@/lib/api";
import { deriveCicada } from "@/lib/cicada";
import { loadDemoUser, loadForest } from "@/lib/forest";

export default function Forest() {
  const user = loadDemoUser("user-a");
  const forest = loadForest("user-a");
  // 精灵的"此刻"在服务端定一次，随首屏一起送达，前端不用再拉一次接口
  const cicada = deriveCicada(forest, nowIso());

  return (
    <main className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-[#EAF3E4] to-[#DCE9D0]">
      {/* 细头部：森林才是主角，身份压成一行就够。
          这一页不放站点导航——两个气泡 + 圆形精灵就是导航。 */}
      <header className="mx-auto flex w-full max-w-[1500px] items-center gap-3 px-4 pt-4 pb-2 sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/avatars/user-a.svg"
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 rounded-full shadow-sm ring-1 ring-white/70"
        />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-bold text-[#2F4A38]">
            {user.nickname}
            <span className="ml-2 text-[11px] font-normal text-[#6E7A66]">
              {user.displayName}
            </span>
          </p>
          <p className="truncate text-[11px] text-[#6E7A66]">
            {user.tags.join(" · ")}
          </p>
        </div>
      </header>

      <DayReplay contents={user.contents} forest={forest} cicada={cicada} />

      {/* 溯源声明：合规要求，压到最小但必须留 */}
      <footer className="px-4 pb-3 text-center text-[10px] leading-relaxed text-[#7C876F] sm:px-6">
        演示数据：内容来自知乎真实作者的创作（经知乎官方 CLI 检索），时间线为演示编排 · 点击叶子可查看
      </footer>
    </main>
  );
}
