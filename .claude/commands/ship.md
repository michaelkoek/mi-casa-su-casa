Run the feature pipeline for: $ARGUMENTS

## Safety
- Confirm we are NOT on the main or master branch. If we are, stop and ask me to create a feature branch first (or create one named after the feature if I tell you to).
- Never merge, push, or delete anything. Leave the branch for my review.

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

## Report
Finish with a compact summary:
- one line per stage with a status icon: planner • coder • tester • reviewer
- the final VERDICT from review.md
- the exact next step for me (what to read, what to fix, or "ready to review and merge")

Do not merge anything.
