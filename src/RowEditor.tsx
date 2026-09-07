import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Round } from './useSharedPattern';

type Details = Pick<Round, 'label' | 'note' | 'totalStitches'>;

export function RowEditor({ round, locked, busy, error, onSave, onClose }: {
  round: Round;
  locked: boolean;
  busy: boolean;
  error: string;
  onSave: (details: Details) => Promise<boolean>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [label, setLabel] = useState(round.label);
  const [note, setNote] = useState(round.note);
  const [total, setTotal] = useState(String(round.totalStitches));
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (await onSave({ label, note, totalStitches: Number(total) })) onClose();
  }

  const inputClass = 'w-full mt-1 bg-slate-800 text-white px-3 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-400';
  return (
    <dialog ref={dialog} aria-labelledby="edit-title"
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
      className="m-auto w-[calc(100%-2rem)] max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl backdrop:bg-slate-950/80">
      <form onSubmit={save} className="space-y-4">
        <h2 id="edit-title" className="text-xl font-bold">Edit row</h2>
        <p className="text-sm text-slate-400">Your stitch count is kept. Changing the row number updates its position.</p>
        <fieldset disabled={locked} className="space-y-4">
          <label className="block text-sm font-medium">Row / Rnd
            <input autoFocus required maxLength={100} value={label} onChange={e => setLabel(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm font-medium">Total Stitches
            <input type="number" inputMode="numeric" required min={1} max={100000} step={1}
              value={total} onChange={e => setTotal(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm font-medium">Pattern Note
            <textarea maxLength={2000} rows={3} value={note} onChange={e => setNote(e.target.value)} className={inputClass} />
          </label>
          <p className="text-xs text-slate-400">If the pattern changes, update the total above too.</p>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <div className="flex gap-3">
          <button type="button" disabled={busy} onClick={onClose} className="flex-1 rounded-xl border border-slate-700 py-3 font-bold">Cancel</button>
          <button type="submit" disabled={locked || !label.trim()} className="flex-1 rounded-xl bg-indigo-600 py-3 font-bold disabled:opacity-50">
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
