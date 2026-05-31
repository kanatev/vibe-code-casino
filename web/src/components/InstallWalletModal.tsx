const METAMASK_URLS = {
  chromium: 'https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn',
  firefox: 'https://addons.mozilla.org/en-US/firefox/addon/ether-metamask/',
  android: 'https://play.google.com/store/apps/details?id=io.metamask',
  ios: 'https://apps.apple.com/us/app/metamask-trade-crypto/id1438144202',
  generic: 'https://metamask.io/download',
} as const

/** iPadOS reports a desktop ("Macintosh") UA, so catch it via a touch-capable Mac. */
function isMobileUA(ua: string): boolean {
  return (
    /Android|iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
  )
}

/** Desktop has a browser extension; route straight to the right store —
 *  metamask.io/download has a confusing UX that pushes the mobile app first. */
function desktopExtensionUrl(ua: string): string {
  if (/Firefox\//i.test(ua)) return METAMASK_URLS.firefox
  // Chrome, Brave, Opera (OPR/), Edge (Edg/) — all Chromium, use the Chrome store.
  if (/Edg\/|OPR\/|Chrome\/|Chromium\//i.test(ua)) return METAMASK_URLS.chromium
  return METAMASK_URLS.generic
}

/** Native app store for the user's phone — used as a last-resort fallback. */
function mobileStoreUrl(ua: string): string {
  return /Android/i.test(ua) ? METAMASK_URLS.android : METAMASK_URLS.ios
}

/** MetaMask universal link: a tap opens the dapp inside MetaMask's in-app browser
 *  if the app is installed; Branch redirects to the app store otherwise. */
function metamaskDeeplink(): string {
  const { host, pathname, search } = window.location
  return `https://metamask.app.link/dapp/${host}${pathname}${search}`
}

/** Single shared "install a wallet" dialog, opened from any WalletButton. */
export function InstallWalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const mobile = isMobileUA(ua)
  const href = mobile ? metamaskDeeplink() : desktopExtensionUrl(ua)

  // Desktop: the extension does not inject into an already-open tab, so flag a
  // reload (handled in App) to pick up window.ethereum when the user returns.
  const onDesktopAdd = () => sessionStorage.setItem('vibe-mm-installing', '1')

  // Mobile: let the native href tap open MetaMask's in-app browser (or Branch's
  // store redirect). If we're still on the page after a grace period, neither
  // happened — send the user to the platform store ourselves.
  const onMobileAdd = () => {
    let timer: number
    const cancel = () => window.clearTimeout(timer)
    document.addEventListener('visibilitychange', cancel, { once: true })
    window.addEventListener('pagehide', cancel, { once: true })
    timer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') window.location.href = mobileStoreUrl(ua)
    }, 2500)
  }

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
          href={href}
          // Mobile must stay in the same tab so the universal link reaches the app.
          target={mobile ? undefined : '_blank'}
          rel="noreferrer"
          onClick={mobile ? onMobileAdd : onDesktopAdd}
        >
          Add MetaMask
        </a>
      </div>
    </div>
  )
}
