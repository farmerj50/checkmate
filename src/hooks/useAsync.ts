import { useCallback, useEffect, useState, type DependencyList } from 'react';

export type AsyncStatus = 'loading' | 'success' | 'error';

export interface UseAsyncResult<T> {
  data: T | undefined;
  status: AsyncStatus;
  error: Error | null;
  reload: () => void;
}

/** Thin data-fetching hook: tracks loading/error/data for any async call, re-runs on deps change or reload(). */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): UseAsyncResult<T> {
  const [data, setData] = useState<T>();
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    fn()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setStatus('success');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { data, status, error, reload };
}
