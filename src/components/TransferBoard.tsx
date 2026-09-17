import { TRANSFER } from '@/lib/levels'
import { transferView, type TransferState } from '@/lib/transfer'

function History({ title, files, returns = [], kept = [], cycles = false }: {
  title: string; files: string[]; returns?: [number, number][]; kept?: number[]; cycles?: boolean
}) {
  const groups = cycles ? [files.slice(0, TRANSFER.cycleLength), files.slice(TRANSFER.cycleLength)] : [files]
  return <section className="min-w-0 space-y-3 field-border-disabled p-3" aria-label={title}>
    <h3 className="text-sm font-medium">{title}</h3>
    {groups.map((group, groupIndex) => <div key={groupIndex} className="space-y-2">
      {cycles && <p className="text-xs text-ink-dim">{groupIndex === 0 ? 'First cycle' : 'Second cycle'}</p>}
      <ol className="flex flex-wrap items-start gap-x-2 gap-y-3" aria-label={cycles ? `${title}, ${groupIndex === 0 ? 'first' : 'second'} cycle` : title}>
        {group.map((file, index) => {
          const at = groupIndex * TRANSFER.cycleLength + index
          const starts = returns.some(([start]) => start === at)
          const comesBack = returns.some(([, end]) => end === at)
          const highlighted = starts || comesBack || kept.includes(at)
          return <li key={at} className="flex items-start gap-2">
            <span className="flex flex-col items-center gap-1">
              <span className={`border px-2 py-1.5 font-mono text-xs ${highlighted ? 'border-focus bg-surface-hi text-ink' : 'border-edge text-ink-dim'}`}>
                <span className="sr-only">Request {at + 1}: </span>{file}
              </span>
              {highlighted && <span className="text-[10px] text-ink-dim">{kept.includes(at) ? 'Kept ready' : comesBack ? 'Returns' : 'Used'}</span>}
            </span>
            {index < group.length - 1 && <span aria-hidden="true" className="pt-1 text-ink-faint">→</span>}
          </li>
        })}
      </ol>
    </div>)}
  </section>
}

export function TransferBoard({ state }: { state: TransferState }) {
  const view = transferView(state)
  const order = ['Used first', 'Used second', 'Used last']
  return <div className="space-y-5">
    {view.taskB && <section aria-label="Observed request histories" className="space-y-3">
      <p className="text-xs text-ink-dim">Requests already observed · oldest → newest</p>
      <div className={`grid gap-3 ${view.taskA ? 'sm:grid-cols-2' : ''}`}>
        {view.taskA && <History title="Task A, iterative debugging" files={view.taskA} returns={view.shortReturns} />}
        <History title="Task B, a four-file loop" files={view.taskB} cycles={view.cycles} kept={view.nextIndices} />
      </div>
    </section>}
    <section aria-label="Context window" className="field-border-disabled p-3 sm:p-4">
      <h2 className="mb-3 text-sm font-medium">Context window · {TRANSFER.capacity} files fit in this example</h2>
      {view.request && <p className="mb-3 text-xs text-ink-dim">Earlier in Task B · before request {view.requestIndex! + 1}</p>}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {view.slots.map((file, index) => <div key={index} className="min-w-0 space-y-2 text-center">
          {file && <p className="text-[10px] text-ink-dim sm:text-xs">{order[index]}</p>}
          <div className={`field-border-disabled flex min-h-16 items-center justify-center border-2 px-1 font-mono text-xs sm:min-h-20 sm:text-sm ${file === null ? 'border-dashed border-edge text-ink-faint' : file === view.victim ? 'border-focus bg-surface-hi' : 'border-edge bg-surface-hi'}`}>
            <span className="break-all">{file ?? 'Empty'}</span>
          </div>
          {view.victim && <p className="text-xs text-ink-dim">{file === view.victim ? 'Leave out' : 'Keep'}</p>}
        </div>)}
      </div>
      {view.request && <p className="mt-4 text-sm text-ink-dim">Requested file: <span className="font-mono text-ink">{view.request}</span></p>}
    </section>
    {view.request && <p className="text-xs text-ink-dim">When a needed file is missing and all {TRANSFER.capacity} slots are full, choose among the files already in the window.</p>}
  </div>
}
