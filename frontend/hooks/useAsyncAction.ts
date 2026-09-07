'use client';

import { useCallback, useRef, useState } from 'react';

/** Per-action busy/error helper for buttons that call the API. */
export function useAsyncAction() {
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const [okMessage, setOkMessage] = useState('');
  const seq = useRef(0);

  const clearMessages = useCallback(() => {
    setError('');
    setOkMessage('');
  }, []);

  const run = useCallback(async <T,>(key: string, fn: () => Promise<T>, successMessage?: string): Promise<T | undefined> => {
    const id = ++seq.current;
    setBusyKey(key);
    setError('');
    setOkMessage('');
    try {
      const result = await fn();
      if (id !== seq.current) return undefined;
      if (successMessage) setOkMessage(successMessage);
      return result;
    } catch (e: unknown) {
      if (id !== seq.current) return undefined;
      const msg = e instanceof Error ? e.message : 'Request failed';
      setError(msg);
      return undefined;
    } finally {
      if (id === seq.current) setBusyKey('');
    }
  }, []);

  return {
    busyKey,
    error,
    okMessage,
    setError,
    setOkMessage,
    clearMessages,
    run,
    isBusy: (key?: string) => (key ? busyKey === key : !!busyKey),
  };
}
