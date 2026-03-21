import type { ReactNode } from 'react'

interface Props {
  title: ReactNode
  left?: ReactNode
  right?: ReactNode
}

/**
 * macOS-style title bar: fixed 44px height, title centered,
 * optional left/right slots pinned to the edges.
 * The outer div is the drag region; slots are no-drag.
 */
export default function PageHeader({ title, left, right }: Props) {
  return (
    <div
      className="drag-region shrink-0 h-[44px] flex items-center relative"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
    >
      {left && (
        <div className="no-drag absolute left-3 flex items-center">{left}</div>
      )}
      <div className="no-drag flex-1 flex items-center justify-center pointer-events-none">
        {title}
      </div>
      {right && (
        <div className="no-drag absolute right-3 flex items-center">{right}</div>
      )}
    </div>
  )
}
