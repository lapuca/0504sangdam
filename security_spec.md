# Security Specification: Classroom Counseling Scheduler (Passcode Admin Mode)

## 1. Data Invariants

1. **Deterministic Slot Keying**: Every counseling slot document in `/counselingSlots/{slotId}` must have a deterministic `slotId` matching `YYYY-MM-DD_1` or `YYYY-MM-DD_2` within the 27-weekday window (`2026-11-17` through `2026-12-23`, excluding Saturdays and Sundays).
2. **No Overwrites by Students**: Any visitor with the link may read all bookings and create a booking in an empty slot (`allow create`). Once a slot document exists, students cannot modify or delete it.
3. **Passcode-Gated Atomic Admin Writes**: Updates and deletes on `/counselingSlots/{slotId}` require an atomic `writeBatch` writing to `/adminVerifications/{slotId}` with `updatedAt == request.time` and a passcode whose SHA-256 hash matches the expected admin digest.
4. **Zero Readability on Verification Docs**: `/adminVerifications/{slotId}` strictly denies all `get`, `list`, and `delete` operations so verification passcodes can never be read from Firestore.
5. **Temporal Integrity**: `createdAt` must equal `request.time` on creation and remain immutable on update; `updatedAt` must equal `request.time` on both create and update.

## 2. Adversarial Payloads ("Dirty Dozen")

1. **Out-of-range / Weekend Date**: `slotId: "2026-11-21_1"` (Saturday) or `"2026-12-24_1"` -> `PERMISSION_DENIED`
2. **After-window Date**: `slotId: "2026-12-14_1"` -> `PERMISSION_DENIED`
3. **Invalid Slot Number**: `slotNumber: 3` -> `PERMISSION_DENIED`
4. **Mismatched ID & Payload**: `slotId: "2026-11-17_1"` with `date: "2026-11-18"` -> `PERMISSION_DENIED`
5. **Blank Student Name**: `studentName: "   "` -> `PERMISSION_DENIED`
6. **Oversized Student Name**: `studentName: "A".repeat(100)` -> `PERMISSION_DENIED`
7. **Shadow Field Injection**: `{ ..., isAdmin: true }` -> `PERMISSION_DENIED`
8. **Client-Spoofed Timestamp**: `createdAt: new Date(0)` -> `PERMISSION_DENIED`
9. **Unauthorized Update without Batch Verification**: `updateDoc` on existing slot without atomic `adminVerifications` write -> `PERMISSION_DENIED`
10. **Unauthorized Delete without Batch Verification**: `deleteDoc` without atomic `adminVerifications` write -> `PERMISSION_DENIED`
11. **Wrong Passcode in AdminVerification**: Writing wrong `passcode` to `/adminVerifications/{slotId}` -> `PERMISSION_DENIED`
12. **Reading AdminVerification**: Attempting `getDoc` or `getDocs` on `/adminVerifications` -> `PERMISSION_DENIED`
