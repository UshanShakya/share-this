# UI/UX Plan — SharedCanvas

---

## Design Principles

1. **Canvas first** — the drawing surface is the product. Every other UI element should get out of its way.
2. **Minimal chrome** — toolbars auto-hide while drawing; a single tap restores them.
3. **Presence without distraction** — show who's online and where they're drawing without interrupting focus.
4. **Instant feedback** — strokes appear at 60 fps locally before being confirmed by the server.
5. **Widget as window** — the home-screen widget should feel like a live portal into the shared space, not a static screenshot.

---

## Color & Typography

### Color Palette

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `--bg-primary` | `#FFFFFF` | `#111111` | App background, canvas bg |
| `--bg-surface` | `#F5F5F5` | `#1E1E1E` | Cards, sheets, toolbars |
| `--bg-elevated` | `#EBEBEB` | `#2A2A2A` | Modals, popovers |
| `--text-primary` | `#111111` | `#F5F5F5` | Body text, labels |
| `--text-secondary` | `#666666` | `#999999` | Captions, hints |
| `--accent` | `#5B5BD6` | `#7C7CF0` | CTAs, active states, cursor rings |
| `--destructive` | `#E5484D` | `#F16063` | Delete, leave room |
| `--border` | `#E0E0E0` | `#333333` | Dividers, input borders |

### Typography

| Style | Font | Size | Weight | Usage |
|---|---|---|---|---|
| Display | System (SF Pro / Roboto) | 28 | 700 | Room name on canvas screen |
| Title | System | 20 | 600 | Screen headers |
| Body | System | 16 | 400 | Lists, descriptions |
| Caption | System | 13 | 400 | Member names, timestamps |
| Mono | System Mono | 13 | 400 | Room IDs, invite codes |

---

## Screen Inventory

### 1. Login / Register
**Goal:** Get users in as fast as possible.

Layout: full-screen centered card with logo at top.

- Email input + password input
- Primary CTA: "Continue" (auto-detects login vs register on first use, or toggle)
- Divider + "Continue with Google" (OAuth, Phase 2+)
- No decorative illustration — keep it clean

**States:** default → loading (spinner on CTA) → error (inline under field)

---

### 2. Home — Room List (`rooms/index.tsx`)
**Goal:** See all shared canvases at a glance and jump in quickly.

Layout: vertical scroll list of `RoomCard` components with a FAB (+) in the bottom-right.

**RoomCard anatomy:**
```
┌─────────────────────────────────┐
│  [Canvas thumbnail 80×60]  Room name        ›  │
│                            3 members • 2m ago  │
│                            ● ● ○  (avatars)    │
└─────────────────────────────────┘
```
- Thumbnail is a low-res cached snapshot of the canvas
- Green dot = member is currently online
- Tap → canvas screen; long-press → action sheet (rename, invite, leave, delete)

**Empty state:** Illustration of two hands reaching toward a canvas + "Create your first room" CTA.

---

### 3. Create Room Modal (`rooms/new.tsx`)
**Goal:** Create a named room and optionally invite someone immediately.

Layout: bottom sheet (60% screen height), draggable to dismiss.

Fields:
- Room name (required, max 40 chars)
- Invite collaborators — username search with chip-style selection
- "Create Room" primary button

Closes and navigates directly into the new canvas on success.

---

### 4. Canvas Screen (`rooms/[roomId]/canvas.tsx`) ★ Core Screen

**Goal:** Draw together. Everything else is secondary.

#### Layout States

**Drawing mode (toolbar hidden after 2s of inactivity):**
```
┌─────────────────────────────────────────┐
│ ← (tap to show toolbar)    [AvatarStack]│
│                                         │
│           CANVAS SURFACE                │
│                                         │
│                                         │
│                                         │
└─────────────────────────────────────────┘
```

