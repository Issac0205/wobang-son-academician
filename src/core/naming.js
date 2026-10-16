/**
 * naming.js —— 学生随机命名（数据来自 src/data/names.js）
 *
 * SPEC 硬性：名字必须自然、不能千篇一律；不得出现谐音/不雅名。
 * 策略：70% 双字名 + 30% 单字名；3% 复姓；性别 是 男/女 但名字用中性库混搭；
 *      生成后查黑名单与同音黑名单，最多重试 NAME_RETRY_MAX 次。
 */

import {
  SURNAMES_SINGLE, SURNAMES_COMPOUND, GIVEN_FIRST, GIVEN_LAST, GIVEN_SINGLE,
  NAME_BLOCKLIST, HOMOPHONE_BLOCK, NAME_DOUBLE_RATE, COMPOUND_SURNAME_RATE,
  GENDER_NEUTRAL_RATE, GENDER_MALE_RATE, NAME_RETRY_MAX, NAME_CHAR_DECAY,
} from '../data/names.js';

const BLOCK_SET = new Set(NAME_BLOCKLIST);
const HOMOPHONE_SET = new Set(HOMOPHONE_BLOCK);

/**
 * 生成一个学生名字。
 * @param {any} rng createRng 实例
 * @param {{used?:Set<string>|string[], gender?:'male'|'female'|'any'}} [opts]
 * @returns {{name:string, gender:'male'|'female'}}
 */
export function generateName(rng, opts = {}) {
  const used = opts.used instanceof Set ? opts.used : new Set(opts.used || []);
  const forcedGender = opts.gender && opts.gender !== 'any' ? opts.gender : null;

  for (let attempt = 0; attempt < NAME_RETRY_MAX; attempt += 1) {
    const gender = forcedGender || (rng.chance(GENDER_MALE_RATE) ? 'male' : 'female');
    const surname = pickSurname(rng);
    const isDouble = rng.chance(NAME_DOUBLE_RATE);
    let given;
    if (isDouble) {
      const first = pickGiven(rng, GIVEN_FIRST, gender);
      const last = pickGiven(rng, GIVEN_LAST, gender);
      given = (first === last ? first : first + last);
    } else {
      given = pickGiven(rng, GIVEN_SINGLE, gender);
    }
    const name = surname + given;
    if (isClean(name) && !used.has(name)) {
      return { name, gender };
    }
  }
  // 兜底：字库太小/黑名单太密时的保底路径（仍然是自然名，只是不保证唯一）
  // v1.4.0：兜底也必须过黑名单/同音表——否则稀有人才（已进 NAME_BLOCKLIST）可能在极端路径下
  // 被随机拼出来，「防同名」的口径就漏了一个口子。
  let fallback = pickSurname(rng) + pickGiven(rng, GIVEN_SINGLE, forcedGender || 'any');
  for (let attempt = 0; attempt < NAME_RETRY_MAX && !isClean(fallback); attempt += 1) {
    fallback = pickSurname(rng) + pickGiven(rng, GIVEN_SINGLE, forcedGender || 'any');
  }
  return { name: fallback, gender: forcedGender || 'male' };
}

/** 黑名单 + 同音黑名单检查。 */
export function isClean(name) {
  if (BLOCK_SET.has(name)) return false;
  if (name.length === 2 && HOMOPHONE_SET.has(name)) return false;
  return true;
}

/** 删除同名单字，避免「王博博」这类重复名字。 */
function pickSurname(rng) {
  if (rng.chance(COMPOUND_SURNAME_RATE)) {
    return rng.pick(SURNAMES_COMPOUND) || '欧阳';
  }
  const entry = rng.pickWeighted(SURNAMES_SINGLE, (s) => s.w);
  return entry ? entry.name : '王';
}

function pickGiven(rng, pool, gender) {
  const wantNeutral = rng.chance(GENDER_NEUTRAL_RATE);
  const filtered = pool.filter((c) => {
    if (c.g === 'n') return true;
    if (gender === 'any' || wantNeutral) return false;
    return gender === 'male' ? c.g === 'm' : c.g === 'f';
  });
  const candidates = filtered.length > 0 ? filtered : pool;
  // 字频衰减：常见字出现概率更高，长尾字偶尔出现
  const entry = rng.pickWeighted(candidates, (c) => (c.g === 'n' ? 1 : 1 - NAME_CHAR_DECAY / 2));
  return entry ? entry.name : '宁';
}

/** 给「马小程」的儿子/学生等固定角色预留的工具（避免散落硬编码）。 */
export const PROTAGONIST = { player: '马老板', son: '马小程' };
