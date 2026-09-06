"""SMTP helper used by Notifications side-effects."""

from __future__ import annotations

import logging
import smtplib
import time
from email.message import EmailMessage

from app.config import get_settings

logger = logging.getLogger(__name__)


def send_mail(to: str, subject: str, body: str, *, retries: int = 3) -> tuple[str, str]:
    settings = get_settings()
    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    last_err = ""
    attempts = max(1, retries)
    for attempt in range(1, attempts + 1):
        try:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
                smtp.ehlo()
                smtp.send_message(msg)
            return "Sent", ""
        except Exception as exc:  # noqa: BLE001
            last_err = str(exc)
            logger.warning("SMTP attempt %s/%s failed: %s", attempt, attempts, exc)
            if attempt < attempts:
                time.sleep(0.4 * attempt)
    return "Failed", last_err
