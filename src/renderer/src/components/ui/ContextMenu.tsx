import { useEffect, useRef, useState } from 'react'

interface Props {
  x: number
  y: number
  onSave: (comment: string) => void
  onClose: () => void
}

export default function ContextMenu({ x, y, onSave, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<'menu' | 'comment'>('menu')
  const [comment, setComment] = useState('')

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

  const handleSave = () => {
    onSave(comment.trim())
    onClose()
  }

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left: x, top: y, zIndex: 9999 }}
      className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
    >
      {step === 'menu' ? (
        <button
          onClick={() => setStep('comment')}
          className="w-full text-left px-3 py-2 text-sm bg-white text-black hover:bg-gray-100 transition-colors min-w-[160px]"
        >
          Save for Clinician
        </button>
      ) : (
        <div className="p-3 flex flex-col gap-2 w-64">
          <p className="text-xs font-medium text-gray-500">Add a note (optional)</p>
          <textarea
            autoFocus
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
            }}
            placeholder="Why are you saving this?"
            rows={3}
            className="w-full text-sm text-black border border-gray-200 rounded-md px-2 py-1.5 resize-none focus:outline-none focus:border-gray-400"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-md text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="text-xs px-3 py-1.5 rounded-md bg-black text-white hover:bg-gray-800 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
