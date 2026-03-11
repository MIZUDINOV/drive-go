# Recommendation: Rx Search Refinements

Status: Recommended (not required)
Priority: Low

## Context

Main search flow is migrated to RxJS and integrated in the primary search UI.

## Goal

Improve resilience and maintainability of search behavior without changing UX.

## File Context Mapping

### Search Stream State

- `entrypoints/sidepanel/services/driveSearchStream.ts`

What to add:

- explicit `error` in stream state
- consistent loading/result/error transitions
- optional recover behavior after transient API failures

### Search UI Rendering

- `entrypoints/sidepanel/components/search/DriveSearchBar.tsx`

What to add:

- show stream error state in panel
- keep current open/close behavior intact
- avoid stale message flashes during rapid query updates

### Shared Filter Definitions

- `entrypoints/sidepanel/components/drive/DriveBrowser.tsx`
- `entrypoints/sidepanel/components/search/DriveSearchBar.tsx`

What to refactor:

- extract duplicated filter option constants and labels
- centralize into a shared module used by both components

### Optional Test Coverage

- `entrypoints/sidepanel/services/driveSearchStream.ts`

What to validate:

- rapid typing cancels stale requests
- filter switching keeps latest result only
- no regressions in loading indicator transitions

## Benefits

- better operational clarity on search failures
- less duplication across components
- easier future evolution of search behavior
