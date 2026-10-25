Run the feature pipeline for: $ARGUMENTS

## Safety
- Solo project: work directly on `main`. No feature branches, no PRs.
- Start from a clean working tree; if there are uncommitted changes, stop and ask what to do with them.
- Never force-push, rewrite history, or delete branches/files outside the feature's scope.

## Setup
- Ensure `.pipeline/` exists, then clear its contents so no agent reads stale handoff files from a previous run.

## Stages (run in order; confirm each handoff file exists before continuing)
1. Delegate to the **planner** subagent with the feature request. Wait for `.pipeline/spec.md`.
   - If the spec has OPEN QUESTIONS, stop and show them to me — do not proceed.
   - If I prefixed the request with `plan-only`, stop here and just show me the spec.
2. Delegate to the **coder** subagent. Wait for `.pipeline/changes.md`.
   - If the coder reports it could not satisfy the spec, stop and show me.
3. Delegate to the **tester** subagent. Wait for `.pipeline/test-results.md`.
   - If tests failed, stop and show me the failures.
4. Delegate to the **reviewer** subagent. Wait for `.pipeline/review.md`.
5. If the VERDICT is approve: run `npm run lint`, `npm test` and `npm run build`. If all pass, commit the changes on `main` (never `.pipeline/`, `.env*` or other secrets) and `git push origin main`.
   - If the VERDICT is not approve, or any check fails: do not commit; stop and show me what's wrong.

## Report
Finish with a compact summary:
- one line per stage with a status icon: planner • coder • tester • reviewer • push
- the final VERDICT from review.md
- the commit hash that was pushed, or the exact next step for me (what to read, what to fix)
