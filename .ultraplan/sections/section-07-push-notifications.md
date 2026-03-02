# Section 07: Push Notifications & Sounds

> Project: TaskFlow World-Class Upgrade
> Batch: 2 | Tasks: 5 | Risk: GREEN
> PRD Features: P1 - Browser Push Notifications, P2 - Sound Effects

---

## Overview

Add browser push notifications and sound effects to make TaskFlow feel alive and responsive. Push notifications alert users even when TaskFlow isn't the active tab. Sound effects provide satisfying audio feedback for key actions (task completion, new notification, drag-and-drop).

---

## Risk

| Aspect | Value |
|--------|-------|
| Color | GREEN |
| Summary | Standard Web Push API + audio playback |

### Risk Factors
- Complexity: 2 (Service Worker for push, audio management)
- Novelty: 2 (first push notification implementation)
- Dependencies: 1 (no deps)
- Integration: 1 (browser APIs only)
- Data sensitivity: 1 (notification content only)
- **Total: 7 → GREEN**

---

## Dependencies

| Type | Section | Description |
|------|---------|-------------|
| None | - | Independent of other sections |

**Batch:** 2

---

## TDD Test Stubs

1. `PushNotificationService should request permission when user enables push in settings`
2. `PushNotificationService should NOT request permission on first visit`
3. `PushNotificationService should send subscription to backend when permission granted`
4. `SoundService should play notification sound when new notification received`
5. `SoundService should play completion sound when task moved to done column`
6. `SoundService should respect user's sound preference (on/off)`

---

## Tasks

### Task 1: Push Notification Service (Frontend)
**Files:** `push-notification.service.ts` (CREATE)
**Steps:**
1. Check browser support for `Notification` API and `PushManager`
2. Request permission when user explicitly enables push in settings (NOT on first visit)
3. On permission granted: get PushSubscription from ServiceWorker
4. Send subscription (endpoint + keys) to backend for storage
5. Handle permission denied gracefully (show "notifications blocked" message)
**Done when:** Users can enable push notifications from settings

### Task 2: Push Notification Backend
**Files:** `backend/crates/api/src/routes/push_subscription.rs` (CREATE), push delivery in notification service
**Steps:**
1. Add push_subscriptions table (user_id, endpoint, p256dh, auth, created_at)
2. Create endpoints: POST /push-subscriptions, DELETE /push-subscriptions
3. When creating a notification, check if user has push subscription
4. Use `web-push` crate to send push payload to subscription endpoint
5. Handle expired/invalid subscriptions (remove from DB)
**Done when:** Backend can store subscriptions and send push notifications

### Task 3: Service Worker for Push
**Files:** `frontend/src/ngsw-worker.js` or custom service worker
**Steps:**
1. Register push event listener in service worker
2. On push event: show browser notification with title, body, icon
3. On notification click: focus TaskFlow tab or open URL from notification data
4. Notification payload: `{ title, body, url, icon }`
**Done when:** Push notifications appear as browser desktop notifications

### Task 4: Sound Effect System
**Files:** `notification-sound.service.ts` (MODIFY - already exists)
**Steps:**
1. Extend existing `NotificationSoundService` with additional sounds
2. Add sounds: notification ping, task completion ding, drag feedback
3. Sound files: small MP3/OGG files (<10KB each) in assets
4. Add volume control and mute toggle
5. Respect browser autoplay policy (only play after user interaction)
6. Add sound toggle to user preferences (on/off, separate from notification preferences)
**Done when:** Sounds play for key interactions, can be toggled in settings

### Task 5: Settings Integration
**Files:** `features/settings/notifications-section/` components
**Steps:**
1. Add "Browser Push Notifications" toggle in notification settings
2. Add "Sound Effects" toggle in notification settings
3. Show permission status ("Allowed", "Blocked", "Not Asked")
4. If blocked, show instructions to unblock in browser settings
**Done when:** Users can manage push and sound preferences from settings

---

## Section Completion Criteria

- [ ] Push notifications work for mentions, assignments, and deadlines
- [ ] Permission is requested only when user explicitly enables
- [ ] Notification click navigates to relevant task/board
- [ ] Sounds play for notification, task completion, and drag-and-drop
- [ ] Sound and push preferences are toggleable in settings
- [ ] All works with existing notification infrastructure
