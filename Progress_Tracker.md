# Progress Tracker — SharedCanvas

> Update this file at the end of every work session. Move tasks between sections as they progress.
> Format: `- [ ] task` → `- [~] task` (in-progress) → `- [x] task` (done)

---

## ✅ Completed

_Nothing completed yet — project is in initial setup._

---

## 🔄 In Progress

### Phase 1 — Project Scaffold & Auth

- [~] **1.1** Initialise Expo project with TypeScript template (`npx create-expo-app`)
- [~] **1.2** Configure Expo Router (file-based routing, root `_layout.tsx`)

---

## 📋 To Do

### Phase 1 — Project Scaffold & Auth

- [ ] **1.3** Set up Supabase project (cloud) and run `supabase init` locally
- [ ] **1.4** Add `.env.local` with `SUPABASE_URL` and `SUPABASE_ANON_KEY`; configure `app.config.ts` to read them
- [ ] **1.5** Create `src/lib/supabaseClient.ts` singleton
- [ ] **1.6** Set up Zustand; create `src/store/authStore.ts` (session, user)
- [ ] **1.7** Build `(auth)/register.tsx` screen (email + password)
- [ ] **1.8** Build `(auth)/login.tsx` screen
- [ ] **1.9** Implement auth guard in `app/_layout.tsx` — redirect unauthenticated users to login
- [ ] **1.10** Create `useAuth.ts` hook wrapping authStore
- [ ] **1.11** Write Supabase migration `001_users.sql` (profiles table)
- [ ] **1.12** Add `profile.tsx` screen (display name, avatar upload)

---

### Phase 2 — Room Management

- [ ] **2.1** Write Supabase migration `002_rooms.sql` (rooms + members tables, RLS policies)
- [ ] **2.2** Create `src/store/roomStore.ts`
- [ ] **2.3** Build `rooms/index.tsx` — list of rooms the current user belongs to
- [ ] **2.4** Build `rooms/new.tsx` modal — create a named room
- [ ] **2.5** Build `RoomCard.tsx` component
- [ ] **2.6** Implement invite by username (search users, add to room)
- [ ] **2.7** Implement shareable invite link (deep link into `rooms/[roomId]/canvas`)
- [ ] **2.8** Build `members.tsx` — view and remove room members
- [ ] **2.9** Build `InviteSheet.tsx` bottom sheet component
- [ ] **2.10** Add leave-room and delete-room actions

---

### Phase 3 — Real-Time Canvas

- [ ] **3.1** Install and configure `react-native-skia`
- [ ] **3.2** Write Supabase migration `003_strokes.sql` (strokes table with roomId, userId, path data)
- [ ] **3.3** Create TypeScript interfaces in `src/types/canvas.ts` (Point, Stroke, CanvasState)
- [ ] **3.4** Create `src/store/canvasStore.ts` (strokes array, current tool, undo stack)
- [ ] **3.5** Build basic `Canvas.tsx` — render strokes from store using Skia `Path`
- [ ] **3.6** Implement touch input → stroke recording in `Canvas.tsx`
- [ ] **3.7** Create `src/lib/realtime.ts` — Supabase Realtime channel per room
- [ ] **3.8** Broadcast new stroke segments over the channel (delta, not full canvas)
- [ ] **3.9** Subscribe to remote strokes and apply to canvasStore
- [ ] **3.10** Fetch full stroke history on room join (hydrate canvasStore)
- [ ] **3.11** Build `StrokeToolbar.tsx` — color picker, stroke width slider, eraser toggle
- [ ] **3.12** Implement undo (local only) and clear canvas (broadcast to all)
- [ ] **3.13** Create `useCanvas.ts` hook
- [ ] **3.14** Add `AvatarStack.tsx` showing online members via Supabase Presence
- [ ] **3.15** Handle offline gracefully — queue strokes locally, sync on reconnect
- [ ] **3.16** Performance pass — stroke simplification (`src/utils/stroke.ts`) to reduce event volume

---

### Phase 4 — Home-Screen Widget

- [ ] **4.1** Research and install `expo-widgets` (or evaluate bare workflow ejection)
- [ ] **4.2** Create `src/lib/snapshotWriter.ts` — render Skia canvas to PNG
- [ ] **4.3** Create `useSnapshot.ts` hook — debounced snapshot on canvas change
- [ ] **4.4** Configure iOS App Group in Xcode for shared file container
- [ ] **4.5** Write `widget/ios/CanvasWidget.swift` — SwiftUI view reading snapshot PNG
- [ ] **4.6** Write `widget/ios/WidgetBundle.swift` — register widget target
- [ ] **4.7** Configure Android shared file path (internal storage or FileProvider)
- [ ] **4.8** Write `widget/android/CanvasWidget.kt` — Glance composable
- [ ] **4.9** Write `widget/android/WidgetReceiver.kt` — handles update broadcasts
- [ ] **4.10** Deep link from widget tap → correct room canvas in app
- [ ] **4.11** Widget size options (small 2×2, medium 4×2) with appropriate crop/scale
- [ ] **4.12** Test widget refresh rate and battery impact; tune snapshot interval

---

### Phase 5 — Polish & Notifications

- [ ] **5.1** Push notifications (Expo Notifications) — alert when a collaborator draws in your room
- [ ] **5.2** Notification preferences (per-room mute)
- [ ] **5.3** Canvas layers (add, reorder, hide)
- [ ] **5.4** Image insert — pick from photo library, place on canvas
- [ ] **5.5** Reaction stamps (emoji overlays with animation)
- [ ] **5.6** Dark mode support across all screens
- [ ] **5.7** Accessibility audit (VoiceOver / TalkBack on toolbar)
- [ ] **5.8** Haptic feedback on stroke start/end
- [ ] **5.9** Error boundary and fallback UI for canvas failures
- [ ] **5.10** Loading skeletons for room list and canvas hydration

---

### Phase 6 — Beta Release

- [ ] **6.1** Configure EAS Build (`eas.json`) — development, preview, production profiles
- [ ] **6.2** Set up EAS Update for OTA patches
- [ ] **6.3** Internal beta via TestFlight (iOS) and Play Console internal track (Android)
- [ ] **6.4** Crash reporting integration (Sentry or Expo's built-in)
- [ ] **6.5** Analytics — room creation funnel, canvas engagement events
- [ ] **6.6** App Store / Play Store metadata, screenshots, privacy policy
- [ ] **6.7** Final security review — Supabase RLS policies, invite link expiry
- [ ] **6.8** Public release

---

## Notes

- Phase 3 is the largest and riskiest phase. De-risk early by getting a single stroke broadcasting between two simulators before building the full toolbar.
- Phase 4 widget work may require ejecting to a bare workflow if `expo-widgets` doesn't cover the needed APIs — evaluate at the start of Phase 4.
- Tasks can be worked in parallel across phases only when there are no blocking dependencies (e.g. Phase 5 dark mode can start during Phase 4).
