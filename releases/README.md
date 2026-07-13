# Android release artifacts

APK files are intentionally ignored by Git. Publish reviewed binaries through GitHub Releases or EAS rather than committing them to the repository.

Before sharing a build:

1. run `npm run check`;
2. confirm the build contains no production Groq key;
3. confirm any private-demo bootstrap token is short-lived and rotated after the event;
4. record the application ID, version code/name, build profile, commit SHA, and SHA-256 checksum in the release notes;
5. install the exact artifact on a clean Android device and test consent, cloning, transcription, generated audio, deletion, and offline/error states.

Private testing APK:

```powershell
npm run android:build:preview
```

Store-distribution AAB:

```powershell
npm run android:build:production
```

Do not upload an older local APK simply because it still connects: a compiled shared token or obsolete backend address can remain readable inside that binary even after the source is cleaned.
