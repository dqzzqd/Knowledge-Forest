import Link from "next/link";
import type { ReactNode } from "react";
import "./SceneBubble.css";

/**
 * 场景里的悬浮气泡入口。
 *
 * 气泡的尖角朝向森林（tail 决定方向），所以它是"从森林里冒出来的话"，
 * 而不是压在画面上的按钮。
 */
export default function SceneBubble({
  href,
  label,
  hint,
  icon,
  tail,
}: {
  href: string;
  label: string;
  hint: string;
  icon: ReactNode;
  /** 尖角朝向：气泡贴在左侧就朝右，贴在右侧就朝左 */
  tail: "left" | "right";
}) {
  return (
    <Link href={href} className={`bubble bubble--tail-${tail}`}>
      <span className="bubble__icon" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          {icon}
        </svg>
      </span>
      <span className="bubble__text">
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
    </Link>
  );
}

/** 太阳 + 嫩叶：光合作用报告 */
export const ReportIcon = (
  <>
    <circle cx="16" cy="9.5" r="3.5" />
    <path d="M16 2.7v2.3M3.7 9.5h2.3M26 9.5h2.3M7 5.4l1.7 1.7M25 5.4l-1.7 1.7" />
    <path d="M16 17.8C12.9 19.5 12.9 23 16 24.4c3.1-1.4 3.1-4.9 0-6.6Z" />
    <path d="M16 18.4v5.2" />
  </>
);

/** 摊开的笔记本：农夫日记 */
export const DiaryIcon = (
  <>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h9v22h-9A2.5 2.5 0 0 1 4 24.5V7.5Z" />
    <path d="M28 7.5A2.5 2.5 0 0 0 25.5 5h-9v22h9A2.5 2.5 0 0 0 28 24.5V7.5Z" />
    <path d="M8.5 11.5h4M8.5 15.5h4M8.5 19.5h2" />
    <path d="M19.5 11.5h4M19.5 15.5h4M19.5 19.5h2" />
  </>
);
