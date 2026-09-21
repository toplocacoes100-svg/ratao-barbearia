import { fromKey, nowMin, todayKey } from './time.js';

export const dayDocId = (barberId, dk) => `${barberId}_${dk}`;
export const isBlockItem = (it) => String(it.id).startsWith('blk_');

// Existe conflito com algum horário já ocupado (considerando o intervalo entre atendimentos)?
export function overlaps(items, start, end, buffer) {
  return items.some((it) => {
    const b = isBlockItem(it) ? 0 : buffer;
    return start < it.end + b && it.start < end + b;
  });
}

// O barbeiro está livre para começar em `s` e atender por `dur` minutos?
export function isFree({ barber, dk, s, dur, items, settings, admin = false }) {
  const wd = fromKey(dk).getDay();
  const h = settings.hours?.[wd];
  if (!h || (barber.off || []).includes(wd)) return false;
  if (dk < todayKey()) return false;
  if (s < h.open || s + dur > h.close) return false;
  const l = barber.lunch;
  if (l && s < l.end && l.start < s + dur) return false;
  if (dk === todayKey() && s < nowMin() + (admin ? 0 : settings.minAdvance)) return false;
  return !overlaps(items, s, s + dur, settings.buffer);
}

// daysMap: Map(docId -> {items:[{id,start,end}]})
export function slotsFor({ barbers, dk, dur, daysMap, settings, admin = false }) {
  const h = settings.hours?.[fromKey(dk).getDay()];
  if (!h) return [];
  const out = [];
  for (let s = h.open; s + dur <= h.close; s += settings.step) {
    const free = barbers.filter((b) => {
      const items = daysMap.get(dayDocId(b.id, dk))?.items || [];
      return isFree({ barber: b, dk, s, dur, items, settings, admin });
    });
    if (!free.length) continue;
    // "qualquer disponível": escolhe quem tem menos gente no dia
    free.sort((x, y) => (daysMap.get(dayDocId(x.id, dk))?.items.length || 0) - (daysMap.get(dayDocId(y.id, dk))?.items.length || 0));
    out.push({ start: s, barberId: free[0].id });
  }
  return out;
}

export function nextFree({ barbers, dur, daysMap, settings, dates }) {
  for (const dk of dates) {
    const s = slotsFor({ barbers, dk, dur, daysMap, settings });
    if (s.length) return { dk, ...s[0] };
  }
  return null;
}

const OCCUPYING = ['agendado', 'confirmado', 'atendimento', 'concluido'];

/**
 * Trechos livres do dia de um barbeiro, para oferecer encaixes.
 * Desconta almoço, bloqueios e atendimentos (com o intervalo entre eles, igual à regra de agendamento).
 * Se for hoje, só considera de agora em diante.
 */
export function freeGaps({ barber, dk, appts = [], blocks = [], settings, nowMinutes = 0, minLen = 15 }) {
  const wd = fromKey(dk).getDay();
  const h = settings.hours?.[wd];
  if (!h || (barber.off || []).includes(wd) || dk < todayKey()) return [];
  let from = h.open;
  if (dk === todayKey()) from = Math.max(from, Math.ceil(nowMinutes / 5) * 5);

  const busy = [];
  if (barber.lunch) busy.push([barber.lunch.start, barber.lunch.end]);
  blocks.forEach((b) => busy.push([b.start, b.end]));
  appts.filter((a) => OCCUPYING.includes(a.status)).forEach((a) => busy.push([a.start - settings.buffer, a.end + settings.buffer]));
  busy.sort((x, y) => x[0] - y[0]);

  const gaps = [];
  let cur = from;
  for (const [s, e] of busy) {
    if (s > cur) gaps.push({ start: cur, end: Math.min(s, h.close) });
    cur = Math.max(cur, e);
  }
  if (h.close > cur) gaps.push({ start: cur, end: h.close });
  return gaps.filter((g) => g.end - g.start >= minLen);
}
