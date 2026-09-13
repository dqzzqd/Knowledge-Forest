import Link from "next/link";
import "./wood.css";

/**
 * 独立页面的唯一出口。
 *
 * 农夫日记 / 灵魂画像 / 光合作用报告是"走进去看"的三个独立空间，
 * 所以不放站点导航——进去之后只能从这里出来，避免看一半跳走。
 *
 * 外观是一块**深色小木牌**（贴图 wood-pill.webp）：这几个页面都有木料语汇
 * （木牌入口、木条、木板卡片），出口也用木的才是一套。
 * 左右内边距给得比一般按钮大——贴图两端是圆头，文字要落在中间的平面上；
 * 底下也留一截外边距——不然它会和下面那行标题/头像贴在一起。
 */
export default function ExitForest() {
  return (
    <Link
      href="/forest"
      aria-label="退出，回到森林"
      className="wood-pill mb-4 inline-flex items-center gap-1.5 px-6 py-2 text-sm focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#2F5541]"
    >
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      回森林
    </Link>
  );
}
