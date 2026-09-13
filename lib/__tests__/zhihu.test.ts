import { test } from "node:test";
import assert from "node:assert/strict";
import { zhihuTopicUrl } from "../zhihu.ts";

test("主题名要编码——中文不编码会被浏览器截断", () => {
  assert.equal(
    zhihuTopicUrl("程序员职业"),
    "https://www.zhihu.com/search?type=content&q=%E7%A8%8B%E5%BA%8F%E5%91%98%E8%81%8C%E4%B8%9A",
  );
});

test("带空格与英文的主题名同样安全", () => {
  assert.equal(
    zhihuTopicUrl("AI Agent"),
    "https://www.zhihu.com/search?type=content&q=AI%20Agent",
  );
});

test("搜索的是内容（type=content），不是用户或话题", () => {
  assert.ok(zhihuTopicUrl("心理学").includes("type=content"));
});
