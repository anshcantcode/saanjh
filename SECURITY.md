# Security policy

Saanjh handles voice samples, generated speech, private reflections, and AI conversation context. Treat authentication bypasses, unintended retention, cross-user access, consent bypasses, identity misrepresentation, prompt injection across user boundaries, and profile-deletion failures as security issues.

## Reporting

Do not include voice samples, API keys, private server addresses, journal content, chat history, or other sensitive data in a public issue.

If GitHub private vulnerability reporting is enabled for the repository, use **Security → Report a vulnerability**. Otherwise contact the repository owner privately and include only the minimum reproduction information needed. The maintainer can request sanitized logs through a private channel.

## Supported status

The current codebase is a hackathon/wellness prototype. It has not completed a production security or clinical safety audit. Only the latest source revision is considered for fixes.

## Deployment rules

- Never commit `backend/.env` or a Groq key.
- Never expose Voicebox port `17493` directly to the internet.
- Never publish an APK containing a long-lived shared bearer token.
- Rotate a token immediately if it appears in source, logs, screenshots, chat, or build artifacts.
- Use HTTPS, strict CORS, rate limits, per-device credentials, revocation, and encrypted storage before public deployment.
- Keep access logs free of query-string credentials and sensitive prompt/audio content.
