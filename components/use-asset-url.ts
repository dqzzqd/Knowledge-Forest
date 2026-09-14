"use client";

import { useEffect, useState } from "react";

/**
 * 素材加载器 —— 带校验、去重、限流退避。
 *
 * 为什么不直接在 `<image href="/tree-a.webp">` 里写死路径：
 *
 * 知乎 AiWorks 的 HTTP 网关按套餐有 **QPS 配额**，超出时返回的是
 * **HTTP 200 + `{"code":"EXCEED_RATELIMIT"}`**（实测 231 字节的 JSON），
 * 而不是 4xx。状态码是 200，所以浏览器当作"成功"；SVG 的 `<image>`
 * 解不出这段 JSON，于是画出断图图标，**并且永远不会重试**——
 * 首屏就成了满屏断图，刷新（请求数变少）之后才恢复。
 *
 * 这里改成先用 fetch 取回、确认拿到的确实是图片，再交给 `<image>`：
 * 被限流就退避重试，没拿到之前 `href` 是空的。最坏情况是"晚一点出现"，
 * 而不是"永远是个断图"。
 *
 * 返回 blob URL 而不是原路径，是因为这些响应带 `cache-control: max-age=0`，
 * 用原路径会触发条件请求重新走一次网络——那又可能被限流。blob 不发起请求。
 */

/**
 * 同时在飞的请求数。
 *
 * 调高到 4 而不是压到 1：网关卡的是「每秒请求数」，超了的那几个重试很快
 * （见下面的退避表），所以并发高一点总耗时更短——低并发只是把同样的失败
 * 摊成好几轮，反而更慢。
 */
const CONCURRENCY = 4;

/**
 * 退避表（毫秒）。
 *
 * 前几次故意压得很密（120 / 250 / 450）：网关的配额窗口很短，实测被限流后
 * 一两百毫秒就恢复了，早期那次「等 300ms / 700ms / 1.5s」的设计让素材要
 * 好几秒才补上——用户看到的就是「美化在慢慢往外长」。
 * 后段拉开是防服务真挂了时的空转。全程约 22 秒、11 次机会。
 */
const RETRY_DELAYS = [0, 120, 250, 450, 750, 1150, 1700, 2400, 3400, 4800, 6800];

const ready = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
const queue: Array<() => void> = [];
let running = 0;

function pump() {
  while (running < CONCURRENCY && queue.length > 0) {
    running += 1;
    queue.shift()!();
  }
}

function schedule<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(() => {
      task()
        .then(resolve, reject)
        .finally(() => {
          running -= 1;
          pump();
        });
    });
    pump();
  });
}

async function fetchOnce(src: string): Promise<string> {
  const res = await fetch(src);
  const type = res.headers.get("content-type") ?? "";

  // 关键一步：限流响应也是 200，只能靠 content-type 和体积识破
  if (!res.ok || !type.startsWith("image/")) {
    throw new Error(`${src} 不是图片（${res.status} ${type || "无 content-type"}）`);
  }

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength < 1024) {
    throw new Error(`${src} 体积异常（${buffer.byteLength} 字节），疑似被网关截断`);
  }

  return URL.createObjectURL(new Blob([buffer], { type }));
}

/** 取素材，失败按退避表重试。同一个 src 全页只发一次请求。 */
export function loadAsset(src: string): Promise<string> {
  const cached = ready.get(src);
  if (cached) return Promise.resolve(cached);

  const pending = inflight.get(src);
  if (pending) return pending;

  const task = schedule(async () => {
    let lastError: unknown;
    for (const delay of RETRY_DELAYS) {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      try {
        const url = await fetchOnce(src);
        ready.set(src, url);
        return url;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }).finally(() => {
    inflight.delete(src);
  });

  inflight.set(src, task);
  return task;
}

/**
 * 素材 URL。拿到之前返回 `undefined`——调用方据此**不渲染** `<image>`，
 * 这样用户在等待期间看到的是空场景，而不是断图。
 */
export function useAssetUrl(src: string): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() => ready.get(src));

  useEffect(() => {
    let alive = true;
    loadAsset(src).then(
      (value) => {
        if (alive) setUrl(value);
      },
      (error) => {
        // 退避用尽仍拿不到：保持 undefined，宁可不画也不画断图
        console.error("[asset] 素材加载失败", error);
      },
    );

    return () => {
      alive = false;
    };
  }, [src]);

  return url;
}

/** `/plank.webp` → `--tex-plank` */
export function cssVarFor(src: string): string {
  const name = src
    .replace(/^\//, "")
    .replace(/\.(webp|png|jpe?g)$/i, "")
    .replace(/[^a-z0-9-]/gi, "-");
  return `--tex-${name}`;
}

/**
 * 把 **CSS 背景图**也接进重试器。
 *
 * CSS 自己不会重试：网关限流时它同样只拿到一段 JSON，于是那块木牌、那张纸
 * 就永久性地没有底纹（`.plankbtn`、`.board-card`、`.wood-pill` 全是这么碎的）。
 * 这里把素材取到之后，把 blob URL 写进 `:root` 的自定义属性；样式表里写的是
 * `var(--tex-x, url("/x.webp"))`——没取到就回退到原路径，取到了就换成 blob。
 *
 * 用法：`<TextureVars srcs={PAGE_TEXTURES} />`。`srcs` 要是模块级常量，
 * 每次渲染新建数组会让 effect 反复重跑。
 */
export function TextureVars({ srcs }: { srcs: readonly string[] }) {
  const key = srcs.join(",");

  useEffect(() => {
    const list = key.split(",").filter(Boolean);
    let alive = true;

    for (const src of list) {
      loadAsset(src).then(
        (url) => {
          if (alive) {
            document.documentElement.style.setProperty(cssVarFor(src), `url("${url}")`);
          }
        },
        (error) => console.error("[asset] 背景素材加载失败", error),
      );
    }

    return () => {
      alive = false;
    };
  }, [key]);

  return null;
}
