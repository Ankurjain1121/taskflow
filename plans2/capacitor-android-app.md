# TaskBolt Android App via Capacitor

## Objective
Ship a native Android app for TaskBolt by wrapping the existing Angular frontend with Capacitor. Reuse 90%+ of existing code. Ship to Play Store.

## Premises
1. The existing Angular frontend is feature-complete enough for mobile
2. Capacitor provides sufficient native bridge for our needs (push notifications, biometrics, offline)
3. Users want mobile access primarily for: viewing tasks, quick updates, notifications
4. The Rust backend API needs zero changes — mobile hits the same REST + WebSocket endpoints
5. A wrapped web app provides acceptable performance for a project management tool (not a game, not media-heavy)

## Tech Stack
- **Capacitor 6** — native bridge between Angular and Android/iOS
- **Angular 19** — existing frontend (reused)
- **Ionic (optional)** — mobile-optimized UI components if needed
- **Firebase Cloud Messaging** — push notifications
- **Capacitor Plugins** — biometrics, camera, haptics, status bar, splash screen, keyboard

## Architecture
```
┌─────────────────────────────┐
│     Angular App (existing)  │
│   ┌───────────────────────┐ │
│   │  Responsive layouts   │ │
│   │  Mobile-first views   │ │
│   │  Touch interactions   │ │
│   └───────────────────────┘ │
├─────────────────────────────┤
│      Capacitor Bridge       │
│  ┌──────┐ ┌──────┐ ┌─────┐ │
│  │Push  │ │Bio   │ │File │ │
│  │Notif │ │Auth  │ │Pick │ │
│  └──────┘ └──────┘ └─────┘ │
├─────────────────────────────┤
│     Android Native Shell    │
│  (WebView + native plugins) │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  TaskBolt API (Rust/Axum)   │
│  REST + WebSocket (existing)│
│  taskflow.paraslace.in      │
└─────────────────────────────┘
```

## Implementation Plan

### Phase 1: Capacitor Setup + Build Pipeline (Day 1)
- [ ] Install Capacitor in existing Angular project
- [ ] Configure `capacitor.config.ts` with TaskBolt app ID, name, WebView settings
- [ ] Add Android platform (`npx cap add android`)
- [ ] Configure Gradle build (minSdk 24, targetSdk 34)
- [ ] Build Angular → sync to Android → run on emulator
- [ ] Set up app icon and splash screen (use existing TaskBolt branding)
- [ ] Configure deep linking (taskflow.paraslace.in URLs open in app)

### Phase 2: Mobile UX Adaptations (Day 2-3)
- [ ] Add responsive breakpoints for mobile viewport (<768px)
- [ ] Bottom navigation bar for mobile (replace sidebar)
- [ ] Swipe gestures on task cards (swipe right = complete, left = snooze)
- [ ] Pull-to-refresh on all list views
- [ ] Touch-optimized tap targets (min 44px)
- [ ] Keyboard-aware scroll (input fields don't get hidden by keyboard)
- [ ] Mobile-optimized task detail (full screen, slide-up panel)
- [ ] Quick-add floating action button (FAB)
- [ ] Safe area insets (notch, status bar, navigation bar)

### Phase 3: Native Features (Day 3-4)
- [ ] Push notifications via Firebase Cloud Messaging (FCM)
  - Register device token on login
  - Backend: store device tokens in `user_devices` table
  - Backend: send push via FCM HTTP v1 API on notification events
  - Handle notification tap → deep link to relevant task/project
- [ ] Biometric authentication (fingerprint/face unlock for app lock)
- [ ] Haptic feedback on task completion
- [ ] Native share sheet (share task as link)
- [ ] Camera integration for attachment uploads
- [ ] Status bar theming (match app theme)
- [ ] App badge count (unread notifications)

### Phase 4: Offline Support (Day 4-5)
- [ ] Service worker for caching API responses
- [ ] IndexedDB for offline task queue
- [ ] Optimistic UI updates (show changes immediately, sync when online)
- [ ] Conflict resolution strategy (last-write-wins with user notification)
- [ ] Offline indicator banner

### Phase 5: Play Store Release (Day 5-6)
- [ ] App signing (upload key + app signing key)
- [ ] Store listing (screenshots, description, feature graphic)
- [ ] Privacy policy page
- [ ] Internal testing track → closed beta → production
- [ ] Automated build with GitHub Actions (build APK/AAB on push)

## Success Criteria
- [ ] App installs and runs on Android 7+ (API 24+)
- [ ] All existing features work in mobile form factor
- [ ] Push notifications delivered within 5 seconds
- [ ] App startup < 3 seconds on mid-range device
- [ ] Offline mode: can view and create tasks without connectivity
- [ ] Biometric lock works on supported devices
- [ ] Play Store listing approved and publicly available

## Risks
1. **WebView performance** — mitigation: lazy load routes, reduce bundle size, preload critical assets
2. **Push notification reliability** — mitigation: FCM is industry standard, fallback to WhatsApp
3. **Offline sync conflicts** — mitigation: last-write-wins with merge notification
4. **Play Store review** — mitigation: ensure privacy policy, no policy violations

## What We're NOT Building (Phase 1)
- iOS app (defer to Phase 2 — Capacitor supports it, just needs Xcode build)
- Widget support (Android home screen widgets)
- Wear OS companion
- Background sync (only foreground + push)
