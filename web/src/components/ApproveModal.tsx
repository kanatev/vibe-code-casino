import { maxUint256 } from 'viem'
import { useAction } from '../hooks/useAction'
import { chipContract, CASINO_ADDRESS, TOKEN_SYMBOL } from '../config'

/** Shown on the user's first deposit: ERC-20 requires granting the casino an
 *  allowance before it can pull chips, so we surface that as its own step —
 *  mirroring the SwitchNetworkModal prompt. */
export function ApproveModal({
  open,
  onClose,
  onApproved,
}: {
  open: boolean
  onClose: () => void
  onApproved: () => void
}) {
  const { run, pending, error } = useAction()
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h3>Approve {TOKEN_SYMBOL} transactions</h3>
        <p className="muted" style={{ fontSize: 15, lineHeight: 1.6 }}>
          One-time approval lets the casino move your {TOKEN_SYMBOL}. You approve once, then deposit.
        </p>
        <button
          className="btn btn-primary btn-block"
          disabled={pending}
          onClick={() =>
            run({ ...chipContract, functionName: 'approve', args: [CASINO_ADDRESS, maxUint256] }, () => {
              onApproved()
              onClose()
            })
          }
        >
          {pending ? (
            <span className="row gap-sm" style={{ justifyContent: 'center' }}>
              <span className="spin" /> Approving…
            </span>
          ) : (
            'Approve'
          )}
        </button>
        {error && <div className="notice error">⚠️ {error}</div>}
      </div>
    </div>
  )
}
