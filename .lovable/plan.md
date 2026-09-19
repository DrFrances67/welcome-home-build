# Mobile saved-work preview and lesson-plan access

## What will change

### Saved worksheet print preview
- Add a **Preview** action to each saved worksheet and saved worksheet version.
- Open an in-app, phone-friendly preview before printing instead of sending teachers directly to the browser print dialog.
- Display every worksheet page at its true letter-page proportions, scaled to fit the phone width while preserving the complete page, margins, page breaks, colors, and page count.
- Include a compact preview toolbar with page position, close, **Open & edit**, and **Print / Save PDF** actions.
- Keep the preview read-only so viewing cannot accidentally modify the saved worksheet.

### Saved Lesson Plans on phones
- Rebuild the page layout responsively while preserving the existing Saved/Drafts tabs and all current account data.
- Use a compact mobile header and full-width lesson-plan cards with clear timestamps.
- Make **Open & edit** the prominent action, with draft history, rename, and delete arranged as touch-friendly secondary actions.
- Stack the version selector and **Restore this version** control on small screens.
- Make each version row readable on phones with accessible **Open & edit** and delete actions that do not overflow.

## Technical details
- Extract or reuse a safe worksheet print renderer so the preview and printed output share the same page markup rather than drifting apart.
- Validate saved worksheet data before rendering and escape user-authored text in generated print markup.
- Add responsive classes and semantic design tokens instead of adding more fixed inline mobile styles.
- Preserve account-scoped worksheet and lesson-plan IDs when reopening a saved item.
- Add regression tests covering saved worksheet preview/print actions and mobile lesson-plan reopen/restore controls.
- Verify at phone and desktop widths, then run the related automated tests.
