import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useSharedPattern, type Round } from './src/useSharedPattern';
import { RowEditor } from './src/RowEditor';
import { Plus, Minus, ArrowRight, CheckCircle2, Circle, Trash2, PlusCircle, Play, Pencil } from 'lucide-react';

export default function App() {
  const { rounds, activeId, connected, busy, error, send, clearError } = useSharedPattern();
  const [editingRound, setEditingRound] = useState<Round | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newTotal, setNewTotal] = useState('');
  const locked = !connected || busy;

  const parsePattern = (text: string) => {
    if (!text) return null;
    const explicitTotalMatch = text.match(/\(\s*(\d+)\s*\)\s*$/);
    if (explicitTotalMatch) return parseInt(explicitTotalMatch[1], 10);

    const bracketMatch = text.match(/\[(.*?)\]\s*x\s*(\d+)/i);
    if (bracketMatch) {
      const inside = bracketMatch[1];
      const multiplier = parseInt(bracketMatch[2], 10);
      const parts = inside.split(',');
      let sum = 0;
      
      parts.forEach(part => {
        part = part.trim().toLowerCase();
        const numMatch = part.match(/^(\d+)/);
        const count = numMatch ? parseInt(numMatch[1], 10) : 1;
        sum += part.includes('inc') ? count * 2 : count * 1; 
      });
      return sum * multiplier;
    }
    return null;
  };

  const handleNoteChange = (e: ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setNewNote(text);
    const parsedTotal = parsePattern(text);
    if (parsedTotal) setNewTotal(parsedTotal.toString());
  };

  const addRound = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const total = Number(newTotal);
    if (!Number.isSafeInteger(total) || total < 1) return;
    const fallbackLabel = `Rnd ${rounds.length + 1}`;
    const saved = await send({ type: 'add', label: newLabel || fallbackLabel,
      note: newNote, totalStitches: total });
    if (!saved) return;
    const nextNum = parseInt((newLabel || fallbackLabel).replace(/\D/g, ''), 10) + 1;
    setNewLabel(!isNaN(nextNum) ? `Rnd ${nextNum}` : '');
    setNewNote('');
    setNewTotal('');
  };

  const setActiveId = (id: string) => void send({ type: 'select', id });
  const deleteRound = (id: string) => {
    const row = rounds.find(r => r.id === id);
    if (window.confirm(`Delete ${row?.label || 'this row'} and its stitch count?`)) {
      void send({ type: 'delete', id });
    }
  };
  const toggleComplete = (id: string) => void send({ type: 'toggle', id });
  const activeRound = rounds.find(r => r.id === activeId);
  const increment = () => activeRound && void send({ type: 'increment', id: activeRound.id });
  const decrement = () => activeRound && void send({ type: 'decrement', id: activeRound.id });
  const completeAndNext = () => activeRound && void send({ type: 'complete', id: activeRound.id });

  return (
    <div className="app-shell flex flex-col h-screen max-h-[100dvh] bg-slate-950 text-slate-100 font-sans select-none touch-manipulation overflow-hidden">
      
      <div className="shrink-0 px-4 py-2 text-xs flex justify-between items-center gap-3 border-b border-slate-800" role="status">
        <h1 className="font-bold text-slate-300">Stitch Tracker</h1>
        <span className={connected ? 'text-emerald-400' : 'text-amber-300'}>
          {connected ? (busy ? 'Saving…' : 'Shared · saved on computer') : 'Connecting to computer…'}
        </span>
      </div>
      {!connected && <p className="shrink-0 px-4 py-2 text-sm text-amber-200 bg-amber-950/40" role="status">
        Keep the tracker running on your computer and both devices on the same Wi-Fi. Reconnecting automatically.
      </p>}
      {error && <p className="shrink-0 px-4 py-2 text-sm text-red-200 bg-red-950/40" role="alert">{error}</p>}
      {/* TOP SECTION: Active Tracker (Fixed) */}
      <div className="shrink-0 bg-slate-900 shadow-2xl z-10 p-4 pb-6 rounded-b-3xl border-b border-slate-800">
        <div className="max-w-md mx-auto">
          {activeRound ? (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h2 className="text-xl font-bold text-indigo-400">{activeRound.label}</h2>
                  <p className="text-slate-300 font-medium text-lg leading-tight mt-1">{activeRound.note || "No pattern note"}</p>
                </div>
                <div className="bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-sm font-bold text-slate-400 text-center">
                  Target: <span className="text-white block text-lg">{activeRound.totalStitches}</span>
                </div>
              </div>

              {/* Progress Display */}
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-black tabular-nums tracking-tighter text-white drop-shadow-md">
                    {activeRound.currentStitch}
                  </span>
                  <span className="text-xl text-slate-500 font-bold">/ {activeRound.totalStitches}</span>
                </div>

                {activeRound.currentStitch >= activeRound.totalStitches && activeRound.totalStitches > 0 && (
                  <span className="flex items-center gap-1.5 text-emerald-400 font-bold tracking-wide animate-pulse bg-emerald-400/10 px-3 py-1.5 rounded-full text-sm">
                    <CheckCircle2 size={16} /> Complete!
                  </span>
                )}
              </div>

              {/* Big Controls */}
              <div className="flex gap-3 h-24">
                <button
                  onClick={decrement}
                  disabled={locked || activeRound.currentStitch === 0}
                  className="flex-1 max-w-[80px] bg-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-slate-200 active:scale-95 transition-all border border-slate-700"
                  aria-label="Remove stitch"
                >
                  <Minus size={28} strokeWidth={3} />
                  <span className="text-xs font-bold mt-1">Frog</span>
                </button>
                
                <button
                  onClick={increment}
                  disabled={locked || activeRound.currentStitch >= activeRound.totalStitches}
                  className="flex-[2] bg-indigo-600 rounded-2xl flex flex-col items-center justify-center text-white hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-lg shadow-indigo-900/50 border border-indigo-500 disabled:opacity-50 disabled:bg-slate-700 disabled:border-slate-600 disabled:shadow-none"
                >
                  <Plus size={40} strokeWidth={3} />
                  <span className="text-lg font-bold tracking-wide">Stitch</span>
                </button>
              </div>

              {/* Complete Row Button */}
              {activeRound.currentStitch >= activeRound.totalStitches && activeRound.totalStitches > 0 && (
                <button 
                  onClick={completeAndNext}
                  disabled={locked || activeRound.completed}
                  className="w-full py-4 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-500/30 active:scale-95 transition-all"
                >
                  {activeRound.completed ? (rounds.every(r => r.completed) ? 'Pattern complete!' : 'Row complete') : 'Mark Row Complete & Next'} <ArrowRight size={20} strokeWidth={3} />
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 bg-slate-800/50 rounded-2xl border border-slate-800 border-dashed">
              <p className="font-medium text-lg mb-2">No Active Row</p>
              <p className="text-sm">Add a row below and select it to start tracking.</p>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM SECTION: Pattern List (Scrollable) */}
      <div className="pattern-panel flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar">
        <div className="max-w-md mx-auto space-y-6 pb-20">
          
          {/* List of Rounds */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider pl-1">Pattern Rows</h3>
            <p className="text-xs text-slate-400 pl-1 pb-1">Sorted by number · “Rnd 4” and “4” sort together</p>
            
            {rounds.length === 0 ? (
              <div className="text-center py-6 text-slate-600 italic text-sm">
                Your pattern is empty. Add your first row below!
              </div>
            ) : (
              rounds.map((r) => {
                const isActive = activeId === r.id;
                return (
                  <div 
                    key={r.id} 
                    className={`flex items-stretch gap-2 p-3 rounded-2xl transition-all border ${
                      isActive 
                        ? 'bg-indigo-900/20 border-indigo-500/50 shadow-lg shadow-indigo-900/20' 
                        : r.completed 
                          ? 'bg-slate-900/50 border-slate-800 opacity-60'
                          : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {/* Checkbox */}
                    <button 
                      onClick={() => toggleComplete(r.id)}
                      disabled={locked}
                      aria-label={`${r.completed ? "Mark incomplete" : "Mark complete"}: ${r.label}`}
                      className={`shrink-0 flex items-center justify-center w-10 transition-colors ${
                        r.completed ? 'text-emerald-400' : 'text-slate-600 hover:text-indigo-400'
                      }`}
                    >
                      {r.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                    </button>

                    {/* Row Info (Click to activate) */}
                    <button
                      type="button"
                      className="flex-1 min-w-0 text-left py-1"
                      onClick={() => setActiveId(r.id)}
                      disabled={locked}
                      aria-label={`Track ${r.label}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${r.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                          {r.label}
                        </span>
                        {isActive && <span className="text-[10px] font-bold bg-indigo-600 px-2 py-0.5 rounded-full text-white uppercase tracking-wider">Active</span>}
                      </div>
                      <p className={`text-sm mt-0.5 line-clamp-1 ${r.completed ? 'text-slate-600' : 'text-slate-400'}`}>
                        {r.note || "No note"} • {r.totalStitches} sts
                      </p>
                    </button>

                    {/* Play/Select & Delete Actions */}
                    <div className="flex flex-col gap-1 justify-center shrink-0">
                      <button
                        onClick={() => { clearError(); setEditingRound(r); }}
                        disabled={locked}
                        className="p-2 text-slate-300 hover:text-indigo-300 hover:bg-indigo-400/10 rounded-lg transition-colors"
                        aria-label={`Edit ${r.label}`}
                        title="Edit row"
                      >
                        <Pencil size={18} />
                      </button>
                      {!isActive && (
                         <button 
                         disabled={locked}
                         onClick={() => setActiveId(r.id)}
                         className="p-2 text-indigo-400/70 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors"
                         aria-label="Set as active row"
                       >
                         <Play size={18} fill="currentColor" />
                       </button>
                      )}
                      <button 
                        onClick={() => deleteRound(r.id)}
                        disabled={locked}
                        className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        aria-label="Delete row"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Add New Round Form */}
          <form onSubmit={addRound} className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <PlusCircle size={16} className="text-indigo-400" /> Add Pattern Row
            </h3>
            
            <fieldset disabled={locked} className="space-y-4">
            <div className="flex gap-2">
              <div className="w-1/3">
                <label htmlFor="row-label" className="text-[10px] uppercase font-bold text-slate-500 ml-1 block mb-1">Row / Rnd</label>
                <input
                  type="text"
                  id="row-label"
                  maxLength={100}
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Rnd 5"
                  className="w-full bg-slate-800 text-white px-3 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="stitch-total" className="text-[10px] uppercase font-bold text-slate-500 ml-1 block mb-1">Total Stitches</label>
                <input
                  id="stitch-total"
                  type="number"
                  min={1}
                  max={100000}
                  step={1}
                  required
                  inputMode="numeric"
                  value={newTotal}
                  onChange={(e) => setNewTotal(e.target.value)}
                  placeholder="Count"
                  className="w-full bg-slate-800 text-white px-3 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 text-sm font-bold"
                />
              </div>
            </div>

            <div>
              <label htmlFor="pattern-note" className="text-[10px] uppercase font-bold text-slate-500 ml-1 flex justify-between mb-1">
                <span>Pattern Note</span>
                <span className="text-indigo-400/70 lowercase italic">auto-calculates total</span>
              </label>
              <input
                type="text"
                id="pattern-note"
                maxLength={2000}
                value={newNote}
                onChange={handleNoteChange}
                placeholder="e.g. [6 sc, inc] x 4"
                className="w-full bg-slate-800 text-white px-3 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>
            
            <button
              type="submit"
              disabled={locked || !Number.isSafeInteger(Number(newTotal)) || Number(newTotal) < 1}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-slate-700 text-white font-bold rounded-xl transition-all active:scale-[0.98]"
            >
              Add Row to Pattern
            </button>
            </fieldset>
          </form>

        </div>
      </div>
      
      {editingRound && <RowEditor round={editingRound} locked={locked} busy={busy} error={error}
        onClose={() => { setEditingRound(null); clearError(); }}
        onSave={details => send({ type: 'edit', id: editingRound.id, ...details,
          original: { label: editingRound.label, note: editingRound.note, totalStitches: editingRound.totalStitches } })} />}
      {/* Basic CSS for custom scrollbar hiding on webkit */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}} />
    </div>
  );
}
