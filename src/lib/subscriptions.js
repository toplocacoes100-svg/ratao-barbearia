import { fromKey } from './time.js';

// Chave do mês usada nos mapas "usage" e "paid" do mensalista (ex.: 2026-09-21 vira m202609)
export const mKey = (dk) => `m${dk.slice(0, 4)}${dk.slice(5, 7)}`;
export const monthName = (dk) => fromKey(dk).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
export const digits = (p) => String(p || '').replace(/\D/g, '').slice(-11);

// Regras puras dos mensalistas (sem Firebase). A gravação da baixa pelo plano fica em bookings.js.

/** Acha o mensalista ativo de um agendamento: pela conta do app ou pelo telefone. */
export function findSubscription(subs, ap) {
  const ph = digits(ap.clientPhone);
  return subs.find((s) => s.active !== false
    && ((ap.clientId && s.clientId === ap.clientId) || (ph.length >= 10 && digits(s.phone) === ph))) || null;
}

/**
 * Esse atendimento pode ser coberto pelo plano?
 * Regras: todos os serviços precisam estar no plano e o limite de atendimentos do mês não pode ter acabado.
 * A mensalidade pendente NÃO bloqueia, só avisa (quem decide é o dono).
 */
export function coverInfo(sub, ap) {
  const k = mKey(ap.date);
  const used = Number(sub.usage?.[k] || 0);
  const limit = Number(sub.visits || 0); // 0 = ilimitado
  const included = sub.serviceIds || [];
  const outside = included.length ? (ap.serviceIds || []).filter((id) => !included.includes(id)) : [];
  let reason = '';
  if (outside.length) reason = 'Tem serviço que não está incluído no plano.';
  else if (limit > 0 && used >= limit) reason = `O limite de ${limit} atendimento${limit > 1 ? 's' : ''} deste mês já foi usado.`;
  return { ok: !reason, reason, used, limit, paid: Boolean(sub.paid?.[k]), key: k };
}
