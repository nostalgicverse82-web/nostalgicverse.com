# AUTHENTICATION & IDENTITY ARCHITECTURE

## Identity & Username Canonicalization
- **Case-Insensitive Uniqueness:** A user's identity is anchored to `username_normalized` (lowercased, trimmed). `User123` and `user123` resolve to the exact same account.
- **Database Enforcement:** A database `UNIQUE` constraint strictly guards `username_normalized`.
- **Display Casing:** The original casing (e.g., `User123`) is stored in `user_profiles.display_name` and dictates visual rendering. Login logic always compares against the normalized value.
- **Similar Usernames:** Unrelated variants (e.g., `user_123` vs `user123`) remain distinct; only exact case variants collide.

## Password & Session Policy
- **Hashing:** Native `crypto.pbkdf2` (100,000 iterations, salt size 16) with SHA-512.
- **Case Sensitivity:** Passwords are strictly case-sensitive.
- **Sessions:** UUIDv4 tokens stored in HTTP-Only cookies. No JWTs exposed to the client.
- **Exposure:** Hashes and passwords are NEVER returned by APIs, logged, or exposed to the frontend.

## Owner Identity
- **Namespace Reservation:** The owner username `Sufiyan_memon17` (and all case variants) is permanently reserved. No regular user can register it.
- **Provisioning:** Initialized securely via `OWNER_USERNAME` and `OWNER_INITIAL_PASSWORD` environment variables. No hardcoded credentials exist in source code or default DB seeds.
- **First Login:** Owner is forced to change their password upon first login, rendering the initial provisioning secret obsolete.

