# Recommendation: Transfer Upload Tuning Config

Status: Recommended (not required)
Priority: Medium

## Context

The upload pipeline is reactive and stable, but tuning values are still code-level constants.

## Goal

Move retry/chunk/tuning knobs into a dedicated typed policy layer, without touching queue orchestration logic.

## File Context Mapping

### Transport Retry Policy

- `entrypoints/background/services/transferHttpRetry.ts`

What to place here:

- retry policy by request type (session init / probe / chunk)
- backoff base and max caps
- transient error classification

### Upload Execution Strategy

- `entrypoints/background/services/transferUploadExecutor.ts`

What to place here:

- chunk size strategy by file size
- policy reads from one centralized service
- optional adaptive tuning hooks

### Queue Constants and Defaults

- `entrypoints/background/services/transferQueueConstants.ts`

What to place here:

- fallback defaults only
- no business branching logic

### New Policy Service (proposed)

- `entrypoints/background/services/transferUploadPolicy.ts`

What to place here:

- typed getters for retry/chunk/limits
- environment-aware defaults (if needed)
- feature-flag compatible config access

## Benefits

- faster safe tuning
- less risk of regressions in queue coordinator
- cleaner separation of orchestration vs transport policy

## When This Becomes Mandatory

- repeated transient failures on large files
- frequent policy updates requiring code edits and redeploys
- need for behavior differences by file category or environment
