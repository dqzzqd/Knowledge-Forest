/**
 * 精灵落点与台词气泡的几何。
 *
 * 单独成文件，是因为 ForestCanvas 是组件（JSX）——放进 lib 才能被 lib/__tests__
 * 直接跑：**"精灵不许遮挡树名"是硬约束，值得一条回归测试守住**。
 *
 * 会遮挡的只有两样东西，都挂在锚点 `spot` 上：
 *   精灵  横 ±32，纵 −34.3 … +14.7
 *   气泡  锚点上方 54±17，宽随台词长短变（长句能到 430，非常占地方）
 * 树名两行（树名 + "N 条 · 阶段"）是信息不是装饰，两者都不能压上去。
 */

/** 画布尺寸，与 ForestCanvas 的 viewBox 一致 */
export const CANVAS_W = 1200;

/** 精灵贴图显示尺寸（用户坐标）。原图 640×490，按宽算高才不会拉伸 */
export const SPRITE_W = 64;
export const SPRITE_H = Math.round(SPRITE_W / (640 / 490));

/** 精灵锚点在贴图偏下位置：视觉重心落在锚点上，图上移 0.7 个身位 */
const SPRITE_LIFT = 0.7;
/** 贴图相对锚点的上缘 / 下缘（画图与落点计算共用） */
export const SPRITE_TOP = -SPRITE_H * SPRITE_LIFT;
const SPRITE_BOTTOM = SPRITE_H * (1 - SPRITE_LIFT);

/** 台词字号；中日韩字符约等于 1em，用它估气泡宽度 */
export const BUBBLE_FONT_SIZE = 18;
/** 气泡最小宽度 / 左右内边距 / 上下内边距 */
const BUBBLE_MIN_W = 140;
const BUBBLE_PAD = 34;
const BUBBLE_PAD_Y = 6;
/** 气泡的行高 */
export const BUBBLE_LINE_H = 22;
/** 单行最多几个字，超了就折行 */
const BUBBLE_MAX_CHARS = 12;
/** 气泡底边离锚点多远——等于给精灵头顶留出的空隙 */
export const BUBBLE_GAP = 37;
/** 气泡离画布左右边缘的安全边距 */
const BUBBLE_EDGE = 10;

/**
 * 树名两行的排版。**由 TreeLabel 直接引用**，不各写一份——
 * 字号或基线一改，落点算出来的盒子就和实际画出来的对不上，精灵会开始压字。
 *
 * 上缘另留 2px：字体的实际上伸比字号略高，浏览器量出来的字形框比
 * "基线 − 字号"还要高一点，按基线算会把气泡的底边放进字形里。
 *
 * 字号放大过一档（16/12 → 19/13）：树名是"这棵树是什么主题"唯一的直接线索，
 * 太小就压不住上面那排木牌和下面那条回放条。
 */
export const LABEL_NAME_SIZE = 19;
export const LABEL_NAME_DY = 28;
export const LABEL_STAT_SIZE = 13;
export const LABEL_STAT_DY = 51;

/**
 * 落在目标树基线下方多远处的候选高度：从紧贴树脚往下扫。
 *
 * 为什么是细扫而不是几个固定档位：相邻两棵树的树名之间常常只剩十几像素的
 * 干净窗口，步长一大就整段跨过去了，结果明明是"附近有地方站"，
 * 却被迫飘到树名之上。步长取树名行高的一半以下，才扫得到那些窗口。
 */
const GROUND_FROM = 46;
const GROUND_TO = 176;
/**
 * 步长要**小于树名行高的一半**。树名之间常常只剩十几像素的干净窗口，
 * 步长一大就整段跨过去了——结果明明是"旁边有地方站"，却被迫挪到别处。
 */
const GROUND_STEP = 6;
/**
 * 前景草地这一带：**绝对高度**，不是相对树基。
 *
 * 为什么非要另有一档绝对的：只按"树基往下"取候选的话，长在远处的树
 * （树基才 340 上下）永远够不到前景草地，于是长台词的气泡只好停在
 * 树冠那一层——**把叶子盖住**。而"站在树下那片空草地上"才是最该放的地方：
 * 气泡跟着落到树冠之下，既不压树名，也不挡叶子。
 */
