/* 知了森林 · mock 数据集生成器（30 天版）
 * 输入：mock-data/raw/*.json（search zhihu 抓到的真实内容）
 * 输出：mock-data/mock/<user>.json              —— 契约 §6 格式 + 用户档案
 *       mock-data/mock/days/<user>/day-NN.json  —— 按天切片（30 天），供回放演示
 *       mock-data/expected-forest/<user>.json   —— 预生成树/叶/布局（演示兜底）
 *       mock-data/avatars/<user>.svg            —— 用户头像
 */
const fs = require("fs"), path = require("path");
const RAW = process.env.RAW, OUT = process.env.OUT;

const PAD = n => String(n).padStart(2, "0");
const dayOf = n => { const d = new Date(Date.UTC(2026, 7, 15)); d.setUTCDate(d.getUTCDate() + n - 1); return d.toISOString().slice(0, 10); };
const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const TS = (n, seed) => dayOf(n) + "T" + PAD(8 + (seed % 3)) + ":" + PAD(seed % 60) + ":00+08:00";
const TSN = (n, seed) => dayOf(n) + "T" + PAD(21 + (seed % 3)) + ":" + PAD(seed % 60) + ":00+08:00";

const TOTAL_DAYS = 30;   // 2026-08-15 → 2026-09-13

