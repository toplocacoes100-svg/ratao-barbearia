import { addDays, fromKey, key, startOfToday } from './time.js';

export const PAY_METHODS = ['Dinheiro', 'Pix', 'Débito', 'Crédito', 'Misto'];
export const EXPENSE_CATS = ['Aluguel', 'Energia', 'Água', 'Internet', 'Produtos', 'Salários', 'Outros'];

export function periodRange(p) {
  const t = startOfToday();
  if (p === 'hoje') return [key(t), key(t)];
  if (p === 'semana') { const wd = t.getDay(), m = wd === 0 ? -6 : 1 - wd; return [key(addDays(t, m)), key(addDays(t, m + 6))]; }
  return [key(new Date(t.getFullYear(), t.getMonth(), 1)), key(new Date(t.getFullYear(), t.getMonth() + 1, 0))];
}

/**
 * Consolida o financeiro do período.
 * Regras:
 *  - só conta atendimento "concluído";
 *  - atendimento de mensalista coberto pelo plano NÃO é receita (a receita é a mensalidade paga);
 *  - comissão = valor de tabela x % do barbeiro, inclusive nos atendimentos cobertos pelo plano;
 *  - o que já foi fechado (commissionClosureId) sai do "a pagar".
 * subPayments: pagamentos de mensalidade do período [{amount, method, date}].
 */
export function summarize({ appts, expenses, barbers, from, to, subPayments = [] }) {
  const done = appts.filter((a) => a.status === 'concluido');
  const avulso = done.filter((a) => !a.coveredByPlan);
  const covered = done.filter((a) => a.coveredByPlan);
  const avulsoRevenue = avulso.reduce((s, a) => s + Number(a.total || 0), 0);
  const subRevenue = subPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const revenue = avulsoRevenue + subRevenue;
  const count = done.length;

  const byMethod = {};
  avulso.forEach((a) => { const m = a.payMethod || 'Não informado'; byMethod[m] = (byMethod[m] || 0) + Number(a.total || 0); });
  subPayments.forEach((p) => { const m = `${p.method || 'Não informado'} (mensalidade)`; byMethod[m] = (byMethod[m] || 0) + Number(p.amount || 0); });

  const byDay = {};
  for (let d = fromKey(from), n = 0; key(d) <= to && n < 62; d = addDays(d, 1), n++) byDay[key(d)] = 0;
  avulso.forEach((a) => { if (byDay[a.date] !== undefined) byDay[a.date] += Number(a.total || 0); });
  subPayments.forEach((p) => { if (byDay[p.date] !== undefined) byDay[p.date] += Number(p.amount || 0); });

  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const ids = [...new Set(done.map((a) => a.barberId))];
  const commissions = ids.map((bid) => {
    const b = barbers.find((x) => x.id === bid);
    const list = done.filter((a) => a.barberId === bid);
    const percent = Number(b?.commissionService ?? 0);
    const base = list.reduce((s, a) => s + Number(a.total || 0), 0);
    const open = list.filter((a) => !a.commissionClosureId);
    const dueBase = open.reduce((s, a) => s + Number(a.total || 0), 0);
    return {
      barberId: bid, name: b?.name || list[0]?.barberName || bid, count: list.length, percent, base, dueBase,
      commission: base * percent / 100, due: dueBase * percent / 100, dueIds: open.map((a) => a.id), paid: (base - dueBase) * percent / 100,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const commissionTotal = commissions.reduce((s, c) => s + c.commission, 0);

  return {
    revenue, avulsoRevenue, subRevenue, count, avulsoCount: avulso.length, coveredCount: covered.length,
    avgTicket: avulso.length ? avulsoRevenue / avulso.length : 0, byMethod, byDay,
    expenseTotal, commissions, commissionTotal,
    result: revenue - expenseTotal - commissionTotal,
  };
}
