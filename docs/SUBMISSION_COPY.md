# Hackathon submission copy

## Project name

Saanjh

## Description

Saanjh is a consent-first AI voice companion designed for grounding, reflection, and feeling less alone—without pretending to be or replace a real person. Users create a companion from real input, establish whether the sample is their own voice, a living person's explicitly consented voice, or a memorial voice, and record or import a real sample.

Each turn follows a working pipeline: recorded speech → Voicebox transcription → a safety-prompted Groq response → Voicebox cloned speech. Every generated voice is clearly identified as AI, and the app never seeds fake companions, memories, journals, conversations, or fallback replies.

Built with Expo, React Native, TypeScript, and a FastAPI gateway, Saanjh keeps companion settings, conversations, mood check-ins, journals, session history, and downloaded audio on the Android device. It also includes before-and-after check-ins, journaling, aftercare, distress routing, and full-screen forest-themed relaxation rituals with gesture-based gameplay, soothing sounds, haptics, progress, and reduced-motion support. Saanjh is a wellness prototype—not a clinician, emergency service, or replacement for human relationships.

## Links

- GitHub: add after creating the public repository.
- Live app: leave blank unless a real public client is deployed.
- Demo video: https://youtu.be/WlnimyM8QmA?si=UtG9H33SnZdt1iEF
- Presentation: add the GitHub Pages URL produced by `.github/workflows/pages-showcase.yml`.

Do not use the raw FastAPI/Tailscale address as the live link; it is private infrastructure, not a public-facing project page.

## Tags

Expo, React Native, TypeScript, React, FastAPI, Python, Groq, Voicebox, Voice AI, Voice Cloning, Speech-to-Text, Text-to-Speech, Local-First, Android, Mental Wellness

## Tracks

Select only **Expo Track — Build Mobile Apps With Expo**.

Do not select Neo4j, Base44, Sarvam, or Render Workflows because the current project does not use them.

## Themes

Select:

- Human Experience & Productivity
- HealthTech & Bio Platforms

Optional third theme: Media, Social & Interactive Platforms.

## Additional project links

After publishing a reviewed APK through GitHub Releases, add:

```text
https://github.com/<YOUR_GITHUB_USERNAME>/saanjh/releases/latest
```

Otherwise leave this field blank.

## How Expo was used

Saanjh's Android client is built with Expo SDK 57, React Native, and TypeScript. Expo Audio handles real microphone recording, voice-sample capture, and generated-voice playback. Expo Document Picker lets users import their own audio samples, while Expo FileSystem persists selected media and downloads generated audio for local playback. Expo SecureStore protects private connection settings, and AsyncStorage keeps the user's companion configuration, conversations, moods, journals, and session history on the device.

Expo Haptics and Audio power responsive feedback and soothing sound design inside the relaxation rituals. Expo Linear Gradient, Blur, Asset, Splash Screen, Status Bar, and Expo Google Fonts support the forest-inspired visual system. React Native Animated and SVG create full-screen interactive experiences such as physics-guided floating leaves, accuracy-based sand tracing, constellation paths, firefly collection, breathing cycles, and progressive forest colouring.

The project includes Android permissions and EAS preview/production profiles for installable APK and Play-ready AAB builds. The Expo app communicates with a FastAPI gateway over HTTPS, while Groq credentials and the private Voicebox connection stay on the server. This lets the Android client work across networks while personal application data remains local and the app starts empty instead of relying on seeded demo content.

## AuraDB question

Leave blank. If the form requires text:

> Not used in this project. Saanjh uses phone-local storage for the Android experience and SQLite for the separate web/backend prototype.

## Base44 question

Leave blank. If the form requires text:

> Not used. Saanjh was built directly with Expo, React Native, TypeScript, FastAPI, Groq, and Voicebox.

## Sarvam question and social links

Leave both blank. If the explanation field requires text:

> Not used. Conversational responses use Groq, while speech transcription and cloned-voice synthesis use the open-source Voicebox service.

## Render Workflows question and social links

Leave both blank. If the explanation field requires text:

> Not used. The current prototype uses an Expo Android client, a FastAPI gateway, Groq, and a privately hosted Voicebox service.
