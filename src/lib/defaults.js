// Horários em minutos desde a meia-noite (540 = 09:00). Domingo (0) fechado.
export const DEFAULT_SETTINGS = {
  name: 'Barbearia do Ratão',
  buffer: 5,        // intervalo entre atendimentos (min)
  minAdvance: 60,   // antecedência mínima para agendar (min)
  cancelMin: 120,   // antecedência mínima para cancelar sem ocorrência (min)
  step: 30,         // de quanto em quanto tempo os horários são oferecidos (min)
  hours: {
    1: { open: 540, close: 1140 },
    2: { open: 540, close: 1140 },
    3: { open: 540, close: 1140 },
    4: { open: 540, close: 1140 },
    5: { open: 540, close: 1140 },
    6: { open: 480, close: 1020 },
  },
};

export const SEED_BARBERS = [
  { id: 'caio', name: 'Caio Mendes', short: 'Caio', spec: 'Degradê e navalha', color: '#D4A94F', lunch: { start: 720, end: 780 }, off: [], commissionService: 50, commissionProduct: 15, active: true },
  { id: 'tico', name: 'Tico Ramos', short: 'Tico', spec: 'Barba e toalha quente', color: '#6FA1F0', lunch: { start: 750, end: 810 }, off: [3], commissionService: 50, commissionProduct: 15, active: true },
  { id: 'bruno', name: 'Bruno Vaz', short: 'Bruno', spec: 'Cortes clássicos e pigmentação', color: '#E0715A', lunch: { start: 780, end: 840 }, off: [1], commissionService: 45, commissionProduct: 15, active: true },
];

const ALL = ['caio', 'tico', 'bruno'];
export const SEED_SERVICES = [
  { id: 'combo', name: 'Corte + Barba', cat: 'Combo', price: 70, dur: 75, barberIds: ALL, includes: ['corte', 'barba'], saves: 10, active: true },
  { id: 'corte', name: 'Corte', cat: 'Cabelo', price: 45, dur: 45, barberIds: ALL, active: true },
  { id: 'degrade', name: 'Degradê navalhado', cat: 'Cabelo', price: 55, dur: 50, barberIds: ['caio', 'bruno'], active: true },
  { id: 'barba', name: 'Barba', cat: 'Barba', price: 35, dur: 30, barberIds: ALL, active: true },
  { id: 'toalha', name: 'Barba com toalha quente', cat: 'Barba', price: 45, dur: 40, barberIds: ['tico', 'bruno'], active: true },
  { id: 'sobrancelha', name: 'Sobrancelha', cat: 'Acabamento', price: 15, dur: 15, barberIds: ALL, active: true },
  { id: 'pezinho', name: 'Pezinho', cat: 'Acabamento', price: 15, dur: 15, barberIds: ALL, active: true },
  { id: 'pigmentacao', name: 'Pigmentação', cat: 'Tratamento', price: 40, dur: 40, barberIds: ['caio', 'bruno'], active: true },
  { id: 'hidratacao', name: 'Hidratação', cat: 'Tratamento', price: 30, dur: 30, barberIds: ALL, active: true },
];
export const CATS = ['Combo', 'Cabelo', 'Barba', 'Acabamento', 'Tratamento'];
