import { useEffect, useRef, useState } from 'react';

export type Round = {
  id: string;
  label: string;
  note: string;
  totalStitches: number;
  currentStitch: number;
  completed: boolean;
};
type Pattern = { revision: number; rounds: Round[]; activeId: string | null };
type Action = { type: 'add'; label: string; note: string; totalStitches: number } |
  { type: 'edit'; id: string; label: string; note: string; totalStitches: number;
    original: Pick<Round, 'label' | 'note' | 'totalStitches'> } |
  { type: 'select' | 'increment' | 'decrement' | 'toggle' | 'delete' | 'complete'; id: string };

export function useSharedPattern() {
  const [pattern, setPattern] = useState<Pattern>({ revision: -1, rounds: [], activeId: null });
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);

  function accept(next: Pattern) {
    setPattern(current => next.revision >= current.revision ? next : current);
    setConnected(true);
  }

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch('/api/state', {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
        });
        if (!response.ok) throw new Error('Unavailable');
        const next: Pattern = await response.json();
        if (!stopped) accept(next);
      } catch {
        if (!stopped) setConnected(false);
      } finally {
        if (!stopped) timer = setTimeout(refresh, 1000);
      }
    }
    void refresh();
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, []);

  async function send(action: Action): Promise<boolean> {
    if (sending.current || !connected) return false;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
        signal: AbortSignal.timeout(8000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save the change.');
      accept(result);
      return true;
    } catch (cause) {
      setError(cause instanceof Error && cause.name === 'Error' ? cause.message :
        'Connection interrupted. Check the count after reconnecting before trying again.');
      return false;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return { ...pattern, connected, busy, error, send, clearError: () => setError('') };
}
