import { Modal } from './ui.jsx';
import { coverAppointment, setStatus } from '../lib/bookings.js';
import { PAY_METHODS } from '../lib/finance.js';
import { coverInfo, findSubscription, monthName } from '../lib/subscriptions.js';
import { brl } from '../lib/time.js';

/**
 * Dar baixa no atendimento. Se o cliente é mensalista, oferece cobrir com o plano
 * (mostrando quanto já usou no mês); senão, ou se preferir, cobra avulso.
 */
export default function PayDialog({ ap, subs, toast, onClose }) {
  const sub = findSubscription(subs, ap);
  const info = sub ? coverInfo(sub, ap) : null;

  async function go(fn, ok) {
    try { await fn(); toast(ok); }
    catch (e) {
      console.error(e);
      toast(e.message === 'SUB_LIMIT' ? 'O limite do plano neste mês já foi usado. Cobre como avulso.' : 'Não foi possível concluir. Tente de novo.');
    }
    onClose();
  }

  return (
    <Modal title="Como foi o pagamento?" onClose={onClose} actions={[{ label: 'Voltar', kind: 'ghost', onClick: onClose }]}>
      <p>{ap.clientName} deve <b>{brl(ap.total)}</b> por {(ap.serviceNames || []).join(' + ')}.</p>

      {sub && (
        <div className="infobox">
          <b>Mensalista:</b> {sub.planName || 'plano'}. Usou {info.used}{info.limit ? ` de ${info.limit}` : ''} atendimento{info.used === 1 ? '' : 's'} em {monthName(ap.date)}.
          {' '}Mensalidade {info.paid ? 'paga' : <b className="warn">pendente</b>}.
          {info.ok ? (
            <button className="btn wide" style={{ marginTop: 10 }} onClick={() => go(() => coverAppointment(ap, sub), 'Baixa pelo plano registrada')}>
              Cobrir com o plano (não cobra nada agora)
            </button>
          ) : <span className="warn" style={{ display: 'block', marginTop: 6 }}>{info.reason}</span>}
        </div>
      )}

      {sub && <p className="fine">Ou cobrar como avulso:</p>}
      <div className="paygrid">
        {PAY_METHODS.map((m) => (
          <button key={m} className="btn ghost" style={{ minHeight: 56 }} onClick={() => go(() => setStatus(ap, 'concluido', { payMethod: m }), 'Baixa registrada')}>{m}</button>
        ))}
      </div>
    </Modal>
  );
}