const MEADOW_FROM = 560;
const MEADOW_TO = 574;
/** 横向候选：按树宽的倍数左右对称取，先近后远 */
const SPREADS = [0, 0.5, -0.5, 0.85, -0.85, 1.25, -1.25, 1.7, -1.7];
/** 兜底横带离最高的树名再留这么多 */
const CLEAR_BAND_MARGIN = 18;
/** 顶部悬浮木牌压住画布顶部的这一段，气泡不能钻进去 */
const SIGN_BAND_BOTTOM = 265;
/**
 * 底部回放条的实木条压住画布底部的这一段，精灵不能站上去。
 *
 * 取 585 是量出来的、按**最不利视口**定的：回放条的高是固定像素，而画布高随宽走，
 * 所以视口越窄、它换算成用户坐标就越高——640px（sm 断点）时木条顶边约在 588，
 * 1440px 时退到 682。按最窄的算，任何桌面宽度都安全。
 */
const BAR_BAND_TOP = 585;
/** 回放条之上。落点的精灵底边必须 ≤ 它（回归测试据此断言） */
export const REPLAY_BAR_TOP = BAR_BAND_TOP;

/**
 * 候选落点的纵向上限：**精灵的脚不能站到木条上去**。
 *
 * 这是硬约束，直接夹紧、不进代价函数。做成软代价的话，"躲木条"会和
 * "别离目标树太远"互相拉扯——实测下来精灵会为了不踩木条，
 * 跑到三百像素外的另一棵树下讲这棵树的事。
 */
const MAX_SPOT_Y = BAR_BAND_TOP - SPRITE_BOTTOM;

/** 锚点横向被夹在这个范围里（再往外精灵就贴边走形了） */
const SPOT_HALF = SPRITE_W / 2 + 2;
/** 观感基准：落在这一带附近最像"站在草地上"，越往上越显得飘 */
const GROUND_LOOK_Y = 430;

export interface TreeLabelGeometry {
  treeId: string;
  /** 树冠中心 x —— 树名就居中在这里 */
  x: number;
  /** 树基线 y —— 树名从这里往下排 */
  baseY: number;
  width: number;
  /** 树冠椭圆：叶子撒在里面，**精灵和气泡都不该盖上去**——叶子是能点的 */
  canopyY: number;
  canopyRx: number;
  canopyRy: number;
  name: string;
  /** 第二行（用 statText 生成，与 TreeLabel 同口径） */
  statText: string;
}

/** 落点（SVG 用户坐标） */
export interface CicadaSpot {
  x: number;
  y: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 树名第二行的文字。TreeLabel 与落点计算共用，宽度才不会两处对不上 */
export function statText(total: number, stageLabel: string): string {
  return `${total} 条 · ${stageLabel}`;
}

/**
 * 可以断行的地方。标点之后断开比从字中间断开好读。
 */
const BREAK_AFTER = /[，。！？、；：）】」』～…·]/;

/**
 * 把台词折成几行。
 *
 * 折行不只是好读——**气泡宽度直接决定它能不能落在树附近**：
 * 一句 22 字的台词单行要 430px 宽，比树名之间最大的空隙（user-a 实测 187px）
 * 还宽，于是精灵被挤到几百像素外去讲这棵树的事。折行后宽度减半，就能贴着树站。
 */
export function bubbleLines(line: string): string[] {
  const lines: string[] = [];
  let rest = line;
  while (rest.length > BUBBLE_MAX_CHARS) {
    let cut = 0;
    // 在理想断点附近 ±4 字内找标点；找不到就硬断
    for (let d = 0; d <= 4 && cut === 0; d++) {
      for (const at of [BUBBLE_MAX_CHARS + d, BUBBLE_MAX_CHARS - d]) {
        if (at > 0 && at < rest.length && BREAK_AFTER.test(rest[at - 1])) {
          cut = at;
          break;
        }
      }
    }
    if (cut === 0) cut = BUBBLE_MAX_CHARS;
    lines.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  lines.push(rest);
  return lines;
}

/**
 * 台词气泡的宽度（用户坐标）：按最长的那行算。
 * 中日韩字符按 1em 估——估宽了只是留白，估窄了就成了遮挡。
 */
export function bubbleWidth(line: string): number {
  const longest = bubbleLines(line).reduce((max, l) => Math.max(max, l.length), 0);
  return Math.max(BUBBLE_MIN_W, longest * BUBBLE_FONT_SIZE + BUBBLE_PAD);
}

/** 气泡高度：由行数决定 */
export function bubbleHeight(line: string): number {
  return bubbleLines(line).length * BUBBLE_LINE_H + BUBBLE_PAD_Y * 2;
}

/**
 * 气泡相对锚点的水平位移：把气泡夹在画面内。
 * Cicada 画的时候用它，落点计算也用它——两处必须是同一个数。
 */
export function bubbleOffset(anchorX: number, width: number): number {
  const min = BUBBLE_EDGE + width / 2 - anchorX;
  const max = CANVAS_W - BUBBLE_EDGE - width / 2 - anchorX;
  return max < min ? 0 : Math.min(max, Math.max(min, 0));
}

/** 全角字符：中日韩部首/汉字、CJK 标点、全角形式 */
const FULL_WIDTH = /[⺀-鿿　-〿＀-￯]/;

/** 粗略估宽：全角（中日韩、CJK 标点）按 1em，其余（数字、空格、·）按 0.55em */
function textWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const ch of text) {
    width += FULL_WIDTH.test(ch) ? fontSize : fontSize * 0.55;
  }
  return width;
}

