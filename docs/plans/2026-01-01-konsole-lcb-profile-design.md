# Konsole LCB Profile Design

## Goal
Improve the Konsole profile starting with "LCB" so it provides an LLM-friendly coding experience without changing global Konsole defaults.

## Context
The user already created a Konsole profile that starts with the letters "LCB". The desired configuration should be general purpose (not repo-specific) and should add ergonomic defaults for LLM-assisted coding.

## Requirements
- Modify only the LCB profile file in the user's Konsole profile directory.
- Prefer safe, predictable defaults (no heavy auto-start commands).
- Keep settings profile-local; avoid global Konsole changes.
- Avoid hard-coded project paths.

## Proposed Configuration
- Font: use a coding-friendly font (JetBrains Mono Nerd Font if available), with a comfortable size.
- Color scheme: use a high-contrast, calm scheme suitable for long coding sessions.
- Scrollback: increase to a large value for prompt and LLM output history.
- Tab title: include session and working directory for quick context.
- Environment: set profile-local variables that improve pager and color output for tooling.

## Implementation Notes
- Locate profile in `~/.local/share/konsole/` by matching the file name or profile name that starts with "LCB".
- If the exact profile name is ambiguous, list candidates and confirm.
- Apply changes only within the target profile file.
- If the specified font is not installed, keep the font entry but allow Konsole to fallback.

## Risks and Mitigations
- Risk: profile not found or multiple matches. Mitigation: confirm the exact file before editing.
- Risk: missing font. Mitigation: allow fallback without breaking profile.

## Verification
- Open Konsole and select the LCB profile.
- Confirm font, color scheme, scrollback depth, and tab title behavior.
- Confirm environment variables are present in a new shell session.
