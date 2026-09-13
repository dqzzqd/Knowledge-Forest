import "server-only";
import { cookies } from "next/headers";
import { DEMO_USERS, type DemoUserId } from "@/lib/forest";
import { DEMO_USER_COOKIE, isDemoUserId } from "@/lib/demo-user";

/**
 * 当前选中的演示用户。
 *
 * 放在 cookie 里而不是 URL 参数上：演示时切换用户不该让地址栏和
 * 前进/后退跟着变，而且页面之间跳转要自动延续同一个人的森林。
 * cookie 非法或缺失时回落到第一个用户，不报错。
 */
export async function getDemoUserId(): Promise<DemoUserId> {
  const raw = (await cookies()).get(DEMO_USER_COOKIE)?.value;
  return isDemoUserId(raw) ? raw : DEMO_USERS[0];
}
