## Goal

Users can no longer change their specialty/sector directly. They submit a change request; only administrators can approve it, and approval is what actually updates the profile.

Note: the profile has a single field for this concept (`specialty`); "sector" will be treated as the same field, with clearer bilingual labels.

## Current state (verified)

- `profiles.specialty` is written directly from the profile page's Save button.
- Row-level rules let a user update their own profile row; an existing database guard already blocks privileged fields (subscription, quotas, tokens) for non-admins — `specialty` is not in that list.
- There is an existing pattern for admin-approved requests (`subscription_requests`) to follow.

## Plan

### 1. Database
- Add `specialty` to the existing non-admin profile-update guard so any direct user attempt to change it is rejected server-side (admins unaffected).
- New table `specialty_change_requests`: user id, current value, requested value, optional reason, status (pending/approved/rejected), admin note, reviewer id, timestamps.
- Grants + RLS: user can insert and read their own requests; admins can read all and update status. One pending request per user (partial unique index).

### 2. Approval logic
- Server function `reviewSpecialtyRequest` (admin-verified): on approve, writes the new specialty onto the user's profile and marks the request approved; on reject, stores the admin note.
- Server function `submitSpecialtyRequest` for the user side (validates, blocks duplicate pending requests).

### 3. Profile page (`src/routes/profile.tsx`)
- Specialty input becomes read-only with a lock icon and explanatory text: changes require administrative approval.
- Add a "Request change" button opening a small inline form (new value + reason) that submits the request.
- Show the current request status (pending / approved / rejected + admin note) under the field.
- Remove `specialty` from the direct profile save payload.

### 4. Admin dashboard
- New "Specialty change requests" panel inside the user-management area (`src/components/admin/UserIntelligenceTab.tsx`): list of pending requests with user, current → requested value, reason, and Approve / Reject buttons with an optional note.
- Admins keep the ability to edit any user's specialty directly.

### 5. Localization
- Add all new strings to `ar`, `en`, and `ku` dictionaries (no hardcoded text), consistent with the existing i18n system.

## Technical notes

- The specialty value continues to feed prompt context (`user-context.server.ts`) unchanged; only the write path changes.
- Approval writes go through an admin-verified server function, not the browser client, so the database guard stays strict.
