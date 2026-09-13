import { getReport } from "@/lib/ai/serve";
import { fail, ok, parseDateParam, parseUserId } from "@/lib/api";
import { TOTAL_DAYS, dayToDate } from "@/lib/replay";

/** 需要请求时读 mock-data/ai/，不能预渲染 */
export const dynamic = "force-dynamic";

/** 演示数据覆盖的日期范围 */
const FIRST_DATE = dayToDate(1);
const LAST_DATE = dayToDate(TOTAL_DAYS);

/**
 * GET /api/report?userId=user-a&date=2026-09-11
 *
 * 光合作用报告（契约 §4 / §5.4）。不传 date 则取最新有产物的一天。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = parseUserId(url);
  if (!userId) return fail("userId 必须是 user-a / user-b / user-c");

  const dateParam = url.searchParams.get("date");
  const date = parseDateParam(url, "date");
  if (dateParam !== null && date === null) return fail("date 需为 YYYY-MM-DD 格式");
  // 范围外的日期会被夹到第 1 天，返回一个**不是你要的那天**的报告。
  // 宁可明确报错，也不要静默换日期。
  if (date && (date < FIRST_DATE || date > LAST_DATE)) {
    return fail(`date 超出演示数据范围（${FIRST_DATE} ~ ${LAST_DATE}）`);
  }

  return ok(getReport(userId, date ?? undefined));
}
