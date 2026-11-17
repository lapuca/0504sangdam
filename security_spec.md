# Security Specification: Classroom Counseling Scheduler

## 1. Data Invariants

1. **Deterministic Slot Keying**: Every counseling slot document in `/counselingSlots/{slotId}` must have a deterministic `slotId` matching `YYYY-MM-DD_1` or `YYYY-MM-DD_2` within the 27-day window (`2026-11-17` through `2026-12-13`).
2. **No Overwrites by Students**: Any visitor with the link may read all bookings and create a booking in an empty slot (`allow create`). Once a slot document exists, students cannot modify or delete it (`allow update` and `allow delete` are strictly restricted to the verified teacher admin `lapuca1@gmail.com`).
3. **Strict Field Allowlisting**: Documents must contain exact keys `['date', 'slotNumber', 'studentName', 'createdAt', 'updatedAt']` with no shadow fields.
4. **Verified Teacher Admin**: Admin privileges require `request.auth != null && request.auth.token.email == 'lapuca1@gmail.com' && request.auth.token.email_verified == true`.
5. **Temporal Integrity**: `createdAt` must equal `request.time` on creation and remain immutable on update; `updatedAt` must equal `request.time` on both create and update.

## 2. Adversarial Payloads ("Dirty Dozen")

1. **Out-of-range Date**: `slotId: "2026-11-16_1"` (before Nov 17) -> `PERMISSION_DENIED`
2. **After-window Date**: `slotId: "2026-12-14_1"` (after Dec 13) -> `PERMISSION_DENIED`
3. **Invalid Slot Number**: `slotNumber: 3` -> `PERMISSION_DENIED`
4. **Mismatched ID & Payload**: `slotId: "2026-11-17_1"` with `date: "2026-11-18"` -> `PERMISSION_DENIED`
5. **Blank Student Name**: `studentName: "   "` or `""` -> `PERMISSION_DENIED`
6. **Oversized Student Name**: `studentName: "A".repeat(100)` -> `PERMISSION_DENIED`
7. **Shadow Field Injection**: `{ ..., isAdmin: true }` -> `PERMISSION_DENIED`
8. **Client-Spoofed Timestamp**: `createdAt: new Date(0)` -> `PERMISSION_DENIED`
9. **Unauthorized Update (Student)**: Unauthenticated or non-teacher user attempting `updateDoc` on existing slot -> `PERMISSION_DENIED`
10. **Unauthorized Delete (Student)**: Unauthenticated or non-teacher user attempting `deleteDoc` on existing slot -> `PERMISSION_DENIED`
11. **Unverified Admin Email Spoof**: User with `email: "lapuca1@gmail.com"` and `email_verified: false` attempting update/delete -> `PERMISSION_DENIED`
12. **Immutable Field Mutation by Admin**: Admin attempting to change `date`, `slotNumber`, or `createdAt` during update -> `PERMISSION_DENIED`
