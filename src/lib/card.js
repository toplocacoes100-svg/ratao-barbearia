import QRCode from 'qrcode';
import { CARD_H, CARD_W, drawCard } from './cardDraw.js';
import emblema from './brandEmblema.js';

const loadImg = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

// Garante que as fontes da marca já carregaram antes de desenhar no canvas
async function loadFonts() {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load('900 100px "Big Shoulders Display"'),
      document.fonts.load('500 40px "Bricolage Grotesque Variable"'),
      document.fonts.load('600 40px "Bricolage Grotesque Variable"'),
      document.fonts.load('700 40px "Bricolage Grotesque Variable"'),
    ]);
  } catch { /* se falhar, o banner usa uma fonte parecida */ }
}

async function makeQr(url) {
  const c = document.createElement('canvas');
  await QRCode.toCanvas(c, url, { margin: 1, width: 300, errorCorrectionLevel: 'M', color: { dark: '#151417', light: '#FFFFFF' } });
  return c;
}

/**
 * Cria o banner do agendamento (1080 x 1520) e devolve { blob, dataUrl }.
 * data: { kind, shop:{name,address,phone,instagram,site}, client, services, dur, total, plan, date, start, end, barber:{name,photo}, footnote }
 */
export async function makeAppointmentCard(data) {
  await loadFonts();
  const c = document.createElement('canvas');
  c.width = CARD_W; c.height = CARD_H;
  const ctx = c.getContext('2d');
  const [logo, photo, qr] = await Promise.all([
    loadImg(emblema),
    data.barber.photo ? loadImg(data.barber.photo).catch(() => null) : Promise.resolve(null),
    data.shop.site ? makeQr(data.shop.site).catch(() => null) : Promise.resolve(null),
  ]);
  drawCard(ctx, CARD_W, CARD_H, { ...data, images: { logo, photo, qr } });
  const blob = await new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('CARD_FAIL'))), 'image/png'));
  return { blob, dataUrl: c.toDataURL('image/png') };
}