/* ── 用户档案 ── */
const USERS = {
  "user-a": {
    userId: "user_a_shenqian", displayName: "深潜型探索者", nickname: "海沟观测员",
    bio: "不太追热点，喜欢把一个领域挖到底。60% 的收藏都在人工智能这一棵树上。",
    tags: ["人工智能", "创业", "心理学"],
    avatar: "avatars/user-a.svg",
    avatarSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4A90D9"/><stop offset="100%" stop-color="#16304F"/></linearGradient></defs>
<circle cx="60" cy="60" r="60" fill="url(#a)"/>
<path d="M8 54 q26 -11 52 0 t52 0" stroke="#BFE3FF" stroke-width="3" fill="none" opacity=".5"/>
<path d="M8 70 q26 -11 52 0 t52 0" stroke="#BFE3FF" stroke-width="3" fill="none" opacity=".36"/>
<path d="M8 86 q26 -11 52 0 t52 0" stroke="#BFE3FF" stroke-width="3" fill="none" opacity=".22"/>
<circle cx="60" cy="38" r="10" fill="#EAF6FF"/><circle cx="60" cy="38" r="4" fill="#4A90D9"/></svg>`
  },
  "user-b": {
    userId: "user_b_renwen", displayName: "突然转向的漫游者", nickname: "半路改道的旅人",
    bio: "历史和文学是双主干。第 16 天被哲学击中，之后一发不可收拾。",
    tags: ["历史", "文学", "哲学"],
    avatar: "avatars/user-b.svg",
    avatarSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
<defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7BA05B"/><stop offset="100%" stop-color="#2D5016"/></linearGradient></defs>
<circle cx="60" cy="60" r="60" fill="url(#b)"/>
<path d="M38 110 q14 -24 2 -40 q-12 -16 8 -30" stroke="#DCEFD8" stroke-width="7" fill="none" stroke-linecap="round" opacity=".8"/>
<circle cx="76" cy="36" r="9" fill="#F0FAE8"/><circle cx="76" cy="36" r="3.5" fill="#7BA05B"/></svg>`
  },
  "user-c": {
    userId: "user_c_zashi", displayName: "广而不深的收藏家", nickname: "什么都想知道的松鼠",
    bio: "10 个话题，每个 6 条。什么都感兴趣，什么都不深入。",
    tags: ["摄影", "旅行", "美食", "宠物"],
    avatar: "avatars/user-c.svg",
    avatarSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
<defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#E8B857"/><stop offset="100%" stop-color="#B4651F"/></linearGradient></defs>
<circle cx="60" cy="60" r="60" fill="url(#c)"/>
<circle cx="42" cy="42" r="10" fill="#FFF6DC"/>
<rect x="63" y="32" width="20" height="20" rx="5" fill="#FFF6DC" opacity=".85"/>
<path d="M52 70 l11 18 h-22 z" fill="#FFF6DC" opacity=".8"/>
<circle cx="80" cy="76" r="9" fill="#FFF6DC" opacity=".7"/></svg>`
  }
};

/* ── 30 天剧情线 ──
 * 每个叶子的 days 数组 = 该叶子的内容分别落在第几天（1 = 08-15，30 = 09-13）
 */
const PLAN = {
  "user-a": { trees: [
    { treeId: "tree_ai", name: "人工智能", category: "tech", leaves: [
      { leafId: "leaf_ai_agent", name: "AI Agent", slug: "ai_agent", days: [3, 5, 10, 16, 20, 22, 22, 22, 26, 29] },   // 22 日爆发
      { leafId: "leaf_ai_rag",   name: "RAG",      slug: "rag",      days: [4, 6, 9, 12, 15, 18, 21, 25, 27, 30] },
      { leafId: "leaf_ai_llm",   name: "大模型落地", slug: "llm",      days: [14, 17, 19, 22, 24, 26, 28, 29, 30, 30] } ] },  // 第 14 天长出的新叶
    { treeId: "tree_startup", name: "创业与产品", category: "business", leaves: [
      { leafId: "leaf_startup", name: "创业冷启动", slug: "startup", days: [2, 6, 9, 13, 17, 21] },
      { leafId: "leaf_pm",      name: "产品经理",   slug: "pm",      days: [5, 8, 12, 16, 20] } ] },
    { treeId: "tree_career", name: "职业发展", category: "life", leaves: [
      { leafId: "leaf_career", name: "程序员职业", slug: "career", days: [1, 4, 8, 13, 19, 24] } ] },
    { treeId: "tree_psych", name: "心理学", category: "science", leaves: [
      { leafId: "leaf_psych", name: "自我认知", slug: "psych", days: [14, 15, 15, 18, 21, 25, 28] } ] },   // 第 14 天新树
    { treeId: "tree_fitness", name: "健身", category: "life", leaves: [
      { leafId: "leaf_fitness", name: "习惯养成", slug: "fitness", days: [1, 3, 5, 8, 11, 13] } ] }        // 第 13 天后停止 → 枯萎
  ]},
  "user-b": { trees: [
    { treeId: "tree_history", name: "历史", category: "humanities", leaves: [
      { leafId: "leaf_history_ming", name: "明朝", slug: "history_ming", days: [1, 3, 6, 9, 13, 17, 21, 26] },
      { leafId: "leaf_history_song", name: "宋朝经济", slug: "history_song", days: [2, 5, 8, 12, 16, 20, 25] } ] },
    { treeId: "tree_literature", name: "文学", category: "arts", leaves: [
      { leafId: "leaf_literature", name: "古典文学", slug: "literature", days: [1, 4, 7, 11, 15, 19, 24, 28] },
      { leafId: "leaf_writing",    name: "写作表达", slug: "writing",   days: [6, 10, 14, 18, 22, 27, 29] } ] },
    { treeId: "tree_philosophy", name: "哲学", category: "humanities", leaves: [
      { leafId: "leaf_philosophy", name: "中西比较", slug: "philosophy", days: [16, 19, 19, 19, 23, 26, 28, 30, 30] } ] },  // 16 日新树，19 日爆发
    { treeId: "tree_art", name: "艺术", category: "arts", leaves: [
      { leafId: "leaf_art", name: "中国画审美", slug: "art", days: [3, 6, 9, 12, 15, 21, 24, 27] } ] },    // 15→21 空窗 6 天 → 枯萎后复苏
    { treeId: "tree_society", name: "社会观察", category: "social", leaves: [
      { leafId: "leaf_society", name: "内卷与年轻人", slug: "society", days: [2, 5, 8, 11, 14, 17] } ] }   // 第 17 天后停止 → 枯萎
  ]},
  "user-c": { trees: [
    { treeId: "tree_photography", name: "摄影", category: "arts",     leaves: [{ leafId: "leaf_photography", name: "构图入门", slug: "photography", days: [6, 6, 6, 12, 19, 26] }] },  // 6 日爆发
    { treeId: "tree_travel",      name: "旅行", category: "life",     leaves: [{ leafId: "leaf_travel",      name: "独自旅行", slug: "travel",      days: [3, 8, 13, 18, 23, 28] }] },
    { treeId: "tree_food",        name: "美食", category: "life",     leaves: [{ leafId: "leaf_food",        name: "家常菜",   slug: "food",        days: [2, 7, 12, 17, 22, 27] }] },
    { treeId: "tree_movie",       name: "电影", category: "arts",     leaves: [{ leafId: "leaf_movie",       name: "镜头语言", slug: "movie",       days: [5, 10, 15, 20, 25, 30] }] },
    { treeId: "tree_music",       name: "音乐", category: "arts",     leaves: [{ leafId: "leaf_music",       name: "乐理入门", slug: "music",       days: [4, 9, 14, 19, 24, 29] }] },
    { treeId: "tree_finance",     name: "理财", category: "business", leaves: [{ leafId: "leaf_finance",     name: "基金定投", slug: "finance",     days: [7, 12, 17, 22, 27, 30] }] },
    { treeId: "tree_homedecor",   name: "家居", category: "life",     leaves: [{ leafId: "leaf_homedecor",   name: "小户型",   slug: "homedecor",   days: [1, 2, 3, 4, 5, 6] }] },  // 第 6 天后停止 → 枯萎
    { treeId: "tree_pet",         name: "宠物", category: "life",     leaves: [{ leafId: "leaf_pet",         name: "养猫",     slug: "pet",         days: [2, 8, 14, 20, 26, 30] }] },
    { treeId: "tree_running",     name: "运动", category: "life",     leaves: [{ leafId: "leaf_running",     name: "马拉松",   slug: "running",     days: [4, 10, 16, 22, 28, 30] }] },
    { treeId: "tree_python",      name: "编程入门", category: "tech", leaves: [{ leafId: "leaf_python",      name: "Python自学", slug: "python",    days: [12, 15, 18, 21, 24, 27] }] }   // 第 12 天突然想学 Python → 新树
  ]}
};

/* 行为递进：搜索发现 → 点赞 → 收藏 */
const srcByOrder = (i, n, cid) => i === 0 ? "search" : i === n - 1 ? "favorite" : (hash(cid) % 2 ? "like" : "favorite");
const srcNoise = cid => hash(cid) % 3 === 0 ? "search" : "like";
const cleanUrl = u => String(u).replace(/[?&]utm_(medium|source)=[^&]*/g, "").replace(/[?&]$/, "");

/* 生活杂事噪声：不归入任何主题（category = null） */
const NOISE = { "user-a": ["washer", "router"], "user-b": ["downcoat", "license"], "user-c": ["cold", "ac"] };
const noiseRaw = {};
for (const f of fs.readdirSync(RAW).filter(f => f.startsWith("noise-"))) {
  noiseRaw[path.basename(f, ".json").replace("noise-", "")] = (JSON.parse(fs.readFileSync(path.join(RAW, f), "utf8")).Data || {}).Items || [];
}
const raw = {};
for (const f of fs.readdirSync(RAW).filter(f => f.endsWith(".json") && !f.startsWith("noise-"))) {
  const [persona, slug] = path.basename(f, ".json").split("-");
  raw[persona + "/" + slug] = (JSON.parse(fs.readFileSync(path.join(RAW, f), "utf8")).Data || {}).Items || [];
}

const report = [];
for (const [user, plan] of Object.entries(PLAN)) {
  const meta = USERS[user], P = user === "user-a" ? "A" : user === "user-b" ? "B" : "C";
  const contents = [], trees = [], leaves = [];
  for (const t of plan.trees) {
    const treeLeaves = [];
    for (const lf of t.leaves) {
      const items = raw[P + "/" + lf.slug] || [];
      const used = Math.min(items.length, lf.days.length);
      const ids = [];
      for (let i = 0; i < used; i++) {
        const it = items[i], cid = "content_" + it.ContentID, h = hash(cid);
        contents.push({
          contentId: cid, title: it.Title,
          excerpt: String(it.ContentText || "").replace(/\s+/g, " ").slice(0, 120),
          url: cleanUrl(it.Url), voteUpCount: it.VoteUpCount ?? 0,
          source: srcByOrder(i, used, cid), category: t.category,
          interactedAt: (h % 10 < 6 ? TSN : TS)(lf.days[i], h)
        });
        ids.push(cid);
      }
      treeLeaves.push(lf.leafId);
      const first = Math.min(...lf.days), last = Math.max(...lf.days);
      leaves.push({
        leafId: lf.leafId, treeId: t.treeId, name: lf.name,
        summary: (items[0] ? String(items[0].Title) : lf.name) + " 等相关内容",
        contentIds: ids,
        state: (TOTAL_DAYS - last) >= 8 ? "withered" : (TOTAL_DAYS - last) >= 4 ? "fading" : "fresh",
        createdAt: dayOf(first) + "T10:00:00+08:00",
        lastActiveAt: dayOf(last) + "T22:00:00+08:00", waterCount: 0
      });
    }
    const allDays = t.leaves.flatMap(l => l.days);
    const cnt = leaves.filter(l => l.treeId === t.treeId).reduce((s, l) => s + l.contentIds.length, 0);
    trees.push({
      treeId: t.treeId, name: t.name, category: t.category,
      stage: cnt >= 15 ? "flourishing" : cnt >= 8 ? "mature" : cnt >= 4 ? "young" : "sprout",
      leafIds: treeLeaves, totalContentCount: cnt,
      createdAt: dayOf(Math.min(...allDays)) + "T10:00:00+08:00",
      lastGrownAt: dayOf(Math.max(...allDays)) + "T22:00:00+08:00", prunedLeafIds: []
    });
  }
  // 孤立条目
  const noiseDays = [5, 9, 13, 18, 23, 28];
  (NOISE[user] || []).forEach((kind, ki) => {
    for (const it of (noiseRaw[kind] || [])) {
      const cid = "content_" + it.ContentID, h = hash(cid);
      contents.push({
        contentId: cid, title: it.Title,
        excerpt: String(it.ContentText || "").replace(/\s+/g, " ").slice(0, 120),
        url: cleanUrl(it.Url), voteUpCount: it.VoteUpCount ?? 0,
        source: srcNoise(cid), category: null,
        interactedAt: (h % 10 < 5 ? TSN : TS)(noiseDays[(ki * 2 + h) % noiseDays.length], h)
      });
    }
  });
  contents.sort((a, b) => a.interactedAt.localeCompare(b.interactedAt));

  const layout = trees.map((t, i) => {
    const GOLDEN = 2.399963, r = 0.16 + 0.30 * Math.sqrt(i / Math.max(1, trees.length - 1));
    return {
      treeId: t.treeId,
      x: +(0.5 + r * Math.cos(i * GOLDEN)).toFixed(3),
      y: +(0.5 + r * Math.sin(i * GOLDEN)).toFixed(3),
      scale: +(0.7 + 0.6 * Math.min(1, t.totalContentCount / 20)).toFixed(2)
    };
  });

  const dir = path.join(OUT, "mock"), daysDir = path.join(dir, "days", user), efDir = path.join(OUT, "expected-forest"), avDir = path.join(OUT, "avatars");
  fs.mkdirSync(daysDir, { recursive: true }); fs.mkdirSync(efDir, { recursive: true }); fs.mkdirSync(avDir, { recursive: true });

  fs.writeFileSync(path.join(dir, user + ".json"), JSON.stringify({
    userId: meta.userId, displayName: meta.displayName, nickname: meta.nickname,
    bio: meta.bio, tags: meta.tags, avatar: "../../" + meta.avatar,
    generatedAt: "2026-09-13T22:00:00+08:00", contents
  }, null, 2));

  for (let d = 1; d <= TOTAL_DAYS; d++) {
    const ds = dayOf(d);
    fs.writeFileSync(path.join(daysDir, "day-" + PAD(d) + ".json"),
      JSON.stringify({ userId: meta.userId, date: ds, dayIndex: d, contents: contents.filter(c => c.interactedAt.startsWith(ds)) }, null, 2));
  }
  fs.writeFileSync(path.join(efDir, user + ".json"), JSON.stringify({
    userId: meta.userId, displayName: meta.displayName, nickname: meta.nickname,
    bio: meta.bio, tags: meta.tags, avatar: "../../" + meta.avatar,
    generatedAt: dayOf(TOTAL_DAYS) + "T22:00:00+08:00", trees, leaves, layout
  }, null, 2));
  fs.writeFileSync(path.join(OUT, meta.avatar), meta.avatarSvg);
  report.push([meta.nickname, dayOf(1), dayOf(TOTAL_DAYS), trees.length, leaves.length, contents.length]);
}

console.log("昵称".padEnd(22) + "起止".padEnd(24) + "树  叶  内容");
for (const r of report) console.log(String(r[0]).padEnd(22) + String(r[1] + " ~ " + r[2]).padEnd(24) + String(r[3]).padEnd(4) + String(r[4]).padEnd(4) + r[5]);
console.log("\n输出目录:", OUT);
