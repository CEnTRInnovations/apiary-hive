import hmac

from fastapi import Header

from config import settings


def is_owner_request(x_owner_token: str | None = Header(default=None)) -> bool:
    """FastAPI dependency. True only if the request carries an X-Owner-Token header
    matching this deployment's OWNER_ACCESS_TOKEN. Used to gate the server-side default
    LLM provider (DO Inference / LM Studio) so it's available to the deployment operator
    only — everyone else must bring their own endpoint via the Settings panel.

    If OWNER_ACCESS_TOKEN isn't set server-side, the gate is disabled (always False),
    since there's nothing to compare against — the deployment then behaves as BYOM-only
    for the default-provider fallback, same as if no default were configured.
    """
    if not settings.owner_access_token or not x_owner_token:
        return False
    return hmac.compare_digest(x_owner_token, settings.owner_access_token)
