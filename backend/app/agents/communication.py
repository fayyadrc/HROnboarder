from __future__ import annotations

# Placeholder for a future Communications Agent (emails/notifications).
# Not used in the 3-agent demo yet.
# Kept to avoid breaking any existing imports later.

def render_welcome_message(candidate_name: str) -> str:
    name = candidate_name or "there"
    return f"Welcome {name}! Please complete your onboarding steps. Your progress is saved automatically."
