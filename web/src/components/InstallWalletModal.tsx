const METAMASK_URLS = {
  chromium: 'https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn',
  firefox: 'https://addons.mozilla.org/en-US/firefox/addon/ether-metamask/',
  generic: 'https://metamask.io/download',
} as const

/** Route straight to the right extension store for the user's browser —
 *  metamask.io/download has a confusing UX that pushes the mobile app first. */
function metamaskInstallUrl(): string {
  if (typeof navigator === 'undefined') return METAMASK_URLS.generic
  const ua = navigator.userAgent
  if (/Firefox\//i.test(ua)) return METAMASK_URLS.firefox
  // Chrome, Brave, Opera (OPR/), Edge (Edg/) — all Chromium, use the Chrome store.
  if (/Edg\/|OPR\/|Chrome\/|Chromium\//i.test(ua)) return METAMASK_URLS.chromium
  return METAMASK_URLS.generic
}

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
          We currently support <strong>MetaMask</strong> wallets only.
        </p>
        <a
          className="btn btn-primary btn-block"
          href={metamaskInstallUrl()}
          target="_blank"
          rel="noreferrer"
          onClick={() => sessionStorage.setItem('vibe-mm-installing', '1')}
        >
          Add MetaMask
        </a>
      </div>
    </div>
  )
}
