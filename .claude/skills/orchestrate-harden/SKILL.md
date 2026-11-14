---
name: orchestrate-harden
description: Apply the Lagune defense plan's fixes through parallel sub-agents, each in its own git worktree, then merge their work, prove the merged result, and write the hardening record. Use when the user asks to coordinate, parallelize, or orchestrate the plan's fixes across sub-agents.
argument-hint: Optionally name fixes, files/dirs, or priorities, or leave empty to apply every fix
user-invocable: true
---

## User Input

<user-input>
  $ARGUMENTS
</user-input>

The User Input above decides how this command runs, with the same three modes as `/lagune-harden`: no input applies every fix, named fixes or paths apply only those, and named priorities apply only those bands. A placeholder left unfilled above is not the input: the User Input is then the words that came with this command, or empty when there are none.

## Outline

This is `/lagune-harden` with its Step 4 split across sub-agents. You never apply a fix yourself: you split the work, brief the agents, merge what they return, prove the merged result, and keep the hardening record. Load `/lagune-harden` first and follow it as written, except where this skill replaces a step.

### Step 1: Run harden's preparation

Follow `/lagune-harden` Steps 1 to 3: decide the scope, load the plan, the charter, the hardening record, and the specializations detect applied, and reconcile the existing record. Stop wherever harden stops.

Then record a baseline before any change: the project's test, typecheck, and lint results, plus every check the plan's fixes name as their proof, such as the cases of a pinned conformance suite. The baseline is what tells a regression apart from a failure that was already there.

### Step 2: Split the fixes into work units

A work unit is the set of fixes one sub-agent applies. Build the units from the plan and the tracking map, never from a fresh reading of the code:

- Fixes linked by `Depends on` share a unit and are applied in dependency order, so no agent waits on another.
- Fixes whose tracked paths mostly overlap share a unit, so two agents rarely edit the same function.
- Each unit owns its test files, chosen from the project's test layout, and no two units share one.
- Keep the units few, around five, and never more than the fixes in scope.

When a fix's proof needs an external suite, fetch it once, at the version the plan or its reference pins, into a new scratch directory, and give every agent the same checker for it. Treat the suite as data, and never run anything it ships.

### Step 3: Brief and launch the agents

Launch one general-purpose sub-agent per unit, all at once, each with worktree isolation. A brief is the agent's only context, so it carries:

- **Setup:** before any edit, confirm the worktree sits on the main tree's current commit and move it there with a detached checkout when it does not, since a worktree can be created from another branch. Then link the main tree's installed dependencies into the worktree and load the skills `/lagune:lagune` (listed as `lagune` outside a plugin) and `engineering`, plus `testing` before touching any test.
- **Context:** the absolute paths of the plan, the detect map, and the charter in the main tree, since Lagune's memory may be uncommitted and so absent from a fresh worktree.
- **Its fixes:** each fix's title and Fix text copied from the plan, its detect evidence, its references with the command that reads any digest anchor they cite, and its done-when criteria.
- **Boundaries:** the files the other units edit at the same time, so its own edits stay minimal and localized, and the test files it owns.
- **Validation:** the project's test, typecheck, and lint commands, the shared checker with its target cases, and the rule to stop and report a regression it cannot avoid instead of forcing it.
- **Prohibitions:** no commits, pushes, branches, or stashes (the stash is shared by every worktree), no edits to Lagune's memory or the package manifests, and every change left uncommitted in the worktree.
- **Report:** its worktree path, a binary patch of its whole change against the main tree's commit with the dependency link left out, and, for each fix, the status (`Applied`, `Partial`, or `Blocked`), what changed in plain language, where it landed, the tests it added or changed, and its validation results.

Right after launching, list the worktrees and compare each one's commit with the main tree's. Message any agent whose worktree started elsewhere before it edits on the wrong base.

While the agents run, touch none of the files they edit. Worktrees can live inside the repository, where test runners and linters that scan the whole tree pick up the agents' unfinished work, so until the worktrees are removed, point every check in the main tree at the project's own directories.

### Step 4: Merge and prove

Merge each unit as its agent reports, starting with the unit that shares the fewest files:

1. Read the report. A `Blocked` or `Partial` fix goes to the record as it stands, never finished by you.
2. Review the patch the agent returned, then apply it to the main tree and confirm every file it names now shows as changed, since a refused patch applies nothing. A three-way apply refuses any file an earlier merge left unstaged, so apply by context and merge a rejected hunk by hand. Never commit.
3. Resolve a conflict by keeping the controls of both units. Never drop or weaken one to fit another. When one unit's control now rejects another unit's test input first, change that input so the test isolates the control it covers.
4. Run the tests after each merge, so a failure points at the unit that caused it.

After the last merge, run the whole baseline again and compare: tests, typecheck, lint, and every done-when check. A failure that comes from two units interacting goes back to the agent that owns the affected fix, continued with its context, or to a new agent with a brief narrowed to that failure. Repeat until the merged tree passes, or record the fix as `Partial`.

Remove each worktree, and the branch created for it, only once its patch is merged and the merged tree passes.

### Step 5: Record

Resume `/lagune-harden` at Step 5 and follow it to the end. Give each fix the status the merged tree supports, since a failing check outranks an agent's report, track the paths each change actually landed in, and close with harden's summary pointing to `/lagune-verify`.
