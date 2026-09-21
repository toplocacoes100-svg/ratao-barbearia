import { fromKey, hm } from './time.js';

// Desenho do banner de agendamento (1080 x 1520). Só desenha: as imagens já chegam carregadas.
// Fica separado do navegador para poder ser testado.
export const CARD_W = 1080;
export const CARD_H = 1520;

const DISPLAY = '"Big Shoulders Display", "Arial Narrow", Impact, sans-serif';
const BODY = '"Bricolage Grotesque Variable", "Bricolage Grotesque", system-ui, "Segoe UI", Arial, sans-serif';
const C = { bg: '#151417', card: '#1F1E22', line: '#3A383F', gold: '#D4A94F', cream: '#F1EBDD', muted: '#A09B8F', ink: '#1A1408', red: '#D6402E', blue: '#2F6BD1' };
const M = 72; // margem

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Faixa de poste de barbeiro (vermelho, branco, azul, branco) em diagonal
function pole(ctx, x, y, w, h) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const seg = h * 0.5, cols = [C.red, C.cream, C.blue, C.cream];
  for (let i = -h; i < w + h; i += seg * 4) {
    cols.forEach((col, k) => {
      const x0 = x + i + k * seg;
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(x0, y + h); ctx.lineTo(x0 + seg, y + h); ctx.lineTo(x0 + seg + h, y); ctx.lineTo(x0 + h, y);
      ctx.closePath(); ctx.fill();
    });
  }
  ctx.restore();
}

function fit(ctx, text, tpl, maxW, start, min = 22) {
  let s = start;
  for (; s > min; s -= 2) { ctx.font = tpl.replace('{s}', s); if (ctx.measureText(text).width <= maxW) break; }
  ctx.font = tpl.replace('{s}', s);
  return s;
}

function wrap(ctx, text, maxW, maxLines) {
  const words = String(text).split(/\s+/); const lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const keep = lines.slice(0, maxLines); keep[maxLines - 1] = `${keep[maxLines - 1].replace(/[\s,;+]+$/, '')}…`; return keep; }
  return lines;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const money = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * d: { kind: 'confirmacao'|'lembrete', shop:{name,address,phone,instagram}, client, services:[], dur, total,
 *      date:'AAAA-MM-DD', start, end, barber:{name}, images:{logo, photo, qr} }
 */
