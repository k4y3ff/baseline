import { useEffect, useRef } from 'react'

interface Props {
  x: number
  y: number
  onSave: () => void
  onClose: () => void
}

export default function ContextMenu({ x, y, onSave, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left: x, top: y, zIndex: 9999 }}
      className="bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px] overflow-hidden"
    >
      <button
        onClick={() => { onSave(); onClose() }}
        className="w-full text-left px-3 py-2 text-sm bg-white text-black hover:bg-gray-100 transition-colors"
      >
        Save for Clinician
      </button>
    </div>
  )
}
