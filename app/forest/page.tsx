import DayReplay from "@/components/DayReplay";
import UserSwitcher from "@/components/UserSwitcher";
import { nowIso } from "@/lib/api";
import { atmosphereFor, hourFromIso } from "@/lib/atmosphere";
import { deriveCicada } from "@/lib/cicada";
import { listDemoUsers, loadDemoUser, loadForest } from "@/lib/forest";
import { getDemoUserId } from "@/lib/session";

export default async function Forest({
  searchParams,
}: {
  searchParams: Promise<{ hour?: string | string[] }>;
}) {
  // 当前看谁的森林：由 cookie 决定（切换器写、这里读）
  const userId = await getDemoUserId();
  const user = loadDemoUser(userId);
  const forest = loadForest(userId);
  // 精灵的"此刻"在服务端定一次，随首屏一起送达，前端不用再拉一次接口
  const now = nowIso();
  const cicada = deriveCicada(forest, now);
  // 昼夜氛围也按这个时刻定：服务端算好传下去，避免两端算出不同的时段。
  // `?hour=` 只是给演示/自检用的手动覆盖，正常走真实时间。
  const raw = (await searchParams).hour;
  const forced = typeof raw === "string" ? Number(raw) : NaN;
  const hour =
    Number.isInteger(forced) && forced >= 0 && forced <= 23
      ? forced
      : hourFromIso(now);
  const atm = atmosphereFor(hour);

  return (
    <main className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-[#EAF3E4] to-[#DCE9D0]">
      {/* 细头部：森林才是主角，身份压成一行就够。
          这一页不放站点导航——两个气泡 + 圆形精灵就是导航。 */}
      <header className="mx-auto flex w-full max-w-[1500px] items-center gap-3 px-4 pt-4 pb-2 sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/avatars/${userId}.svg`}
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
            <span className="ml-2 rounded-full bg-white/70 px-2 py-0.5 text-[10px] text-[#4a5b47]">
              此刻 {atm.label} · 森林随现实时间换光
            </span>
          </p>
        </div>
        <UserSwitcher users={listDemoUsers()} current={userId} />
      </header>

      <DayReplay
        userId={userId}
        contents={user.contents}
        forest={forest}
        cicada={cicada}
        hour={hour}
      />

      {/* 溯源声明：合规要求，压到最小但必须留 */}
      <footer className="px-4 pb-3 text-center text-[10px] leading-relaxed text-[#7C876F] sm:px-6">
        演示数据：内容来自知乎真实作者的创作（经知乎官方 CLI 检索），时间线为演示编排 · 点击叶子可查看
      </footer>
    </main>
  );
}
