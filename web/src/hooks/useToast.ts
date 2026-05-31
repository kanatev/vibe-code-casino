import { createContext, useContext } from 'react'

export type ToastKind = 'error' | 'warn' | 'ok'
export type ToastFn = (message: string, kind?: ToastKind) => void

// Default is a no-op so calling outside a provider is harmless.
export const ToastContext = createContext<ToastFn>(() => {})

/** Fire an auto-dismissing toast, e.g. toast('You rejected the request.'). */
export function useToast(): ToastFn {
  return useContext(ToastContext)
}
