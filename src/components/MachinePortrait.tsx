import { useMachineState } from '@/lib/machine'
import type { MachineState } from '@/lib/types'
import sheet from '@/assets/tutor/avatar-sheet-transparent.png'

// Always reuse the approved neutral computer. Only its display changes, so
// generated variations in the housing can never make the body jump.
const FACE: Record<MachineState, { screen: string; label: string }> = {
  neutral: { screen: '216 107 176 160', label: 'attentive' },
  approval: { screen: '684 107 176 160', label: 'approving' },
  correction: { screen: '1168 107 176 160', label: 'gently correcting' },
  apologetic: { screen: '216 590 176 160', label: 'apologetic' },
  withholding: { screen: '684 590 176 160', label: 'holding back a reveal' },
  satisfied: { screen: '1168 590 176 160', label: 'proud of your progress' },
}

export function MachinePortrait() {
  const state = useMachineState()
  const face = FACE[state]
  return (
    <svg
      className="machine-portrait pixelated shrink-0 select-none"
      viewBox="0 0 384 384"
      width="96"
      height="96"
      role="img"
      aria-label={`The machine, ${face.label}`}
      data-machine-state={state}
    >
      <image href={sheet} x="-112" y="-44" width="1536" height="1024" />
      <svg x="104" y="63" width="176" height="160" viewBox={face.screen} overflow="hidden">
        <image href={sheet} width="1536" height="1024" />
      </svg>
    </svg>
  )
}
