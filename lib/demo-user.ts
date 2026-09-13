/**
 * 演示用户的**清单**与身份 cookie —— 前后端共用的那一小块。
 *
 * 刻意**不依赖 lib/forest.ts**：那边有 `server-only`，客户端组件
 * （切换器）只要引用到它，浏览器端就会直接报错。
 * 依赖方向是反过来的——数据加载反过来依赖这里。
 */
export const DEMO_USERS = ["user-a", "user-b", "user-c"] as const;
export type DemoUserId = (typeof DEMO_USERS)[number];

export const DEMO_USER_COOKIE = "kf-user";

export function isDemoUserId(value: string | null | undefined): value is DemoUserId {
  return !!value && (DEMO_USERS as readonly string[]).includes(value);
}

/** 切换器要的用户条目（客户端也要用这个类型，所以放在这里） */
export interface DemoUserEntry {
  id: DemoUserId;
  nickname: string;
  displayName: string;
  avatar: string;
}
