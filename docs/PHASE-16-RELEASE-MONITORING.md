# NostalgicVerse — Phase 16 Release Monitoring & Follower Notifications

## 1. Release Monitoring Overview

The Release Monitor Service (`server/services/releaseMonitorService.cjs`) tracks release dates for upcoming retro remakes, indie retro-inspired titles, hardware FPGA clones, and homebrew cartridge pressings.

---

## 2. Change Detection & Verification Lifecycle

```
Registered Release Watch Record (release_watch_records)
                      │
                      ▼
External Page Periodic Check (via sourceFetchService)
                      │
                      ▼
AI Date & Status Extraction Job (job_type = RELEASE_ANALYSIS)
                      │
             [Detected Date vs Current Date]
              ├── Identical ──► Status: WATCHING (No alert)
              └── Changed   ──► Status: AWAITING_REVIEW
                                      │
                                      ▼
                        Owner Command Center Review
                                      │
                        ├── Rejected ──► Status: REJECTED
                        └── Approved ──► Status: APPROVED
                                                │
                                                ▼
                                Dispatch In-App Notifications
                                to Users Who Favorited the Game
```

---

## 3. In-App Notification Delivery

When the owner verifies a release date change:
1. `release_watch_records.current_release_date` is updated.
2. The system queries all users who marked the game as a favorite in `favorites`:
   ```sql
   SELECT user_id FROM favorites 
   WHERE entity_type = 'GAME' AND entity_id = ?;
   ```
3. A notification record is inserted into `notifications` for each follower:
   ```sql
   INSERT INTO notifications (id, user_id, type, reference_id, message, is_read, created_at)
   VALUES (?, ?, 'RELEASE_UPDATE', ?, ?, 0, CURRENT_TIMESTAMP);
   ```
4. Followers receive real-time alerts in their notification tray upon subsequent login.
