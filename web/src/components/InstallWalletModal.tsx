const METAMASK_DOWNLOAD = 'https://metamask.io/download/'

/** Single shared "install a wallet" dialog, opened from any WalletButton. */
export function InstallWalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h3>Install Wallet</h3>
        <p className="muted" style={{ fontSize: 15, lineHeight: 1.6 }}>
          We currently support <strong>MetaMask</strong> wallets only. Install MetaMask, then come
          back and connect.
        </p>
        <a className="btn btn-primary btn-block" href={METAMASK_DOWNLOAD} target="_blank" rel="noreferrer">
          Install MetaMask
        </a>
      </div>
    </div>
  )
}
