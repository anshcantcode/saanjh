# Contributing to Saanjh

Thank you for helping improve Saanjh. Changes should preserve its consent-first, clearly-AI, local-first product boundary.

## Development setup

Follow the root [README](README.md), then run:

```powershell
npm run check
```

Before opening a pull request, verify that no `.env`, API key, bearer token, database, recorded sample, generated audio, APK, or personal journal/session data is staged.

## Change expectations

- Keep TypeScript strict and avoid `any` where a real API shape is available.
- Add or update backend tests for API behavior and error contracts.
- Preserve reduced-motion behavior and accessible labels for interactive UI.
- Do not seed fake personal data into production paths.
- Keep Groq and Voicebox secrets server-side.
- Prefer stable, user-readable error messages backed by structured server codes.
- Optimize new raster assets before adding them to web or showcase bundles.

## Safety-sensitive changes

Changes involving voice cloning, consent evidence, memorial mode, identity wording, crisis handling, dependency language, authentication, data retention, or deletion require a dedicated safety note in the pull request explaining:

1. what user harm is possible;
2. what boundary prevents it;
3. how failure is communicated;
4. what is stored, transmitted, and deleted;
5. which tests cover the boundary.

## Pull request checklist

- [ ] `npm run check` passes.
- [ ] No secret or personal data is committed.
- [ ] Setup/documentation reflects any new environment variable or service.
- [ ] Mobile and desktop layouts were checked when UI changed.
- [ ] Reduced-motion and error states were checked.
- [ ] Consent and AI disclosures remain visible where relevant.
