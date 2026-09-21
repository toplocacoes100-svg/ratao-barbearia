import { useEffect, useMemo, useState } from 'react';
import { Modal } from './ui.jsx';
import { makeAppointmentCard } from '../lib/card.js';
import { brl, dayLabel, hm, todayKey, whatsappUrl } from '../lib/time.js';

const slug = (s) => String(s || 'cliente').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Banner do agendamento com os dados e o logo, pronto para mandar no WhatsApp.
 * audience: 'staff' (a barbearia manda para o cliente) ou 'client' (o cliente guarda ou compartilha o comprovante).
 * chat: { phone } abre a conversa certa. O WhatsApp não deixa um link anexar imagem sozinho:
 * no celular usamos o menu de compartilhar; no computador, baixar ou copiar e anexar.
 */
export default function ShareCardDialog({ ap, barber, settings, audience = 'staff', chat, toast, onClose }) {
  const [kind, setKind] = useState(audience === 'staff' && ap.date === todayKey() ? 'lembrete' : 'confirmacao');
  const [img, setImg] = useState(null);
  const [err, setErr] = useState('');

  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const end = ap.end ?? ap.start + (ap.dur || 30);
  const covered = Boolean(ap.coveredByPlan);
  const cancelH = Math.round((settings.cancelMin || 120) / 60);

  useEffect(() => {
    let alive = true;
    setImg(null); setErr('');
    makeAppointmentCard({
      kind,
      shop: { name: settings.name, address: settings.address, phone: settings.phone, instagram: settings.instagram, site: isLocal ? '' : window.location.origin },
      client: ap.clientName, services: ap.serviceNames || [], dur: ap.dur ?? end - ap.start,
      total: covered ? 0 : Number(ap.total || 0), plan: covered ? (ap.planName || 'mensalista') : '',
      date: ap.date, start: ap.start, end,
      barber: { name: ap.barberName || barber?.name || '', photo: barber?.photo || '' },
      footnote: `Cancele sem custo até ${cancelH} horas antes.`,
    }).then((r) => { if (alive) setImg(r); })
      .catch((e) => { console.error(e); if (alive) setErr('Não foi possível criar o banner. Tente de novo.'); });
    return () => { alive = false; };
  }, [kind, ap.id, ap.start, ap.total, covered, barber?.photo, settings.name, settings.address, settings.phone, settings.instagram, cancelH]);

  const file = useMemo(() => (img ? new File([img.blob], `agendamento-${slug(ap.clientName)}.png`, { type: 'image/png' }) : null), [img, ap.clientName]);

  const first = (ap.clientName || '').split(' ')[0];
  const when = `${dayLabel(ap.date)} às ${hm(ap.start)}`;
  const svc = (ap.serviceNames || []).join(' + ');
  const price = covered ? 'coberto pelo seu plano' : brl(ap.total || 0);
  const barberName = (ap.barberName || '').split(' ')[0];
  const place = settings.address ? `\n📍 ${settings.address}` : '';
  const caption = audience === 'client'
    ? `✂️ *${settings.name}*\n\nMeu horário está marcado:\n📅 ${when}\n💈 ${barberName}\n🧾 ${svc}${place}`
    : kind === 'lembrete'
      ? `⏰ *Lembrete do seu horário*\n\nOi, ${first}! Passando para lembrar do seu horário na *${settings.name}*.\n\n📅 ${when}\n💈 ${barberName}\n🧾 ${svc}${place}\n\nQualquer imprevisto, avise com ${cancelH}h de antecedência. Te esperamos!`
      : `✂️ *Horário confirmado*\n\nOi, ${first}! Seu horário na *${settings.name}* está confirmado.\n\n📅 ${when}\n💈 ${barberName}\n🧾 ${svc}\n💰 ${price}${place}\n\nPrecisa remarcar? Avise com ${cancelH}h de antecedência.`;

  const canShare = Boolean(file && navigator.canShare && navigator.canShare({ files: [file] }));
  const chatUrl = chat?.phone ? whatsappUrl(chat.phone, caption) : '';

  function download() {
    const a = document.createElement('a');
    a.href = img.dataUrl; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
  }
  async function send() {
    if (canShare) {
      try { await navigator.share({ files: [file], text: caption, title: settings.name }); }
      catch (e) { if (e?.name !== 'AbortError') toast('Não foi possível abrir o compartilhamento. Use "Baixar imagem".'); }
      return;
    }
    download();
    if (chatUrl) window.open(chatUrl, '_blank', 'noopener');
    toast(chatUrl ? 'Imagem baixada. Anexe na conversa que abriu.' : 'Imagem baixada.');
  }
  async function copyImage() {
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': img.blob })]); toast('Imagem copiada. Cole na conversa com Ctrl+V.'); }
    catch { toast('Não foi possível copiar. Use "Baixar imagem".'); }
  }

  return (
    <Modal title="Banner do agendamento" onClose={onClose} actions={[{ label: 'Fechar', kind: 'ghost', onClick: onClose }]}>
      {audience === 'staff' && (
        <div className="pills" role="group" aria-label="Tipo de mensagem">
          <button className="pillbtn" aria-pressed={kind === 'confirmacao'} onClick={() => setKind('confirmacao')}>Confirmação</button>
          <button className="pillbtn" aria-pressed={kind === 'lembrete'} onClick={() => setKind('lembrete')}>Lembrete</button>
        </div>
      )}

      {img ? <img className="cardprev" src={img.dataUrl} alt="Banner do agendamento com os dados e o logo da barbearia" />
        : <div className="cardprev empty">{err || 'Criando o banner...'}</div>}

      <button className="btn wide" disabled={!img} onClick={send}>{canShare ? 'Enviar pelo WhatsApp' : chatUrl ? 'Baixar e abrir a conversa' : 'Baixar imagem'}</button>
      <div className="linkrow">
        {chatUrl && <a className="btn sm ghost" target="_blank" rel="noopener noreferrer" href={chatUrl}>Só abrir a conversa</a>}
        <button className="btn sm ghost" disabled={!img} onClick={download}>Baixar imagem</button>
        {typeof ClipboardItem !== 'undefined' && <button className="btn sm ghost" disabled={!img} onClick={copyImage}>Copiar imagem</button>}
      </div>
      <p className="fine">
        {canShare
          ? 'Toque em "Enviar pelo WhatsApp", escolha o WhatsApp e depois o contato. A imagem e o texto vão juntos.'
          : 'No computador: baixe ou copie a imagem, abra a conversa com o cliente e anexe (ou cole com Ctrl+V). O WhatsApp não permite anexar a imagem sozinho por link.'}
      </p>
      {isLocal && <p className="fine">Você está no endereço do seu computador: o QR do banner só aparece pelo site publicado.</p>}
    </Modal>
  );
}
