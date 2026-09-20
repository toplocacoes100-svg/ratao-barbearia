// Reduz a foto no próprio navegador antes de gravar (o Firestore aceita até ~1 MB por documento).
async function load(file) {
  try { return await createImageBitmap(file); }
  catch {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
}

export async function fileToDataUrl(file, { maxSide = 1000, maxChars = 480000, square = false } = {}) {
  const img = await load(file);
  const w0 = img.width, h0 = img.height;
  let side = maxSide, q = 0.78, out = '';
  for (let i = 0; i < 8; i++) {
    const c = document.createElement('canvas');
    if (square) {
      c.width = c.height = side;
      const m = Math.min(w0, h0);
      c.getContext('2d').drawImage(img, (w0 - m) / 2, (h0 - m) / 2, m, m, 0, 0, side, side);
    } else {
      const k = Math.min(1, side / Math.max(w0, h0));
      c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    }
    out = c.toDataURL('image/jpeg', q);
    if (out.length <= maxChars) return out;
    q = Math.max(0.5, q - 0.08); side = Math.round(side * 0.85);
  }
  if (out.length > maxChars) throw new Error('IMAGE_TOO_BIG');
  return out;
}
