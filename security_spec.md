# Security Specification & Payload-First Security TDD

## 1. Data Invariants
1. **Owner Integrity**: Every `identities`, `cases`, and `coachLogs` document MUST have `ownerId == request.auth.uid` on creation, and `ownerId` is immutable on update.
2. **Verified Users Only**: All user writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Bootstrapped & Role-Verified Admin**: Admin privileges are granted ONLY to verified `lailynoorhidayah045@gmail.com` (`email_verified == true`) or UIDs explicitly listed in `/admins/{uid}`. Clients can NEVER self-assign `role: 'admin'` on `/users/{userId}`.
4. **PII Isolation**: User emails live in `/users/{userId}/private/info` and `identities` / `cases` contain contact fields; therefore `get` and `list` on `/users/{userId}/private/{docId}`, `/identities/{identityId}`, `/cases/{caseId}`, and `/coachLogs/{logId}` are strictly restricted to `ownerId == request.auth.uid || isAdmin()`.
5. **Strict Schema & Bounds**: Every write validates exact required + allowed keys (`hasAll` + `hasOnly`), string `.size()` limits, numeric bounds, enum values, and server timestamps (`request.time`).
6. **Path Variable Hardening**: Every single-document target rule enforces `isValidId(id)` (`^[a-zA-Z0-9_\\-]+$`, length `<= 128`).

## 2. The "Dirty Dozen" Attack Payloads (All Must Yield PERMISSION_DENIED)
1. **Unauthenticated Write**: `create /cases/case1` with `request.auth == null`.
2. **Unverified Email Admin Spoof**: `list /cases` with `email: "lailynoorhidayah045@gmail.com"` and `email_verified: false`.
3. **Self-Assigned Admin Escalation**: `create /users/user1` with `role: "admin"` by non-admin user.
4. **Role Escalation Update**: `update /users/user1` changing `role` from `"user"` to `"admin"`.
5. **Owner Spoofing on Case Create**: `create /cases/case2` by `userA` with `ownerId: "userB"`.
6. **Shadow Ghost Field Injection**: `create /identities/id1` including extra field `isVerified: true`.
7. **ID Poisoning**: `create /cases/invalid$id*longer_than_128...` failing `isValidId()`.
8. **Client Timestamp Forgery**: `create /cases/case3` with `createdAt` not equal to `request.time`.
9. **Immutable Owner Tampering**: `update /cases/case1` modifying `ownerId` or `createdAt`.
10. **Cross-User PII Read**: `get /identities/idOfUserA` or `get /users/userA/private/info` by `userB` (non-admin).
11. **Blanket List Scraping**: `list /cases` by `userB` without `ownerId == "userB"` filter (blocked by `resource.data.ownerId == request.auth.uid || isAdmin()`).
12. **Oversized String DoS**: `create /coachLogs/log1` with `question.size() > 500` or `answer.size() > 5000`.
