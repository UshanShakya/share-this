# Project Overview — SharedCanvas

## Vision

SharedCanvas is a real-time collaborative drawing app built with Expo. Two or more people join a named room and draw on the same canvas simultaneously. The killer feature is a **home-screen widget** that displays the latest canvas state and updates live as collaborators draw.

---

## Core Features

### MVP (Phase 1–3)
- Room creation and invite by username or share link
- Real-time shared canvas (draw, erase, color picker, stroke width)
- Persistent canvas state stored server-side
- Auth (email/password + optional OAuth)

### Phase 4
- Home-screen widget (iOS & Android) showing the live canvas
- Widget taps deep-link into the app

### Phase 5+
- Canvas layers
- Image/sticker inserts
- Reaction stamps
- Push notifications on new strokes

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Mobile framework | Expo SDK 51 (managed workflow) | Cross-platform, OTA updates |
| Language | TypeScript | Type safety across all layers |
| Real-time | Supabase Realtime (WebSocket) | Managed Postgres + presence |
| Auth | Supabase Auth | Integrates with DB row-level security |
| Database | Supabase Postgres | Rooms, users, canvas snapshots |
| Canvas rendering | `react-native-skia` | GPU-accelerated, smooth strokes |
| Widget (iOS) | `expo-widgets` / Swift WidgetKit | Native widget API |
| Widget (Android) | `expo-widgets` / Glance (Kotlin) | Modern Android widget API |
| State management | Zustand | Lightweight, no boilerplate |
| Navigation | Expo Router (file-based) | Native stack + deep links |

---

## High-Level Architecture

```
┌─────────────────────────────────────────┐
│              Expo App                   │
│  ┌──────────┐  ┌───────────────────┐   │
│  │  Screens │  │  Canvas Engine    │   │
│  │  (Router)│  │  (react-native-   │   │
│  └────┬─────┘  │   skia)           │   │
│       │        └────────┬──────────┘   │
│  ┌────▼──────────────────▼──────────┐  │
│  │        Zustand Store              │  │
│  └────────────────┬──────────────────┘  │
│                   │                     │
│  ┌────────────────▼──────────────────┐  │
│  │   Supabase Client (realtime +     │  │
│  │   auth + database)                │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Home-Screen Widget               │  │
│  │  (reads cached snapshot via       │  │
│  │   shared App Group / SharedPrefs) │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                   │
       ┌───────────▼───────────┐
       │   Supabase Cloud      │
       │  Postgres + Realtime  │
       │  Storage (snapshots)  │
       └───────────────────────┘
```

---

## Key Constraints

- Widget cannot make WebSocket connections; it reads from a local snapshot file written by the main app.
- Strokes are streamed as lightweight delta events (path segments), not full canvas re-renders.
- Canvas snapshots (PNG) are written to shared storage every ~5 seconds for the widget to consume.
- The app must handle offline gracefully — queue strokes locally and sync on reconnect.

---

## Milestones

| Phase | Goal | Target |
|---|---|---|
| 1 | Project scaffold + auth | Week 1 |
| 2 | Room management | Week 2 |
| 3 | Real-time canvas | Weeks 3–4 |
| 4 | Home-screen widget | Weeks 5–6 |
| 5 | Polish + notifications | Week 7 |
| 6 | Beta release | Week 8 |
