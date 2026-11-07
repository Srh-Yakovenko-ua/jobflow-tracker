import { useEffect, useEffectEvent } from 'react';

export type LeaveHandlers = Readonly<{ onHide: () => void; onUnmount: () => void }>;

export function useSaveOnLeave(handlers: LeaveHandlers) {
  const onHide = useEffectEvent(handlers.onHide);
  const onUnmount = useEffectEvent(handlers.onUnmount);
  useEffect(() => {
    const pageHide = () => {
      onHide();
    };
    const visibilityChange = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    window.addEventListener('pagehide', pageHide);
    document.addEventListener('visibilitychange', visibilityChange);
    return () => {
      window.removeEventListener('pagehide', pageHide);
      document.removeEventListener('visibilitychange', visibilityChange);
      onUnmount();
    };
  }, []);
}
