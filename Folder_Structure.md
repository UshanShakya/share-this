# Folder Structure — SharedCanvas

```
shared-canvas/
│
├── app/                          # Expo Router screens (file = route)
│   ├── _layout.tsx               # Root layout, auth guard, global providers
│   ├── +not-found.tsx            # 404 fallback
│   │
│   ├── (auth)/                   # Unauthenticated stack
│   │   ├── _layout.tsx           # Auth stack layout (no tab bar)
│   │   ├── login.tsx             # Login screen
│   │   └── register.tsx          # Register screen
│   │
│   └── (app)/                    # Authenticated tab/stack
│       ├── _layout.tsx           # Tab navigator layout
│       ├── index.tsx             # Home / room list
│       ├── profile.tsx           # User profile + settings
│       └── rooms/
│           ├── index.tsx         # All rooms overview
│           ├── new.tsx           # Create room modal
│           └── [roomId]/
│               ├── _layout.tsx   # Room stack layout
│               ├── canvas.tsx    # Main canvas screen ★
│               └── members.tsx   # Room members + invite
│
├── src/                          # All non-screen source code
│   │
│   ├── store/                    # Zustand global state
│   │   ├── authStore.ts          # Session, user profile
│   │   ├── roomStore.ts          # Rooms list, active room
│   │   └── canvasStore.ts        # Strokes, tool state, undo stack
│   │
│   ├── lib/                      # Singleton clients & utilities
│   │   ├── supabaseClient.ts     # Supabase JS client (auth + db)
│   │   ├── realtime.ts           # Supabase Realtime channel helpers
│   │   └── snapshotWriter.ts     # Render canvas → PNG → shared storage
│   │
│   ├── components/               # Reusable UI components
│   │   ├── Canvas.tsx            # react-native-skia drawing surface
│   │   ├── StrokeToolbar.tsx     # Color, width, erase tools
│   │   ├── RoomCard.tsx          # Room list item card
│   │   ├── InviteSheet.tsx       # Bottom sheet for inviting users
│   │   ├── AvatarStack.tsx       # Overlapping avatars of online members
│   │   └── ui/                   # Generic primitives (Button, Input, etc.)
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       └── Sheet.tsx         # Generic bottom sheet wrapper
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.ts            # Auth store selectors + actions
│   │   ├── useRoom.ts            # Room store selectors + actions
│   │   ├── useCanvas.ts          # Canvas store + realtime subscription
│   │   └── useSnapshot.ts        # Debounced snapshot writes for widget
│   │
│   ├── types/                    # Shared TypeScript interfaces
│   │   ├── canvas.ts             # Stroke, Point, Tool, CanvasState
│   │   ├── room.ts               # Room, Member, Invite
│   │   └── user.ts               # User, Session
│   │
│   └── utils/                    # Pure helper functions
│       ├── stroke.ts             # Stroke ID gen, smoothing, simplification
│       ├── color.ts              # Hex ↔ rgba, palette constants
│       └── time.ts               # Timestamp helpers
│
├── widget/                       # Native widget code (ejected modules)
│   ├── ios/
│   │   ├── CanvasWidget.swift    # SwiftUI widget view
│   │   ├── WidgetBundle.swift    # Registers widget with WidgetKit
│   │   └── AppGroup.swift        # Reads PNG from shared App Group container
│   └── android/
│       ├── CanvasWidget.kt       # Glance AppWidget composable
│       ├── WidgetReceiver.kt     # Broadcast receiver for updates
│       └── res/
│           └── xml/
│               └── widget_info.xml # Widget metadata (size, update period)
│
├── supabase/                     # Supabase local config & migrations
│   ├── config.toml               # Local dev config
│   └── migrations/
│       ├── 001_users.sql
│       ├── 002_rooms.sql
│       └── 003_strokes.sql
│
├── assets/                       # Static assets
│   ├── fonts/
│   ├── images/
│   └── icons/
│
├── .env.local                    # SUPABASE_URL, SUPABASE_ANON_KEY (git-ignored)
├── app.json                      # Expo app config
├── app.config.ts                 # Dynamic Expo config (reads .env)
├── eas.json                      # EAS Build profiles
├── tsconfig.json
├── babel.config.js
└── package.json
```

---

## Key Directory Decisions

**Why `src/` instead of top-level?**
Keeps Expo Router's `app/` directory clean — only route files live there. All logic, components, and utilities live in `src/`.

**Why `src/lib/` vs `src/utils/`?**
`lib/` holds singleton instances and side-effectful modules (Supabase client, realtime channel). `utils/` holds pure, stateless functions safe to call anywhere.

**Why `widget/` at the root?**
Widget code is native (Swift/Kotlin) and doesn't benefit from being inside `src/`. It requires a separate Xcode target / Android module, so keeping it at the root makes those native project references easier to manage.

**Why `supabase/` at the root?**
Follows the official Supabase CLI convention (`supabase init` creates this folder). Migrations can be applied with `supabase db push` from any machine.

---

## Import Alias (tsconfig.json)

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

Use `@/store/canvasStore` instead of `../../../src/store/canvasStore`.
