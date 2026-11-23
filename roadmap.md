# Email update

- [x] Add and verify an admin-only action/timestamp audit log for verification requests and view dismissals, with no email contents or history edits (live dismissal/restore/reload and own-account verification request checked).

- [x] Replace queue-specific admin retry and deletion with fresh verification requests and reversible view-only dismissal.
- [x] Verify admin controls and regression tests (13 focused tests; signed-in live history dismissal/restoration; app checks pass).
- [x] Add a read-only admin email status panel explaining the reported protected-history blocker and safe next steps without changing or deleting records.
- [ ] Resolve historical-migration blocker through a supported update-workflow path that preserves already-applied history; no historical edits or live delivery changes.
- [ ] Restart the free email update only after the blocker is resolved and the user requests and approves it again; no restart or publishing requested in this task.
