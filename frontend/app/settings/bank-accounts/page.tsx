function WalletIcon() {
  return (
    <svg width="40" height="40" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M216,64H56a8,8,0,0,1,0-16H192a8,8,0,0,0,0-16H56A24,24,0,0,0,32,56V184a24,24,0,0,0,24,24H216a16,16,0,0,0,16-16V80A16,16,0,0,0,216,64Zm0,128H56a8,8,0,0,1-8-8V78.63A23.84,23.84,0,0,0,56,80H216Zm-48-60a12,12,0,1,1,12,12A12,12,0,0,1,168,132Z" />
    </svg>
  );
}

export default function BankAccountsPage() {
  return (
    <div className="settings-page">
      <h1 className="settings-page-title">Bank Accounts</h1>
      <div className="sb-empty">
        <WalletIcon />
        <h3>Wire Transfers Not Available</h3>
        <p>
          You&apos;re not currently eligible for wire transfers. Please contact support if you believe this is an
          error.
        </p>
      </div>
    </div>
  );
}
