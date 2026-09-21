import { collection, doc, increment, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { dayDocId, overlaps } from './availability.js';
import { mKey } from './subscriptions.js';
import { dayLabel, hm } from './time.js';

const logDoc = () => doc(collection(db, 'logs'));

/**
 * Cria o agendamento dentro de uma transação: lê o mapa de horários do barbeiro naquele dia,
 * confere conflito e grava tudo junto. Se outra pessoa reservou no mesmo instante, dá SLOT_TAKEN.
 */
export async function createAppointment({ barber, dk, start, dur, client, services, total, createdBy, status = 'agendado', settings, extra = {} }) {
  const apRef = doc(collection(db, 'appointments'));
  const dayRef = doc(db, 'days', dayDocId(barber.id, dk));
  const end = start + dur;
  const data = {
    date: dk, start, end, dur,
    barberId: barber.id, barberName: barber.name,
    clientId: client.id || null, clientName: client.name, clientPhone: client.phone || '',
    serviceIds: services.map((s) => s.id), serviceNames: services.map((s) => s.name),
    total, status, createdBy, ...extra,
  };
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(dayRef);
    const items = snap.exists() ? snap.data().items || [] : [];
    if (overlaps(items, start, end, settings.buffer)) throw new Error('SLOT_TAKEN');
    tx.set(apRef, { ...data, createdAt: serverTimestamp() });
    tx.set(dayRef, { barberId: barber.id, date: dk, items: [...items, { id: apRef.id, start, end }] });
  });
  return { id: apRef.id, ...data };
}

/** Cancela e libera o horário. `late` marca cancelamento fora do prazo (vira ocorrência). */
export async function cancelAppointment(ap, { late = false, byUid = '', byName = '' } = {}) {
  const apRef = doc(db, 'appointments', ap.id);
  const dayRef = doc(db, 'days', dayDocId(ap.barberId, ap.date));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(dayRef);
    tx.update(apRef, { status: 'cancelado', late, cancelledAt: serverTimestamp() });
    if (snap.exists()) {
      tx.set(dayRef, { barberId: ap.barberId, date: ap.date, items: (snap.data().items || []).filter((i) => i.id !== ap.id) });
    }
    tx.set(logDoc(), {
      text: `Cancelado: ${ap.clientName || 'cliente'}, ${dayLabel(ap.date)} ${hm(ap.start)} com ${ap.barberName || ''}${late ? ' (fora do prazo, ocorrência registrada)' : ''}.`,
      by: byUid, byName, at: serverTimestamp(),
    });
  });
}

export async function setStatus(ap, status, more = {}) {
  const extra = status === 'atendimento' ? { startedAt: serverTimestamp() } : status === 'concluido' ? { doneAt: serverTimestamp() } : {};
  await updateDoc(doc(db, 'appointments', ap.id), { status, ...extra, ...more });
}

/** Altera o valor de um atendimento e deixa registrado quem mudou, de quanto para quanto. */
export async function changeTotal(ap, newTotal, { byUid = '', byName = '' } = {}) {
  await runTransaction(db, async (tx) => {
    tx.update(doc(db, 'appointments', ap.id), { total: newTotal });
    tx.set(logDoc(), { text: `Valor alterado: ${ap.clientName}, ${dayLabel(ap.date)} ${hm(ap.start)}, de R$ ${Number(ap.total).toFixed(2)} para R$ ${Number(newTotal).toFixed(2)}.`, by: byUid, byName, at: serverTimestamp() });
  });
}

export async function markNoShow(ap, { byUid = '', byName = '' } = {}) {
  const dayRef = doc(db, 'days', dayDocId(ap.barberId, ap.date));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(dayRef);
    tx.update(doc(db, 'appointments', ap.id), { status: 'faltou' });
    // quem faltou libera o horário para outro cliente ou para um encaixe
    if (snap.exists()) tx.set(dayRef, { barberId: ap.barberId, date: ap.date, items: (snap.data().items || []).filter((i) => i.id !== ap.id) });
    tx.set(logDoc(), { text: `Falta registrada: ${ap.clientName}, ${dayLabel(ap.date)} ${hm(ap.start)} com ${ap.barberName}.`, by: byUid, byName, at: serverTimestamp() });
  });
}

export async function deleteAppointment(ap, { byUid = '', byName = '' } = {}) {
  const dayRef = doc(db, 'days', dayDocId(ap.barberId, ap.date));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(dayRef);
    if (snap.exists()) tx.set(dayRef, { barberId: ap.barberId, date: ap.date, items: (snap.data().items || []).filter((i) => i.id !== ap.id) });
    tx.delete(doc(db, 'appointments', ap.id));
    tx.set(logDoc(), { text: `Agendamento excluído: ${ap.clientName}, ${dayLabel(ap.date)} ${hm(ap.start)} com ${ap.barberName}.`, by: byUid, byName, at: serverTimestamp() });
  });
}

export async function createBlock({ barber, dk, start, end, reason, byUid, byName }) {
  const blkRef = doc(collection(db, 'blocks'));
  const dayRef = doc(db, 'days', dayDocId(barber.id, dk));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(dayRef);
    const items = snap.exists() ? snap.data().items || [] : [];
    if (overlaps(items, start, end, 0)) throw new Error('SLOT_TAKEN');
    tx.set(blkRef, { barberId: barber.id, date: dk, start, end, reason: reason || '' });
    tx.set(dayRef, { barberId: barber.id, date: dk, items: [...items, { id: 'blk_' + blkRef.id, start, end }] });
    tx.set(logDoc(), { text: `Horário bloqueado: ${barber.name}, ${dayLabel(dk)} das ${hm(start)} às ${hm(end)}${reason ? ` (${reason})` : ''}.`, by: byUid, byName, at: serverTimestamp() });
  });
}

export async function removeBlock(blk) {
  const dayRef = doc(db, 'days', dayDocId(blk.barberId, blk.date));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(dayRef);
    if (snap.exists()) tx.set(dayRef, { barberId: blk.barberId, date: blk.date, items: (snap.data().items || []).filter((i) => i.id !== 'blk_' + blk.id) });
    tx.delete(doc(db, 'blocks', blk.id));
  });
}

/**
 * Dá baixa no atendimento cobrindo com o plano do mensalista: conclui o atendimento e soma 1 no uso do mês,
 * tudo junto. Confere o limite de novo dentro da transação (dois barbeiros ao mesmo tempo).
 */
export async function coverAppointment(ap, sub) {
  const k = mKey(ap.date);
  const apRef = doc(db, 'appointments', ap.id);
  const subRef = doc(db, 'subscriptions', sub.id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(subRef);
    if (!snap.exists()) throw new Error('SUB_MISSING');
    const s = snap.data();
    const limit = Number(s.visits || 0);
    if (limit > 0 && Number(s.usage?.[k] || 0) >= limit) throw new Error('SUB_LIMIT');
    tx.update(apRef, { status: 'concluido', doneAt: serverTimestamp(), payMethod: 'Mensalidade', coveredByPlan: true, subId: sub.id, planName: s.planName || '' });
    tx.update(subRef, { [`usage.${k}`]: increment(1) });
  });
}
