export const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const pad = (n) => String(n).padStart(2, '0');

export const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export const todayKey = () => key(new Date());
export const hm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };

export const dayLabel = (dk) => {
  if (dk === todayKey()) return 'Hoje';
  if (dk === key(addDays(startOfToday(), 1))) return 'Amanhã';
  const d = fromKey(dk);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

// Segunda a sábado da semana que contém a data
export const weekDates = (dk) => {
  const d = fromKey(dk), wd = d.getDay(), m = wd === 0 ? -6 : 1 - wd;
  return Array.from({ length: 6 }, (_, i) => key(addDays(d, m + i)));
};

// Minutos que faltam até o início do horário (negativo se já passou)
export const minsUntil = (dk, start) => Math.round((fromKey(dk) - startOfToday()) / 60000) + start - nowMin();

export const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const brl0 = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export const whatsappUrl = (phone, text) => {
  let d = String(phone || '').replace(/\D/g, '');
  if (d && d.length <= 11) d = '55' + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
};
