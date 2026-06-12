# Progress Tracker — SharedCanvas

> Update this file at the end of every work session. Move tasks between sections as they progress.
> Format: `- [ ] task` → `- [~] task` (in-progress) → `- [x] task` (done)

---

## ✅ Completed

### Phase 1 — Project Scaffold & Auth

- [x] **1.1** Initialise Expo project with TypeScript template (`npx create-expo-app`)
- [x] **1.2** Configure Expo Router (file-based routing, root `_layout.tsx`)
- [x] **1.3** Set up Supabase project (cloud) and run `supabase init` locally
- [x] **1.4** Add `.env.local` with `SUPABASE_URL` and `SUPABASE_ANON_KEY`; configure `app.config.ts` to read them
- [x] **1.5** Create `src/lib/supabaseClient.ts` singleton
- [x] **1.6** Set up Zustand; create `src/store/authStore.ts` (session, user)
- [x] **1.7** Build `(auth)/register.tsx` screen (email + password)
- [x] **1.8** Build `(auth)/login.tsx` screen
- [x] **1.9** Implement auth guard in `app/_layout.tsx` — redirect unauthenticated users to login
- [x] **1.10** Create `useAuth.ts` hook wrapping authStore
- [x] **1.11** Write Supabase migration `001_users.sql` (profiles table)
- [x] **1.12** Add `profile.tsx` screen (display name, avatar upload)

### Phase 2 — Room Management

- [x] **2.1** Write Supabase migration `002_rooms.sql` (rooms + members tables, RLS policies)
- [x] **2.2** Create `src/store/roomStore.ts`
- [x] **2.3** Build `rooms/index.tsx` — list of rooms the current user belongs to
- [x] **2.4** Build `rooms/new.tsx` modal — create a named room
- [x] **2.5** Build `RoomCard.tsx` component
- [x] **2.6** Implement invite by username (search users, add to room)
- [x] **2.7** Implement shareable invite link (deep link into `rooms/[roomId]/canvas`)
- [x] **2.8** Build `members.tsx` — view and remove room members
- [x] **2.9** Build `InviteSheet.tsx` bottom sheet component
- [x] **2.10** Add leave-room and delete-room actions

### Phase 3 — Real-Time Canvas

- [x] **3.1** Install and configure `@shopify/react-native-skia` library
- [x] **3.2** Write Supabase migration `007_strokes.sql` (strokes table with roomId, userId, path data)
- [x] **3.3** Create TypeScript interfaces in `src/types/canvas.ts` (Point, Stroke, CanvasState)
- [x] **3.4** Create `src/store/canvasStore.ts` (strokes array, current tool, undo stack)
- [x] **3.5** Build basic `Canvas.tsx` — render strokes from store using Skia `Path`
- [x] **3.6** Implement touch input → stroke recording in `Canvas.tsx`
- [x] **3.7** Create `src/lib/realtime.ts` — Supabase Realtime channel per room
- [x] **3.8** Broadcast new stroke segments over the channel (delta, not full canvas)
- [x] **3.9** Subscribe to remote strokes and apply to canvasStore
- [x] **3.10** Fetch full stroke history on room join (hydrate canvasStore)
- [x] **3.11** Build `StrokeToolbar.tsx` — color picker, quick sizes, eraser toggle
- [x] **3.12** Implement undo (local + DB) and clear canvas (broadcast + DB)
- [x] **3.13** Create `useCanvas.ts` hook
- [x] **3.14** Add `AvatarStack.tsx` showing online members via Supabase Presence
- [x] **3.15** Handle offline gracefully — queue strokes locally, save to DB in async background promises
- [x] **3.16** Performance pass — touch moving coordinates distance-threshold (2px) filtering to reduce event payload sizes
- [x] **3.17** Refactor Undo/Redo system into a unified command execution architecture supporting batching, move object, and edit text
- [x] **3.18** Implement geometric segment splitting (pixel eraser) to slice lines on drag intersection
- [x] **3.19** Integrate Redo button control into `StrokeToolbar` and link with command history stack
- [x] **3.20** Resolve Reanimated `.value` component render warning and TextInput crash by refactoring `<ActiveTextInput>` into a standard static layout
- [x] **3.21** Capture scale/pan snapshots on touch event to drive static rendering coordinates, resolving invisible text and focus issues
- [x] **3.22** Implement a dynamic floating Zoom Indicator on the side of the page (driven on the UI thread via `useAnimatedProps`)
- [x] **3.23** Add tool-change auto-commit and dismissal logic to automatically save and unmount text drafts when switching tools

---

## 🔄 In Progress

_Nothing currently in progress._

---

## 📋 To Do


---

### Phase 4 — Home-Screen Widget

- [x] **4.1** Research and install `expo-widgets` (using native targets and custom plugins config instead)
- [x] **4.2** Create `src/lib/snapshotWriter.ts` (N/A - dynamically rendering vector strokes in native widgets instead of static PNG)
- [x] **4.3** Create `useSnapshot.ts` hook (N/A - dynamically rendering vector strokes in native widgets instead of static PNG)
- [x] **4.4** Configure iOS App Group in Xcode for shared file container
- [x] **4.5** Write `widget/ios/CanvasWidget.swift` — SwiftUI view rendering vector strokes
- [x] **4.6** Write `widget/ios/WidgetBundle.swift` — register widget target
- [x] **4.7** Configure Android shared file path (using filesDir for shared storage)
- [x] **4.8** Write `widget/android/CanvasWidget.kt` (N/A - implemented RemoteViews AppWidget for compilation stability and performance)
- [x] **4.9** Write `widget/android/WidgetReceiver.kt` — handles update broadcasts and native vector rendering
- [x] **4.10** Deep link from widget tap → correct room canvas in app
- [x] **4.11** Widget size options (small 2×2, medium 4×2) with appropriate scale
- [x] **4.12** Test widget refresh rate and battery impact; manual sync button provided for instant updates

---

### Phase 5 — Polish & Notifications

- [x] **5.1** Real-time in-app notifications (Supabase Realtime + bell icon badge dropdown list)
- [x] **5.2** Notification triggers for friend requests, canvas invites, room renaming, and canvas stroke additions (debounced)
- [x] **5.3** Premium avatar presets selection grid (12 choices) in settings screen
- [x] **5.4** Auto-default avatar creation on database triggers (public.handle_new_user)
- [x] **5.5** Empty list pull-to-refresh fix for friends list and request logs using ListEmptyComponent
- [ ] **5.6** Canvas layers (add, reorder, hide)
- [ ] **5.7** Image insert — pick from photo library, place on canvas
- [ ] **5.8** Reaction stamps (emoji overlays with animation)
- [ ] **5.9** Dark mode support across all screens
- [ ] **5.10** Accessibility audit (VoiceOver / TalkBack on toolbar)
- [ ] **5.11** Haptic feedback on stroke start/end
- [ ] **5.12** Error boundary and fallback UI for canvas failures
- [ ] **5.13** Loading skeletons for room list and canvas hydration

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