**Toolbar visible (tap anywhere on canvas, or tap top bar):**
```
┌─────────────────────────────────────────┐
│ ← Room name          ● Ana  ● Ben  + 1  │  ← top bar
├─────────────────────────────────────────┤
│           CANVAS SURFACE                │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│ 🖊 pencil  ⬜ eraser  ↩ undo  🗑 clear  │  ← bottom toolbar
│ [color swatch row]   ━ ━━ ━━━ (width)  │
└─────────────────────────────────────────┘
```

#### Canvas Surface Details
- White (light) / dark grey (dark mode) background
- Remote collaborator cursors shown as a small coloured circle with initial label
- Cursor rings fade out 3s after a remote user stops drawing
- Own strokes appear immediately (optimistic); remote strokes fade in slightly

#### Bottom Toolbar
- **Tool row:** Pencil (default) | Eraser | Undo | Clear All
- **Color row:** 8 preset swatches + custom (opens system color picker)
- **Width row:** 3 presets (thin/medium/thick) + a slider for fine-tuning

#### Top Bar
- Back arrow (← with room name) on the left
- AvatarStack on the right — tapping opens `members.tsx` sheet

---

### 5. Members Sheet (`rooms/[roomId]/members.tsx`)
Layout: bottom sheet, ~50% height.

- Header: Room name + room ID (monospace, copyable)
- Member list: avatar + display name + "online/offline" indicator
- "Invite" button → opens `InviteSheet.tsx`
- Swipe-left on member → "Remove" (owner only)

---

### 6. Invite Sheet (`InviteSheet.tsx`)
Two tabs:
1. **Username search** — type to search users, tap to select, "Send Invite" sends a notification
2. **Share Link** — generated deep link with copy + native share sheet button

---

### 7. Profile Screen (`profile.tsx`)
- Avatar (tap to change)
- Display name (editable)
- Email (read-only)
- "Sign out" at the bottom

---

### 8. Home-Screen Widget

**Small (2×2):**
```
┌──────────────────┐
│  [Canvas crop]   │
│  Room name       │
│  ● 2 online      │
└──────────────────┘
```

**Medium (4×2):**
```
┌────────────────────────────────────┐
│       [Canvas snapshot — wider]    │
│  Room name            ● 2 online   │
└────────────────────────────────────┘
```

- Tapping the widget deep-links directly into that room's canvas
- Snapshot updates every ~5 seconds when the app is in the foreground; falls back to last snapshot when app is backgrounded
- Widget background matches canvas background (white / dark)

---

## Navigation Map

```
                    ┌──────────────────┐
                    │   Widget (tap)   │
                    └────────┬─────────┘
                             │ deep link
(auth)/login  ──────────────►│
(auth)/register ────────────►│
                             ▼
                    (app)/index (room list)
                       │           │
              tap room │           │ FAB (+)
                       ▼           ▼
            rooms/[roomId]/   rooms/new.tsx
               canvas.tsx      (modal)
                  │
          tap AvatarStack
                  │
                  ▼
            members.tsx (sheet)
                  │
            tap Invite
                  │
                  ▼
            InviteSheet.tsx (sheet)
```

---

## Motion & Interaction

| Interaction | Animation |
|---|---|
| Screen navigation | Native stack slide (Expo Router default) |
| Bottom sheet open | Spring up, 350ms |
| Toolbar appear/hide | Fade + translate-Y 8px, 200ms |
| Remote cursor move | Animated position, 100ms lerp |
| Remote stroke appear | Instant (real-time feel) |
| Undo stroke | Fade out removed stroke, 150ms |
| RoomCard tap | Scale 0.97 on press, spring release |
| Widget update | System-handled (WidgetKit/Glance) |

---

## Accessibility

- All interactive elements meet 44×44 pt minimum touch target
- Color picker includes a hex input for users who can't distinguish swatches
- Canvas strokes use `accessibilityLabel` describing last action (e.g. "Drew a red line")
- Bottom sheet is focus-trapped for keyboard/switch-control navigation
- VoiceOver: toolbar buttons have descriptive labels ("Pencil tool, selected")
