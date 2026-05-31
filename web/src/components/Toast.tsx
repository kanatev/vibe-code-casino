import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastFn, type ToastKind } from '../hooks/useToast'

type ToastItem = { id: number; message: string; kind: ToastKind }

const ICON: Record<ToastKind, string> = { error: '⚠️', warn: '⏳', ok: '✓' }

// How long a toast stays on screen. Kept short so messages don't linger.
const TOAST_MS = 2000

/** Renders transient messages as floating toasts instead of in-panel notices,
 *  so panels never resize when an error or status appears. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const notify = useCallback<ToastFn>((message, kind = 'error') => {
    const id = ++idRef.current
    setToasts((list) => [...list, { id, message, kind }])
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), TOAST_MS)
  }, [])

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span aria-hidden>{ICON[t.kind]}</span> {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
