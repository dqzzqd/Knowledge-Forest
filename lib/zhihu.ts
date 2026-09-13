/**
 * 知乎链接构造。
 *
 * 浇水 = "这个主题我还想继续看"，所以点下去把人送回知乎**这个主题**下，
 * 而不是某一条答案——一片叶子背后是几十条内容，只开一条就把视野窄掉了。
 *
 * 用搜索页（`/search?type=content&q=`）而不是主题页：主题页要 `topicId`，
 * 而演示数据里只有内容的 URL、没有主题 ID。搜索页的 q 就是主题名，
 * 不需要额外数据，且结果页正是"这个主题下的内容"。
 */

/** 某个主题在知乎的搜索页。主题名必须编码——中文不编码会被浏览器截断 */
export function zhihuTopicUrl(topic: string): string {
  return `https://www.zhihu.com/search?type=content&q=${encodeURIComponent(topic)}`;
}
