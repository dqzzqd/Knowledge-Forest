import Link from "next/link";

/**
 * 独立页面的唯一出口。
 *
 * 农夫日记 / 灵魂画像 / 光合作用报告是"走进去看"的三个独立空间，
 * 所以不放站点导航——进去之后只能从这里出来，避免看一半跳走。
 */
export default function ExitForest() {
  return (
    <Link
      href="/forest"
      aria-label="退出，回到森林"
      className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1.5 text-sm text-[#2F5541] shadow-sm ring-1 ring-stone-200 backdrop-blur transition-colors hover:bg-white focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#2F5541]"
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
