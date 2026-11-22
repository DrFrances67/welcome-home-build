# Email update

- [x] Replace queue-specific admin retry and deletion with fresh verification requests and reversible view-only dismissal.
- [x] Verify admin controls and regression tests (13 focused tests; signed-in live history dismissal/restoration; app checks pass).
- [ ] Resolve historical-migration blocker: the update demands editing an already-applied migration, but migration history is protected; live delivery must remain untouched.
- [ ] Restart the free email update: waiting on requested consent and the protected-history blocker above; do not publish.
