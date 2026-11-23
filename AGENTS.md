# Architecture rules

- Admin email review must not read, replay, or delete queue messages; read delivery outcomes, request fresh verification through the existing auth resend path, and dismiss entries only in local view state to avoid replaying expired links.
- Keep `/admin/dlq` as the delivery-review URL so existing navigation remains valid; the funded email rewrite must convert outcome reads to `listEmailLogs` and may retain legacy history as a separate archive.
- Do not edit already-applied migrations; preserve live email functions until the publish/cutover workflow retires them.
- The admin parent route renders Outlet for its subpages and shows the dashboard only at `/admin`, so delivery review and user controls remain reachable.
- Share the read-only email update notice between admin dashboard and delivery review; label it as last-reported rather than live state because it has no workflow-status connection.
- Admin email actions append actor/action/optional delivery UUID to a separate admin-only audit table before execution; timestamps come from the database, failures stop the action, and no email addresses or contents enter the audit payload.
- Protected-history observations are explicitly admin-reported, not workflow detection; a role-checked, serialized database function appends only status changes with server-owned actor/time and never modifies email or workflow state.
