import { createContext, useCallback, useContext, useRef, useState } from 'react';

const Ctx = createContext(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState('');
  const timer = useRef();
  const show = useCallback((m) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(''), 3000);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div id="toast" className={msg ? 'on' : ''} role="status" aria-live="polite">{msg}</div>
    </Ctx.Provider>
  );
}