export function drawCard(ctx, W, H, d) {
  const dt = fromKey(d.date);
  const weekday = cap(dt.toLocaleDateString('pt-BR', { weekday: 'long' }));
  const month = dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // fundo
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, 120, 40, W * 0.85, 120, 700);
  glow.addColorStop(0, 'rgba(212,169,79,0.16)'); glow.addColorStop(1, 'rgba(212,169,79,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  pole(ctx, 0, 0, W, 28);
  pole(ctx, 0, H - 28, W, 28);

  // cabeçalho: logo + nome
  const LOGO = 112;
  if (d.images.logo) ctx.drawImage(d.images.logo, M, 78, LOGO, LOGO);
  ctx.textBaseline = 'alphabetic'; ctx.fillStyle = C.cream;
  fit(ctx, d.shop.name.toUpperCase(), `900 {s}px ${DISPLAY}`, W - M * 2 - LOGO - 28, 92, 40);
  ctx.fillText(d.shop.name.toUpperCase(), M + LOGO + 28, 158);
  ctx.font = `500 30px ${BODY}`; ctx.fillStyle = C.muted;
  ctx.fillText('Comprovante de agendamento', M + LOGO + 28, 196);

  // selo de situação
  const label = d.kind === 'lembrete' ? 'Lembrete do seu horário' : 'Horário confirmado';
  ctx.font = `700 34px ${BODY}`;
  const pw = ctx.measureText(label).width + 72;
  ctx.fillStyle = C.gold; rr(ctx, M, 244, pw, 68, 34); ctx.fill();
  ctx.fillStyle = C.ink; ctx.fillText(label, M + 36, 289);

  // cartão de data e hora
  const cy = 344, ch = 380, mid = W / 2 - 40, right = W - M - 44;
  ctx.fillStyle = C.card; rr(ctx, M, cy, W - M * 2, ch, 36); ctx.fill();
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; rr(ctx, M, cy, W - M * 2, ch, 36); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mid, cy + 56); ctx.lineTo(mid, cy + ch - 56); ctx.stroke();
  // esquerda: dia
  ctx.fillStyle = C.muted; ctx.font = `600 34px ${BODY}`; ctx.fillText(weekday, M + 48, cy + 84);
  ctx.fillStyle = C.cream; fit(ctx, String(dt.getDate()), `900 {s}px ${DISPLAY}`, mid - M - 90, 230, 120); ctx.fillText(String(dt.getDate()), M + 44, cy + 286);
  ctx.fillStyle = C.muted; fit(ctx, month, `500 {s}px ${BODY}`, mid - M - 80, 40, 24); ctx.fillText(month, M + 48, cy + 338);
  // direita: hora (encolhe se precisar para nunca passar da borda)
  const rx = mid + 48;
  ctx.fillStyle = C.muted; ctx.font = `600 34px ${BODY}`; ctx.fillText('Horário', rx, cy + 84);
  ctx.fillStyle = C.gold; fit(ctx, hm(d.start), `900 {s}px ${DISPLAY}`, right - rx, 230, 100); ctx.fillText(hm(d.start), rx - 4, cy + 286);
  ctx.fillStyle = C.muted; ctx.font = `500 34px ${BODY}`; ctx.fillText(`até ${hm(d.end)}`, rx, cy + 338);

  // detalhes (a posição de cada bloco depende do anterior)
  let y = cy + ch + 62;
  ctx.fillStyle = C.muted; ctx.font = `500 28px ${BODY}`; ctx.fillText('Cliente', M, y);
  y += 58; ctx.fillStyle = C.cream; fit(ctx, d.client, `700 {s}px ${BODY}`, W - M * 2, 56, 30); ctx.fillText(d.client, M, y);
  y += 62; ctx.fillStyle = C.muted; ctx.font = `500 28px ${BODY}`; ctx.fillText('Serviço', M, y);
  y += 54; ctx.fillStyle = C.cream; ctx.font = `600 42px ${BODY}`;
  wrap(ctx, d.services.join(' + '), W - M * 2, 2).forEach((ln, k, all) => { ctx.fillText(ln, M, y); if (k < all.length - 1) y += 54; });
  y += 34;
  const chip = (text, x, gold) => {
    ctx.font = `700 34px ${BODY}`; const w = ctx.measureText(text).width + 56;
    ctx.fillStyle = gold ? C.gold : C.card; rr(ctx, x, y, w, 64, 32); ctx.fill();
    if (!gold) { ctx.strokeStyle = C.line; ctx.lineWidth = 2; rr(ctx, x, y, w, 64, 32); ctx.stroke(); }
    ctx.fillStyle = gold ? C.ink : C.cream; ctx.fillText(text, x + 28, y + 43); return x + w + 18;
  };
  const next = chip(`${d.dur} min`, M, false);
  if (d.total > 0) chip(money(d.total), next, true);
  else if (d.plan) chip(`Plano: ${d.plan}`, next, true);

  // barbeiro
  const by = y + 64 + 94;
  ctx.save(); ctx.beginPath(); ctx.arc(M + 56, by, 56, 0, Math.PI * 2); ctx.closePath();
  if (d.images.photo) { ctx.clip(); ctx.drawImage(d.images.photo, M, by - 56, 112, 112); }
  else { ctx.fillStyle = C.gold; ctx.fill(); ctx.fillStyle = C.ink; ctx.font = `900 64px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillText((d.barber.name || '?')[0].toUpperCase(), M + 56, by + 22); ctx.textAlign = 'left'; }
  ctx.restore();
  ctx.beginPath(); ctx.arc(M + 56, by, 58, 0, Math.PI * 2); ctx.strokeStyle = C.gold; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = C.muted; ctx.font = `500 28px ${BODY}`; ctx.fillText('Seu barbeiro', M + 140, by - 10);
  ctx.fillStyle = C.cream; fit(ctx, d.barber.name, `700 {s}px ${BODY}`, 520, 48, 28); ctx.fillText(d.barber.name, M + 140, by + 40);

  // QR ao lado do barbeiro (para reagendar pelo app)
  const qrSize = 140; let qrBottom = 0;
  if (d.images.qr) {
    const qx = W - M - qrSize, qy = by - 56;
    ctx.fillStyle = C.muted; ctx.font = `500 22px ${BODY}`; ctx.textAlign = 'center'; ctx.fillText('Reagende pelo app', qx + qrSize / 2, qy - 22); ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF'; rr(ctx, qx - 10, qy - 10, qrSize + 20, qrSize + 20, 16); ctx.fill();
    ctx.drawImage(d.images.qr, qx, qy, qrSize, qrSize);
    qrBottom = qy + qrSize + 10;
  }

  // rodapé: endereço, contato e observação
  const fy = Math.max(by + 60, qrBottom) + 56;
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(M, fy - 30); ctx.lineTo(W - M, fy - 30); ctx.stroke();
  let ty = fy + 14;
  ctx.fillStyle = C.cream; ctx.font = `600 30px ${BODY}`;
  const info = [d.shop.address, [d.shop.phone, d.shop.instagram && `@${String(d.shop.instagram).replace(/^@/, '')}`].filter(Boolean).join('   ')].filter(Boolean);
  info.forEach((t) => wrap(ctx, t, W - M * 2, 2).forEach((ln) => { ctx.fillText(ln, M, ty); ty += 40; }));
  ctx.fillStyle = C.muted; ctx.font = `500 26px ${BODY}`;
  if (d.footnote) wrap(ctx, d.footnote, W - M * 2, 2).forEach((ln) => { ctx.fillText(ln, M, ty + 6); ty += 34; });
}
