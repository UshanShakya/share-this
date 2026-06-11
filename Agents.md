# Agents & File Connections — SharedCanvas

This document maps every major source file to its role ("agent"), what it owns, and how it connects to other files. Use this as the single reference when navigating the codebase.

---

## Agent Overview

| Agent ID | Name | Responsibility |
|---|---|---|
| A1 | **Auth Agent** | Sign-up, login, session management |
| A2 | **Room Agent** | Create/join/leave rooms, invite links |
| A3 | **Canvas Agent** | Real-time stroke sync, canvas state |
| A4 | **Widget Agent** | Snapshot writes, widget UI, deep links |
| A5 | **Store Agent** | Global Zustand state, selectors |
| A6 | **DB Agent** | Supabase client, queries, subscriptions |
| A7 | **Router Agent** | Expo Router screens, navigation guards |

---

## File Connection Map

```
app/
├── (auth)/
│   ├── login.tsx          ← A1, A7  →  uses A6 (supabaseClient)
│   │                                   uses A5 (authStore)
│   └── register.tsx       ← A1, A7  →  same as login.tsx
│
├── (app)/
│   ├── index.tsx          ← A7      →  navigates to rooms/
│   ├── rooms/
│   │   ├── index.tsx      ← A2, A7  →  uses A6 (getRooms)
│   │   │                              uses A5 (roomStore)
│   │   ├── new.tsx        ← A2      →  uses A6 (createRoom)
│   │   └── [roomId]/
│   │       └── canvas.tsx ← A3, A7  →  uses A5 (canvasStore)
│   │                                   uses A6 (realtimeChannel)
│   │                                   uses components/Canvas.tsx
│   └── profile.tsx        ← A1      →  uses A6 (getUser)
│
src/
├── store/
│   ├── authStore.ts       ← A5      →  consumed by login.tsx, register.tsx, profile.tsx
│   ├── roomStore.ts       ← A5      →  consumed by rooms/index.tsx, rooms/new.tsx
│   └── canvasStore.ts     ← A5, A3  →  consumed by canvas.tsx, Canvas.tsx, widget bridge
│
├── lib/
│   ├── supabaseClient.ts  ← A6      →  imported by all store files + canvas realtime hook
│   ├── realtime.ts        ← A6, A3  →  sets up Supabase channel, calls canvasStore.applyStroke
│   └── snapshotWriter.ts  ← A4, A3  →  reads canvasStore, writes PNG to shared storage
│
├── components/
│   ├── Canvas.tsx         ← A3      →  uses react-native-skia, reads canvasStore
│   ├── StrokeToolbar.tsx  ← A3      →  dispatches to canvasStore
│   ├── RoomCard.tsx       ← A2      →  used by rooms/index.tsx
│   └── InviteSheet.tsx    ← A2      →  used by rooms/[roomId]/canvas.tsx
│
├── hooks/
│   ├── useAuth.ts         ← A1      →  wraps authStore selectors
│   ├── useRoom.ts         ← A2      →  wraps roomStore selectors
│   ├── useCanvas.ts       ← A3      →  wraps canvasStore + realtime.ts
│   └── useSnapshot.ts     ← A4      →  triggers snapshotWriter on canvas change
│
├── types/
│   ├── canvas.ts          ← shared   →  Stroke, Point, CanvasState interfaces
│   ├── room.ts            ← shared   →  Room, Member interfaces
│   └── user.ts            ← shared   →  User, Session interfaces
│
widget/
├── ios/
│   ├── CanvasWidget.swift ← A4      →  reads snapshot PNG from App Group
│   └── WidgetBundle.swift ← A4      →  registers widget
└── android/
    ├── CanvasWidget.kt    ← A4      →  reads snapshot PNG from SharedPreferences/file
    └── WidgetReceiver.kt  ← A4      →  handles update broadcasts
```

---

## Data Flow Diagrams

### Stroke Broadcast
```
User draws on Canvas.tsx
  → canvasStore.addStroke(stroke)
  → realtime.ts broadcasts stroke over Supabase channel
  → Remote device receives stroke via subscription
  → canvasStore.applyStroke(stroke) on remote
  → Canvas.tsx re-renders
  → useSnapshot.ts detects change → snapshotWriter.ts writes PNG
  → Widget reads PNG from shared storage
```

### Room Join
```
rooms/index.tsx (A7/A2)
  → taps RoomCard.tsx
  → navigates to rooms/[roomId]/canvas.tsx
  → useCanvas.ts initialises realtime.ts channel for roomId
  → fetches existing strokes from A6 (supabaseClient)
  → canvasStore hydrates with history
  → Canvas.tsx renders full state
```

### Auth Guard
```
app/_layout.tsx
  → useAuth.ts checks authStore.session
  → if null → redirect to (auth)/login.tsx
  → if valid → allow (app)/ routes
```

---

## Inter-Agent Dependency Matrix

| | A1 Auth | A2 Room | A3 Canvas | A4 Widget | A5 Store | A6 DB | A7 Router |
|---|---|---|---|---|---|---|---|
| **A1 Auth** | — | | | | writes authStore | reads/writes | navigates post-login |
| **A2 Room** | reads session | — | opens canvas | | writes roomStore | reads/writes | navigates to canvas |
| **A3 Canvas** | reads userId | reads roomId | — | writes snapshot | reads/writes canvasStore | realtime channel | — |
| **A4 Widget** | — | — | reads snapshot | — | reads canvasStore | — | deep link into app |
| **A5 Store** | owns authStore | owns roomStore | owns canvasStore | — | — | — | — |
| **A6 DB** | auth API | room CRUD | realtime sub | — | — | — | — |
| **A7 Router** | auth guard | room nav | canvas nav | deep link | reads session | — | — |

---

## Critical Shared Contracts

These TypeScript interfaces are the source of truth shared across all agents. Changing them requires updating every agent that imports them.

```typescript
// types/canvas.ts
interface Point { x: number; y: number }
interface Stroke {
  id: string
  userId: string
  roomId: string
  points: Point[]
  color: string
  width: number
  timestamp: number
}

// types/room.ts
interface Room {
  id: string
  name: string
  ownerId: string
  members: string[]   // userIds
  createdAt: string
}
```
