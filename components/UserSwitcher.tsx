"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_USER_COOKIE, type DemoUserEntry } from "@/lib/demo-user";

/**
 * 切换用户。
 *
 * 选择写进 cookie 再 `router.refresh()`——页面是服务端组件，
 * 刷新后就会按新用户重新取数，各页之间跳转也自动延续同一个人。
 * 不用 URL 参数：演示时地址栏和前进/后退不该跟着变。
 */
export default function UserSwitcher({
  users,
  current,
}: {
  users: DemoUserEntry[];
  current: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // 点外面 / 按 Esc 收起
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (id: string) => {
    // 一年有效；SameSite=Lax 让正常跳转也能带上
    document.cookie = `${DEMO_USER_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
    setOpen(false);
    router.refresh();
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs text-[#2F5541] shadow-sm ring-1 ring-stone-200 backdrop-blur transition-colors hover:bg-white focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#2F5541]"
      >
        切换用户
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <ul
          role="menu"
          aria-label="选择用户"
          className="absolute left-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-2xl border border-stone-200 bg-white/95 p-1.5 shadow-xl backdrop-blur"
        >
          {users.map((u) => {
            const active = u.id === current;
            return (
              <li key={u.id}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => pick(u.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${
                    active ? "bg-[#5BA87A]/14" : "hover:bg-stone-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={u.avatar}
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 shrink-0 rounded-full ring-1 ring-white"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#2F4A38]">
                      {u.nickname}
                    </span>
                    <span className="block truncate text-[11px] text-[#6E7A66]">
                      {u.displayName}
                    </span>
                  </span>
                  {active ? (
                    <svg
                      className="h-4 w-4 shrink-0 text-[#5BA87A]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
