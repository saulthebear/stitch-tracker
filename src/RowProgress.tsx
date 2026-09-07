import { progressSections } from './pattern';
import type { Round } from './useSharedPattern';

export function RowProgress({ round, large = false }: { round: Round; large?: boolean }) {
  const sections = progressSections(round.note, round.totalStitches, round.currentStitch);
  const sectionDescription = sections.length > 1
    ? `, ${sections.length} sections of ${round.totalStitches / sections.length} stitches` : '';
  return (
    <div role="progressbar" aria-label={`${round.label} stitch progress`}
      aria-valuemin={0} aria-valuemax={round.totalStitches} aria-valuenow={round.currentStitch}
      aria-valuetext={`${round.currentStitch} of ${round.totalStitches} stitches${sectionDescription}`}
      title={`${round.currentStitch} / ${round.totalStitches} stitches${sectionDescription}`}
      className={`flex w-full ${sections.length > 24 ? 'gap-px' : 'gap-1'} ${large ? 'h-2.5' : 'h-1.5'}`}>
      {sections.map((fill, index) => (
        <div key={index} aria-hidden="true" className="h-full min-w-0 flex-1 overflow-hidden rounded-full bg-slate-700">
          <div className={`h-full rounded-full transition-[width] duration-150 motion-reduce:transition-none ${round.completed || fill === 1 ? 'bg-emerald-400' : 'bg-indigo-400'}`}
            style={{ width: `${fill * 100}%` }} />
        </div>
      ))}
    </div>
  );
}
