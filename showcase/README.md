# Saanjh cinematic showcase

A scroll-driven presentation that moves from pre-dawn through sunrise, daylight, golden hour, and sunset while telling Saanjh's product and safety story.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Build

```bash
npm run build
npm run preview
```

The production output is written to `showcase/dist` and includes the shared real Saanjh artwork from `web/public/assets`.

## Experience architecture

- A fixed layered 2.5D scene provides sky, moving sun, mountains, mist, forest, foliage, grain, and particles.
- Natural document scrolling drives the time of day and environment.
- The opening uses four foliage layers that move apart during the first portion of the scroll.
- Semantic HTML story chapters remain readable without animation.
- IntersectionObserver handles restrained editorial reveals.
- The phone visuals are HTML/CSS compositions using the real Saanjh botanical emblem and product copy.
- `prefers-reduced-motion` removes continuous animation and keeps all content accessible.

## Current asset sources

- `web/public/assets/botanical-emblem.webp`
- Existing Saanjh brand copy and product boundaries from the repository documentation
- Procedural SVG foliage, CSS mountains, mist, sun, particles, and listening emblem created specifically for this presentation

## Next visual refinement pass

The architecture is intentionally ready for replacement of procedural scene layers with final transparent high-resolution foliage and panoramic environment renders, without changing the story or scroll system.
