import { useSwitchChain } from 'wagmi'
import { sepolia } from 'wagmi/chains'

/** Shown when the user triggers an action while connected to the wrong network. */
export function SwitchNetworkModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { switchChain, isPending } = useSwitchChain()
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h3>Before you start</h3>
        <p className="muted" style={{ fontSize: 15, lineHeight: 1.6 }}>
          Switch to Sepolia as all operations must be performed within the Sepolia network.
        </p>
        <button
          className="btn btn-primary btn-block"
          disabled={isPending}
          onClick={() => switchChain({ chainId: sepolia.id }, { onSuccess: onClose })}
        >
          {isPending ? 'Switching…' : 'Switch to Sepolia'}
        </button>
      </div>
    </div>
  )
}