/** 一棵树的树名 + 统计两行合起来的包围盒 */
function labelBox(tree: TreeLabelGeometry): Rect {
  const textW = Math.max(
    textWidth(tree.name, LABEL_NAME_SIZE),
    textWidth(tree.statText, LABEL_STAT_SIZE),
  );
  const top = tree.baseY + LABEL_NAME_DY - LABEL_NAME_SIZE - 2;
  const bottom = tree.baseY + LABEL_STAT_DY + 4;
  // 左右各留 2px：拉长腿的"业"、带描边的字形都不至于刚好蹭到
  return { x: tree.x - textW / 2 - 2, y: top, w: textW + 4, h: bottom - top };
}

function spriteRect(spot: CicadaSpot): Rect {
  return { x: spot.x - SPRITE_W / 2, y: spot.y + SPRITE_TOP, w: SPRITE_W, h: SPRITE_H };
}

/** 树冠椭圆的外接矩形 */
function canopyBox(tree: TreeLabelGeometry): Rect {
  return {
    x: tree.x - tree.canopyRx,
    y: tree.canopyY - tree.canopyRy,
    w: tree.canopyRx * 2,
    h: tree.canopyRy * 2,
  };
}

/** 椭圆占外接矩形的 π/4——按这个折算，免得把四个角也算成"有叶子" */
const ELLIPSE_FILL = Math.PI / 4;

