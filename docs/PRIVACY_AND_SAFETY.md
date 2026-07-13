# Privacy, consent, and safety boundaries

Saanjh is designed as an AI companion, not as a simulation that claims to literally be another person.

## Identity and consent

- The app records whether the sample is the user's own voice, a living person's consented voice, or a memorial voice.
- Living-person cloning requires an explicit consent note.
- Memorial use is labeled as an AI memorial/comfort voice.
- Every companion requires an AI disclosure acknowledgement.
- Generated sessions visibly state that the voice is AI-generated and not the real person.
- Deleting a companion attempts to delete the Voicebox profile before clearing the local companion record.

## Wellness guardrails

The Groq system prompt uses only stored, user-approved companion fields. It instructs the model to avoid pretending to be the real person, inventing shared memories, diagnosing, encouraging dependency, or discouraging real human relationships.

The app does not use streak pressure or guilt for leaving. Aftercare can be skipped. Distress language routes to direct real-world support guidance rather than continuing the companion fantasy.

## Local-first does not mean offline-only

Android personal records remain on the device, but an AI or voice request necessarily sends selected data for processing:

- Groq receives the current message, a bounded amount of conversation history, and consented companion context.
- Voicebox receives audio for transcription and retains a cloned profile/sample for speech generation.
- FastAPI proxies those requests and does not persist local-first chat turns in its database.

Review the privacy and retention terms of every hosted service before entering sensitive information.

## Prototype limitations

- AsyncStorage and the prototype SQLite database are not claimed to provide production-grade encryption at rest.
- A shared bearer token is only suitable for a private demo and is extractable if compiled into an APK.
- The current PC-hosted Voicebox deployment is unavailable when that PC or GPU service is offline.
- Saanjh is not a medical device, emergency service, clinician, or evidence of a clinical outcome.

Before a public release, add per-device enrolment, short-lived credentials, revocation, rate limits, encrypted profile storage, audit logging that excludes sensitive content, a deletion/retention policy, and professional safety review.
