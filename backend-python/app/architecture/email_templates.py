"""Transactional email bodies (architecture delivery helpers; domain stays pure)."""

from __future__ import annotations


def _size_label(account_size: float) -> str:
    if account_size >= 1000:
        return f"${account_size / 1000:g}k"
    return f"${account_size:g}"


def _platform_label(platform: str) -> str:
    p = (platform or "mt5").lower()
    return {"mt5": "MetaTrader 5", "matchtrader": "Match-Trader", "ctrader": "cTrader"}.get(p, platform)


def purchase_invoice_and_credentials(
    *,
    display_name: str,
    order_id: str,
    sku: str,
    price: float,
    account_size: float,
    platform: str,
    server: str,
    login: str,
    password: str,
    challenge_id: str,
    paid_at: str,
) -> tuple[str, str]:
    label = _platform_label(platform)
    size = _size_label(account_size)
    subject = f"Invoice & {label} credentials - {sku}"
    body = "\n".join(
        [
            f"Hi {display_name or 'trader'},",
            "",
            "Thank you - your challenge purchase is confirmed.",
            "",
            "-- Invoice --",
            f"Order ID:     {order_id}",
            f"SKU:          {sku}",
            f"Account size: {size}",
            f"Amount paid:  ${price:.2f}",
            f"Paid at:      {paid_at}",
            f"Challenge ID: {challenge_id}",
            "",
            "-- Trading credentials --",
            f"Platform: {label}",
            f"Server:   {server}",
            f"Login:    {login}",
            f"Password: {password}",
            f"Balance:  {size}",
            "",
            f'Open {label}, connect to server "{server}", then sign in with the login and password above.',
            "",
            f"View your challenge: http://localhost:3100/challenges/{challenge_id}",
            "",
            "- PropFirm (demo)",
        ]
    )
    return subject, body


def account_breach(
    *,
    display_name: str,
    challenge_id: str,
    sku: str,
    rule: str,
    reason: str,
    login: str | None,
    equity: float | None,
) -> tuple[str, str]:
    subject = f"Account breached - {rule} ({sku})"
    lines = [
        f"Hi {display_name or 'trader'},",
        "",
        "Your challenge account has been BREACHED and is now locked.",
        "",
        f"Challenge ID: {challenge_id}",
        f"SKU:          {sku}",
        f"Breach rule:  {rule}",
        f"Reason:       {reason}",
    ]
    if login:
        lines.append(f"Login:        {login}")
    if equity is not None:
        lines.append(f"Equity:       ${equity:.2f}")
    lines.extend(
        [
            "",
            "Trading is disabled on this account. Open the challenge page for details:",
            f"http://localhost:3100/challenges/{challenge_id}",
            "",
            "- PropFirm Risk (demo)",
        ]
    )
    return subject, "\n".join(lines)


def vps_invoice_request(
    *,
    display_name: str,
    payout_id: str,
    amount: float,
    risk_summary: str,
    last_ip: str | None,
) -> tuple[str, str]:
    subject = f"Action required: VPS invoice for payout {payout_id[:8]}"
    body = "\n".join(
        [
            f"Hi {display_name or 'trader'},",
            "",
            "We detected an IP / connection policy issue on your recent login while reviewing your payout.",
            "",
            f"Payout ID: {payout_id}",
            f"Amount:    ${amount:.2f}",
            f"Last IP:   {last_ip or 'unknown'}",
            f"Finding:   {risk_summary}",
            "",
            "Please reply with a VPS invoice (provider receipt) that matches your trading connection.",
            "Payout approval is on hold until compliance receives the invoice.",
            "",
            "- PropFirm Compliance (demo)",
        ]
    )
    return subject, body


def payout_admin_comment(
    *,
    display_name: str,
    payout_id: str,
    amount: float,
    status: str,
    subject: str,
    message: str,
) -> tuple[str, str]:
    subj = (subject or "").strip() or f"Message about your payout {payout_id[:8]}"
    body = "\n".join(
        [
            f"Hi {display_name or 'trader'},",
            "",
            "You have a message from PropFirm compliance regarding your payout request.",
            "",
            f"Payout ID: {payout_id}",
            f"Amount:    ${amount:.2f}",
            f"Status:    {status}",
            "",
            "Message:",
            message.strip(),
            "",
            "- PropFirm Compliance (demo)",
        ]
    )
    return subj, body


def payout_approved_reward_sent(
    *,
    display_name: str,
    amount: float,
    method: str,
    crypto_network: str | None,
    crypto_address: str | None,
    payout_id: str,
    wallet_balance_after: float,
) -> tuple[str, str]:
    subject = f"Payout approved - ${amount:.2f} sent to your wallet"
    lines = [
        f"Hi {display_name or 'trader'},",
        "",
        "Your payout was approved. The reward has been sent to your payout wallet destination.",
        "",
        f"Payout ID:     {payout_id}",
        f"Amount:        ${amount:.2f}",
        f"Method:        {method}",
    ]
    if crypto_network:
        lines.append(f"Network:       {crypto_network}")
    if crypto_address:
        lines.append(f"Destination:   {crypto_address}")
    lines.extend(
        [
            f"Rewards ledger balance after debit: ${wallet_balance_after:.2f}",
            "",
            "In this demo, crypto settlement is simulated (funds marked sent to the address above).",
            "",
            "- PropFirm Payouts (demo)",
        ]
    )
    return subject, "\n".join(lines)
