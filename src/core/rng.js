/**
 * rng.js —— 确定性随机数（mulberry32）
 *
 * 为什么自己写：项目要求「无构建依赖、可无头模拟、存档可复现」。
 * 所有随机都必须来自这里的实例，禁止 Math.random()（scripts/check.mjs 会检查）。
 *
 * 可序列化：rng.snapshot() → { seed }，engine 把它存进 state.rng，
 * 因此「同一个存档 + 同一串操作」永远得到同一串结果。
 */

export const RNG_VERSION = 1;

/** 字符串 → 32 位种子（FNV-1a）。 */
export function hashString(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * @typedef {{seed:number}} RngSnapshot
 */

/**
 * 创建一个确定性随机源。
 * @param {number|string|RngSnapshot} seedOrSnapshot 种子或快照
 * @returns {{
 *   next():number, int(min:number,max:number):number, float(min:number,max:number):number,
 *   chance(p:number):boolean, pick<T>(arr:T[]):T,
 *   pickWeighted<T>(arr:T[], weightOf:(item:T)=>number):T|null,
 *   shuffle<T>(arr:T[]):T[], normal(mean:number,sd:number):number,
 *   fork(label:string):any, clone():any, snapshot():RngSnapshot
 * }}
 */
export function createRng(seedOrSnapshot) {
  let s = normalizeSeed(seedOrSnapshot);

  function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const api = {
    next,
    /** 闭区间整数 [min, max]。 */
    int(min, max) {
      const lo = Math.ceil(Math.min(min, max));
      const hi = Math.floor(Math.max(min, max));
      if (hi <= lo) return lo;
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    float(min, max) {
      return min + next() * (max - min);
    },
    chance(p) {
      return next() < p;
    },
    pick(arr) {
      if (!Array.isArray(arr) || arr.length === 0) return null;
      return arr[Math.floor(next() * arr.length)];
    },
    pickWeighted(arr, weightOf) {
      if (!Array.isArray(arr) || arr.length === 0) return null;
      let total = 0;
      for (const item of arr) total += Math.max(0, Number(weightOf(item)) || 0);
      if (total <= 0) return arr[0];
      let r = next() * total;
      for (const item of arr) {
        r -= Math.max(0, Number(weightOf(item)) || 0);
        if (r <= 0) return item;
      }
      return arr[arr.length - 1];
    },
    /** Fisher–Yates，返回新数组。 */
    shuffle(arr) {
      const copy = Array.isArray(arr) ? arr.slice() : [];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
      }
      return copy;
    },
    /** Box–Muller 正态分布。 */
    normal(mean, sd) {
      let u = 0;
      let v = 0;
      while (u === 0) u = next();
      while (v === 0) v = next();
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      return mean + z * sd;
    },
    /** 派生一个独立的子随机源（用于命名、事件等互不干扰的用途）。 */
    fork(label) {
      return createRng((s ^ hashString(String(label))) >>> 0);
    },
    clone() {
      const c = createRng(s);
      return c;
    },
    snapshot() {
      return { seed: s >>> 0 };
    },
  };

  return api;
}

/** 从存档里的 state.rng 恢复随机源。 */
export function rngFromSnapshot(snapshot) {
  return createRng(snapshot);
}

function normalizeSeed(input) {
  if (input && typeof input === 'object' && Number.isFinite(input.seed)) return input.seed >>> 0;
  if (typeof input === 'number' && Number.isFinite(input)) return input >>> 0;
  const h = hashString(input === undefined || input === null ? 'mxc' : input);
  return (h || 0x9e3779b9) >>> 0;
}

/** 兜底：把任意值夹到 [lo, hi]。 */
export function clamp(value, lo, hi) {
  const v = Number.isFinite(value) ? value : lo;
  return Math.max(lo, Math.min(hi, v));
}

/** 保留 n 位小数（避免浮点脏值写进存档）。 */
export function round(value, digits = 2) {
  const f = Math.pow(10, digits);
  return Math.round((Number(value) || 0) * f) / f;
}
