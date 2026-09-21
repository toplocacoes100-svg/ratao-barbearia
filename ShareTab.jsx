import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { useToast } from '../../context/ToastContext.jsx';

// Logo do rato com cores fixas (imagens soltas não enxergam as cores do tema do app)
const logoSvg = (accent, hole) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="11" cy="12" r="9" fill="${accent}"/><circle cx="37" cy="12" r="9" fill="${accent}"/><circle cx="11" cy="12" r="4.5" fill="${hole}"/><circle cx="37" cy="12" r="4.5" fill="${hole}"/><path d="M6 30c0-9.5 8-16 18-16s18 6.5 18 16c0 8.5-8 14-18 14S6 38.5 6 30z" fill="${accent}"/><circle cx="17.5" cy="27" r="2.3" fill="${hole}"/><circle cx="30.5" cy="27" r="2.3" fill="${hole}"/><circle cx="24" cy="34" r="2.6" fill="${hole}"/><path d="M21.5 38c-3 2.5-7 2.5-9.5-.5M26.5 38c3 2.5 7 2.5 9.5-.5" fill="none" stroke="${hole}" stroke-width="2.2" stroke-linecap="round"/></svg>`;
const logoSrc = (accent, hole) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvg(accent, hole))}`;

const loadImg = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });

// Gera o QR (correção de erro alta) e coloca o logo num selo no centro
async function makeQr(url) {
  const c = document.createElement('canvas');
  await QRCode.toCanvas(c, url, { errorCorrectionLevel: 'H', margin: 2, width: 900, color: { dark: '#151417', light: '#FFFFFF' } });
  const ctx = c.getContext('2d');
  if (ctx) {
    const w = c.width, r = w * 0.115;
    ctx.beginPath(); ctx.arc(w / 2, w / 2, r, 0, Math.PI * 2); ctx.fillStyle = '#151417'; ctx.fill();
    try {
      const img = await loadImg(logoSrc('#D4A94F', '#151417'));
      const s = r * 1.55;
      ctx.drawImage(img, w / 2 - s / 2, w / 2 - s / 2, s, s);
    } catch { /* sem o logo o QR continua funcionando */ }
  }
  return c.toDataURL('image/png');
}

function Poster({ png, url }) {
  return (
    <div className="qrposter">
      <div className="qrbar stripes" />
      <div className="qrbody">
        <img className="qrlogo" src={logoSrc('#B8892B', '#FFFFFF')} alt="" />
        <p className="qrsmall">Barbearia do</p>
        <h2 className="qrword">RATÃO</h2>
        <p className="qrlead">Agende seu horário pelo celular</p>
        {png ? <img className="qrimg" src={png} alt="QR Code do app da barbearia" /> : <div className="qrimg" />}
        <p className="qrhint">Aponte a câmera do celular para o QR Code</p>
        <ol className="qrsteps"><li>Crie sua conta</li><li>Escolha o barbeiro e o horário</li><li>Pronto, é só aparecer</li></ol>
        <p className="qrurl">{url.replace(/^https?:\/\//, '')}</p>
      </div>
      <div className="qrbar stripes" />
    </div>
  );
}

export default function ShareTab() {
  const toast = useToast();
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const [url, setUrl] = useState(window.location.origin);
  const [png, setPng] = useState('');
  const [err, setErr] = useState('');
  const clean = url.trim();
  const valid = /^https?:\/\/[^\s/]+\.[^\s/]+/i.test(clean) || /^https?:\/\/localhost/i.test(clean);

  useEffect(() => {
    let alive = true;
    if (!valid) { setPng(''); return undefined; }
    const t = setTimeout(() => {
      makeQr(clean)
        .then((d) => { if (alive) { setPng(d); setErr(''); } })
        .catch(() => { if (alive) setErr('Não foi possível gerar o QR Code.'); });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [clean, valid]);

  const message = `✂️ *Barbearia do Ratão* agora tem agendamento online!\n\nEscolha seu barbeiro e o melhor horário direto pelo celular, sem fila e sem precisar chamar no WhatsApp.\n\n👉 ${clean}\n\n_Dica: no celular, abra o link e toque em "Adicionar à tela inicial" para ter o app sempre à mão._`;

  async function copy(text, ok) {
    try { await navigator.clipboard.writeText(text); toast(ok); }
    catch { toast('Não foi possível copiar. Selecione e copie à mão.'); }
  }
  function download() {
    const a = document.createElement('a');
    a.href = png; a.download = 'qrcode-barbearia-do-ratao.png';
    document.body.appendChild(a); a.click(); a.remove();
  }

  return (
    <>
      <div className="head-row"><div><h1>Link e QR Code</h1><p className="fine">Tudo o que você precisa para o cliente abrir o app e criar a conta.</p></div></div>

      {isLocal && (
        <div className="infobox">Você abriu o painel pelo endereço do seu computador (<b>localhost</b>), que só funciona aí. Abra o painel pelo site publicado no Vercel para o QR Code sair certo, ou digite o link do Vercel no campo abaixo.</div>
      )}

      <div className="sharegrid">
        <section className="panel">
          <h3>Link do app</h3>
          <label className="field">Endereço que o cliente vai abrir
            <input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" aria-invalid={!valid} />
          </label>
          {!valid && <p className="warn" style={{ marginTop: 8 }}>Digite o endereço completo, começando com https://</p>}
          <div className="linkrow" style={{ margin: '12px 0' }}>
            <button className="btn sm" disabled={!valid} onClick={() => copy(clean, 'Link copiado')}>Copiar link</button>
            <a className={`btn sm ghost${valid ? '' : ' disabled'}`} target="_blank" rel="noopener noreferrer" href={valid ? `https://wa.me/?text=${encodeURIComponent(message)}` : undefined} aria-disabled={!valid}>Enviar pelo WhatsApp</a>
            <button className="btn sm ghost" disabled={!valid} onClick={() => copy(message, 'Mensagem copiada')}>Copiar mensagem</button>
          </div>
          <h3 style={{ fontSize: 22, marginTop: 16 }}>Mensagem pronta</h3>
          <pre className="msgpreview">{message}</pre>
          <h3 style={{ fontSize: 22, marginTop: 16 }}>Como o cliente coloca o app no celular</h3>
          <p className="fine"><b>Android (Chrome):</b> abrir o link, tocar nos três pontinhos e em "Adicionar à tela inicial".<br /><b>iPhone (Safari):</b> abrir o link, tocar em Compartilhar e em "Adicionar à Tela de Início".</p>
        </section>

        <section className="panel qrcard">
          <h3 style={{ alignSelf: 'flex-start' }}>QR Code</h3>
          {png ? <img className="qrshow" src={png} alt="QR Code do app com o logo da barbearia no centro" /> : <div className="qrshow empty">{valid ? 'Gerando...' : 'Sem endereço válido'}</div>}
          {err && <p className="warn">{err}</p>}
          <div className="linkrow">
            <button className="btn" disabled={!png} onClick={download}>Baixar QR Code (PNG)</button>
            <button className="btn ghost" disabled={!png} onClick={() => window.print()}>Imprimir cartaz</button>
          </div>
          <p className="fine">Teste apontando a câmera do seu celular antes de imprimir.</p>
        </section>
      </div>

      <section className="panel">
        <h3>Cartaz para o espelho e o balcão</h3>
        <Poster png={png} url={clean} />
      </section>

      {createPortal(<div className="qrposter-print"><Poster png={png} url={clean} /></div>, document.body)}
    </>
  );
}
