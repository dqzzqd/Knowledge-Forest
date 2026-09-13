"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "./start-page.css";

/** 点「进入应用」后先让按钮过渡走完，再跳页 */
const ENTER_DELAY_MS = 260;

/** 标题图实际宽高比（3014×650），用它算高度才不会拉伸 */
const TITLE_RATIO = 3014 / 650;

export default function StartPage() {
  const router = useRouter();
  const [entering, setEntering] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const leaveRef = useRef<HTMLButtonElement>(null);

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
          {/* 背景图：铺满画布，居中裁切、不变形 */}
          <image
            href="/cover-bg.jpg"
            x="0"
            y="0"
            width="1600"
            height="900"
            preserveAspectRatio="xMidYMid slice"
          />
          {/* 标题：独立透明 PNG，居中置于顶部 */}
          <image
            href="/cover-title.webp"
            x="140"
            y="52"
            width="1320"
            height={Math.round(1320 / TITLE_RATIO)}
            preserveAspectRatio="xMidYMid meet"
          />
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
            <button type="button" className="dialog-button dialog-button--leave" onClick={closeDialog}>
              确认离开
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
