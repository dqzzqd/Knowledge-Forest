import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import "./profile.css";
import { getProfile } from "@/lib/ai/serve";
import { loadDemoUser, loadForest } from "@/lib/forest";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/contract";

const DEMO_USER = "user-a";

export default function ProfilePage() {
  const userId = DEMO_USER;
  const user = loadDemoUser(userId);
  const forest = loadForest(userId);
  const profile = getProfile(userId);

  const categories = profile.topCategories.filter((c) => c.weight > 0);

  return (
    <main className="portrait">
      <div className="portrait__page">
        <SiteNav current="/profile" />

        <header className="cover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="cover__avatar"
            src="/avatars/user-a.svg"
            alt=""
            width={60}
            height={60}
          />
          <div>
            <h1 className="cover__name">{user.nickname}</h1>
            <p className="cover__kind">
              {user.displayName} · {forest.trees.length} 棵树 ·{" "}
              {forest.leaves.length} 片叶子
            </p>
          </div>
        </header>

        {/* 印章 + 自述：这一页的主句 */}
        <section className="anchor" aria-label="灵魂画像">
          <span className="seal">{profile.soulType}</span>
          <div>
            <p className="anchor__desc">
              <span className="anchor__emoji" aria-hidden="true">
                {profile.soulTypeEmoji}
              </span>
              {profile.description}
            </p>
            <ul className="anchor__traits">
              {profile.traits.map((trait) => (
                <li key={trait.label} className="trait">
                  <span className="trait__label">{trait.label}</span>
                  <span className="trait__score">{trait.score}</span>
                  <span className="trait__evidence">{trait.evidence}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {categories.length > 0 ? (
          <section className="cats" aria-labelledby="cats-title">
            <h2 className="cats__title" id="cats-title">
              注意力分布
            </h2>
            <ul className="cats__list">
              {categories.map((c) => (
                <li key={c.category} className="cat">
                  <span className="cat__name">{CATEGORY_LABELS[c.category]}</span>
                  <span className="cat__track">
                    <span
                      className="cat__fill"
                      style={{
                        width: `${c.weight}%`,
                        background: CATEGORY_COLORS[c.category],
                      }}
                    />
                  </span>
                  <span className="cat__weight">{c.weight}%</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-9 flex justify-center">
          <Link
            href="/card?type=profile"
            className="inline-flex items-center rounded-full bg-[#5BA87A] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#4E9669] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#2F5541]"
          >
            做成分享卡
          </Link>
        </div>

        <footer className="portrait__foot">
          <p>
            画像由大模型根据你三十天的真实收藏分布写成。内容来自知乎公开内容，时间线为演示编排。
          </p>
        </footer>
      </div>
    </main>
  );
}
