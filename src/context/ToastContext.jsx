import { createContext, useCallback, useContext, useRef, useState } from 'react';

const Ctx = createContext(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState('');
  const timer = useRef();
  const show = useCallback((m) => {
    setMsg(m);
    clearTimeout(timer.current);
    // mensagens longas ficam mais tempo na tela (de 3 a 9 segundos)
    timer.current = setTimeout(() => setMsg(''), Math.min(9000, Math.max(3000, String(m).length * 55)));
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div id="toast" className={msg ? 'on' : ''} role="status" aria-live="polite">{msg}</div>
    </Ctx.Provider>
  );
}