function bubbleRect(spot: CicadaSpot, line: string): Rect {
  const w = bubbleWidth(line);
  const h = bubbleHeight(line);
  const cx = spot.x + bubbleOffset(spot.x, w);
  return { x: cx - w / 2, y: spot.y - BUBBLE_GAP - h, w, h };
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * 小于这个面积的"重叠"不算数。
 * 树名盒子的左右各留了 2px、上下各留了 1~4px 余量，几平方像素的交叠
 * 其实离字形还有一段距离——为这种亚像素级的蹭边把精灵赶到别处不值得。
 */
const OVERLAP_EPSILON = 12;

/** 一个落点的精灵 + 气泡，压到了这些盒子多少面积 */
function coveredArea(boxes: Rect[], spot: CicadaSpot, line: string): number {
  const sprite = spriteRect(spot);
  const bubble = bubbleRect(spot, line);
  let area = 0;
  for (const box of boxes) {
    area += overlapArea(sprite, box) + overlapArea(bubble, box);
  }
  return area < OVERLAP_EPSILON ? 0 : area;
}

/**
 * 这个落点会盖住多少树名面积（0 = 完全没压到）。
 *
 * `exceptTreeId` 用来排除**目标树自己**的树名——落点会刻意允许压住它，
 * 好让精灵贴着自己那棵树站（理由见 placeCicada）。
 * 落点算法按它挑位置；lib/__tests__ 也按它断言。
 */
export function labelOverlapArea(
  trees: TreeLabelGeometry[],
  spot: CicadaSpot,
  line: string,
  exceptTreeId?: string,
): number {
  return coveredArea(
    trees.filter((t) => t.treeId !== exceptTreeId).map(labelBox),
    spot,
    line,
  );
}

/** 这个落点会盖住多少树冠面积（叶子在里面，0 = 完全没压到） */
export function canopyOverlapArea(
  trees: TreeLabelGeometry[],
  spot: CicadaSpot,
  line: string,
): number {
  return coveredArea(trees.map(canopyBox), spot, line);
}

/**
 * 代价权重。**量级刻意拉开**是为了让"优先不压字"成为硬规则：
 * 树名是信息（压住就丢了），树冠里是可点的叶子（次之），
 * "离树多远、飘多高"只是观感（最后）。
 */
const COST_TEXT = 1e6;
const COST_CANOPY = 7e2;
const COST_BAND = 2e2;
const COST_DRIFT = 0.5;

/**
 * 某个落点的代价。重叠按面积计价，所以候选里只要有一个干净点，
 * 它就一定赢过任何有遮挡的点。
 */
function costOf(
  spot: CicadaSpot,
  otherTextBoxes: Rect[],
  canopyBoxes: Rect[],
  line: string,
  anchorX: number,
): number {
  let cost = coveredArea(otherTextBoxes, spot, line) * COST_TEXT;
  cost += coveredArea(canopyBoxes, spot, line) * ELLIPSE_FILL * COST_CANOPY;

  // 气泡顶不能钻进顶部木牌里（横带本身已经让开了树名，这里只兜底）
  const bubble = bubbleRect(spot, line);
  if (bubble.y < SIGN_BAND_BOTTOM) {
    cost += (SIGN_BAND_BOTTOM - bubble.y) * COST_BAND;
  }

  // 观感：离目标树别太远，也别飘太高
  cost += Math.abs(spot.x - anchorX) * COST_DRIFT;
  cost += Math.max(0, GROUND_LOOK_Y - spot.y) * COST_DRIFT;
  return cost;
}

/**
 * 算出精灵该站在哪。
 *
 * 候选高度分两组：**目标树脚下往下的几档**，加上**前景草地那一带**；
 * 另外还有一条兜底横带（所有树名之上，那里一定没有字，但会压树冠）。
 * 从低往高逐档、每档再按树宽的倍数左右试，取代价最小的那个。
 *
 * **目标树自己的树名不参与避让**：允许精灵压住它正在讲的那棵树的树名。
 * 这是刻意的取舍——气泡有一两百像素宽，几棵树挨在一起时，它身边往往
 * 只剩"压住自己的树名"这一条路；不放宽的话精灵会被挤到几百像素外，
 * 去讲另一棵树的事。别的树的树名仍然严格（压住别人的名字是真的丢信息）。
 *
 * 全程无随机：同一片森林每次算出同一个点（与布局算法拒绝力导向同一个理由）。
 */
export function placeCicada(
  trees: TreeLabelGeometry[],
  targetTreeId: string | null,
  line: string,
): CicadaSpot {
  const allTextBoxes = trees.map(labelBox);
  const otherTextBoxes = trees
    .filter((t) => t.treeId !== targetTreeId)
    .map(labelBox);
  const canopyBoxes = trees.map(canopyBox);
  // 兜底横带压在**所有**树名之上（包括目标树自己的）——它本来就是
  // "退到没人没字的最高处"，所以这里不排除任何一棵
  const clearY = Math.round(
    (allTextBoxes.length
      ? Math.min(...allTextBoxes.map((b) => b.y))
      : BAR_BAND_TOP) -
      SPRITE_BOTTOM -
      CLEAR_BAND_MARGIN,
  );

  // 没有目标树（待机 / 空森林）就守在画面下方的正中
  const anchor = trees.find((t) => t.treeId === targetTreeId) ?? {
    x: CANVAS_W / 2,
    baseY: 430,
    width: 0,
  };

  let best: CicadaSpot = { x: anchor.x, y: clearY };
  let bestCost = Infinity;

  const heights: number[] = [];
  for (let dy = GROUND_FROM; dy <= GROUND_TO; dy += GROUND_STEP) {
    heights.push(anchor.baseY + dy);
  }
  for (let y = MEADOW_FROM; y <= MEADOW_TO; y += GROUND_STEP) {
    heights.push(y);
  }
  heights.push(clearY);

  // 从低往高试：**优先落到草地上**——精灵站得越低，气泡越不可能压到树冠，
  // 也越贴合"站在树下的空地上"这个观感。同一个高度上再挑离目标树最近的。
  heights.sort((a, b) => b - a);

  for (const y of heights) {
    // 精灵的脚不许站到木条上（硬约束，见 MAX_SPOT_Y）
    const clampedY = Math.min(y, MAX_SPOT_Y);
    for (const spread of SPREADS) {
      const spot = {
        x: Math.min(
          CANVAS_W - SPOT_HALF,
          Math.max(SPOT_HALF, anchor.x + spread * anchor.width),
        ),
        y: clampedY,
      };
      const cost = costOf(spot, otherTextBoxes, canopyBoxes, line, anchor.x);
      if (cost < bestCost) {
        bestCost = cost;
        best = spot;
      }
    }
  }

  return best;
}
