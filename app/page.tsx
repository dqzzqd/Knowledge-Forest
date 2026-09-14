"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAssetUrl } from "@/components/use-asset-url";
import "./start-page.css";

/** 点「进入应用」后先让按钮过渡走完，再跳页 */
const ENTER_DELAY_MS = 260;

/** 标题图实际宽高比（3014×650），用它算高度才不会拉伸 */
const TITLE_RATIO = 3014 / 650;

const COVER_BG = "/cover-bg.jpg";
const COVER_TITLE = "/cover-title.webp";

export default function StartPage() {
  const router = useRouter();
  const [entering, setEntering] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const leaveRef = useRef<HTMLButtonElement>(null);

  // 封面两张大图走同一套带重试的加载器（见 components/use-asset-url.ts）。
  // 原先靠 `<image onError>` 换 `?r=n` 重试，但实测**不可靠**：网关限流返回的
  // 是 HTTP 200 + 一段 JSON，<image> 拿到之后解码失败，这个 error 事件并不一定
  // 触发——封面就停在米白兜底上，只能手动刷新。
  const bgSrc = useAssetUrl(COVER_BG);
  const titleSrc = useAssetUrl(COVER_TITLE);

  // 弹窗打开时把焦点送进去。
  // 用 setTimeout 而不是 rAF：rAF 在窗口不可见时不触发，焦点会静默丢失。
  // 再补一次重试：inert 移除后浏览器需要一帧才让子树可聚焦，首帧失败是常见的。
  useEffect(() => {
    if (!dialogOpen) return;
    const focusClose = () => closeRef.current?.focus();
    const t1 = window.setTimeout(focusClose, 0);
    const t2 = window.setTimeout(() => {
      if (!closeRef.current?.matches(":focus")) focusClose();
    }, 80);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [dialogOpen]);

  const enterForest = useCallback(() => {
    if (entering) return;
    setEntering(true);
    window.setTimeout(() => router.push("/forest"), ENTER_DELAY_MS);
  }, [entering, router]);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    // 焦点还给触发它的按钮，键盘用户才不会掉到页面开头
    leaveRef.current?.focus();
  }, []);

  // 照搬队友的设计：确认离开 = 自动关闭窗口。
  // window.close() 只能关闭「由脚本打开的窗口」（window.open / 打包应用），
  // 普通标签页会被浏览器安全策略拦下 —— 所以兜底退回空白页，等效“已退出”。
  const confirmLeave = useCallback(() => {
    setDialogOpen(false);
    window.close();
    window.setTimeout(() => {
      window.location.href = "about:blank";
    }, 150);
  }, []);

  return (
    <main className="scene">
      {/* 画框：按钮要相对「画面」定位，屏幕比例变化时才不会和背景错位 */}
      <div className="book-frame">
        <svg
          className="book"
          viewBox="0 0 1600 900"
          preserveAspectRatio="xMidYMid meet"
          aria-label="知了森林 封面"
        >
          {/* 米白纸底：背景图加载失败时的兜底 */}
          <rect x="0" y="0" width="1600" height="900" fill="#F8F5EC" />
          {/* 背景图：铺满画布，居中裁切、不变形。没取到就只留上面那层米白纸底 */}
          {bgSrc ? (
            <image
              href={bgSrc}
              x="0"
              y="0"
              width="1600"
              height="900"
              preserveAspectRatio="xMidYMid slice"
            />
          ) : null}
          {/* 标题：独立透明 PNG，居中置于顶部 */}
          {titleSrc ? (
            <image
              href={titleSrc}
              x="140"
              y="52"
              width="1320"
              height={Math.round(1320 / TITLE_RATIO)}
              preserveAspectRatio="xMidYMid meet"
            />
          ) : null}
        </svg>

        <section className="forest-entry" aria-label="知了森林入口">
        <button
          type="button"
          className={`entry-card entry-card--enter${entering ? " is-entering" : ""}`}
          onClick={enterForest}
        >
          <span className="entry-card__icon" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M17 6l10 10-10 10" />
              <path d="M27 16H5" />
            </svg>
          </span>
          <span className="entry-card__content">
            <strong>进入应用</strong>
            <small>走进你的兴趣森林</small>
          </span>
          <span className="entry-card__sparkle" aria-hidden="true">
            ✦
          </span>
        </button>

        <button
          ref={leaveRef}
          type="button"
          className="entry-card entry-card--leave"
          onClick={() => setDialogOpen(true)}
        >
          <span className="entry-card__icon" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M13 8H7.5A2.5 2.5 0 0 0 5 10.5v11A2.5 2.5 0 0 0 7.5 24H13" />
              <path d="M18 10l6 6-6 6" />
              <path d="M24 16H11" />
            </svg>
          </span>
          <span className="entry-card__content">
            <strong>离开森林</strong>
            <small>下次见，探索者</small>
          </span>
        </button>
        </section>

        {/* 功能预览：纯展示，不可交互 */}
        <section className="feature-preview" aria-label="应用功能预览">
        <div className="feature-card feature-card--sun">
          <span className="feature-card__icon" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="9.5" r="3.5" />
              <path d="M16 2.7v2.3M3.7 9.5h2.3M26 9.5h2.3M7 5.4l1.7 1.7M25 5.4l-1.7 1.7" />
              <path d="M16 17.8C12.9 19.5 12.9 23 16 24.4c3.1-1.4 3.1-4.9 0-6.6Z" />
              <path d="M16 18.4v5.2" />
            </svg>
          </span>
          <span className="feature-card__text">
            <strong>光合作用报告</strong>
            <small>看看昨天吸收了什么</small>
          </span>
        </div>

        <div className="feature-card feature-card--diary">
          <span className="feature-card__icon" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h9v22h-9A2.5 2.5 0 0 1 4 24.5V7.5Z" />
              <path d="M28 7.5A2.5 2.5 0 0 0 25.5 5h-9v22h9A2.5 2.5 0 0 0 28 24.5V7.5Z" />
              <path d="M8.5 11.5h4M8.5 15.5h4M8.5 19.5h2" />
              <path d="M19.5 11.5h4M19.5 15.5h4M19.5 19.5h2" />
            </svg>
          </span>
          <span className="feature-card__text">
            <strong>农夫日记</strong>
            <small>了解最近的自己</small>
          </span>
        </div>

        <div className="feature-card feature-card--timeline">
          <span className="feature-card__icon" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M7.51 19a9 9 0 1 0 2.13-9.36L5 14" />
              <path d="M5 8v6h6" />
              <path d="M16 21.5v-6" />
              <path d="M16 15.5c-2.8 0-4.2-1-4.2-2.3 0-1.2 1.4-2 4.2-2" />
              <path d="M16 15.5c2.8 0 4.2-1 4.2-2.3 0-1.2-1.4-2-4.2-2" />
            </svg>
          </span>
          <span className="feature-card__text">
            <strong>成长回放</strong>
            <small>回看森林如何长大</small>
          </span>
        </div>

        <div className="feature-card feature-card--care">
          <span className="feature-card__icon" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <rect x="7" y="12" width="12" height="10" rx="4.5" />
              <path d="M11 12V8a2 2 0 0 1 2-2h.5a2 2 0 0 1 2 2v4" />
              <path d="M19 14.5h4A1.5 1.5 0 0 1 24.5 16v1A1.5 1.5 0 0 1 23 18.5h-4" />
              <path d="M22.5 20.5v1.6M24 21v1.6M25.5 20.5v1.6" />
            </svg>
          </span>
          <span className="feature-card__text">
            <strong>浇水 / 修剪</strong>
            <small>照料你的兴趣枝叶</small>
          </span>
        </div>
        </section>
      </div>

      {/* 关闭时用 inert 而不是 aria-hidden：里面的按钮既不可聚焦也不可点，
          否则焦点会滞留在已隐藏的弹窗里 */}
      <div
        className={`leave-dialog${dialogOpen ? " is-open" : ""}`}
        inert={!dialogOpen}
      >
        <div
          className="leave-dialog__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leaveTitle"
        >
          <button
            ref={closeRef}
            type="button"
            className="leave-dialog__close"
            onClick={closeDialog}
            aria-label="关闭"
          >
            ×
          </button>
          <div className="dialog-leaf" aria-hidden="true">
            🍃
          </div>
          <h2 id="leaveTitle">要先离开森林吗？</h2>
          <p>你的森林会继续生长，随时欢迎你回来。</p>
          <div className="leave-dialog__actions">
            <button type="button" className="dialog-button dialog-button--stay" onClick={closeDialog}>
              再留一会儿
            </button>
            <button type="button" className="dialog-button dialog-button--leave" onClick={confirmLeave}>
              确认离开
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
