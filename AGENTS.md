# Chisl - Project Guide

All contributors (human and AI) must follow [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

## Operating Rules (HARD)

These rules exist because agents have done real damage to this project: rewriting `main`'s history, force-pushing, inventing branches, scrubbing history to "fix" secrets, and scope-creeping into unrelated refactors. Read this section before any action.

This is a **solo-developer fork**. The sole contributor is the user. No PRs from outside contributors, no co-authors, no release process the agent needs to drive. Operations that touch a remote or rewrite history are the user's job.

### Git Safety

**NEVER, without explicit per-operation user approval:**

- **Never push to any remote** — not `origin`, not `upstream`, not feature branches. Commit locally and stop. Wait for the user to say "push it."
- **Never force-push.** Not with `--force`, `--force-with-lease`, `+refspec`, or any equivalent. There is no scenario where an agent force-pushes.
- **Never rewrite pushed history.** No `git rebase` on pushed commits, no `git commit --amend` on pushed commits, no `git reset` that moves the branch backward.
- **Never run history-rewriting tools.** No `git filter-repo`, `git filter-branch`, BFG, or anything that rewrites commit SHAs. Even for scrubbing secrets — stop and ask.
- **Never create branches.** Commit to the currently checked-out branch. If a branch seems needed, ask. Do not run `git checkout -b`, `git switch -c`, or `git branch <name>`.
- **Never merge into `main`** — including fast-forwards, including from a branch the agent created. The user merges to `main`.
- **Never delete branches or tags** (local or remote).
- **Never touch the `upstream` remote** (iOfficeAI/AionUi). No fetch, no merge, no rebase onto it, no PR. This fork is one-way: upstream → fork, never the reverse. The user handles all upstream-facing work.

**ALWAYS:**

- Commit to the current branch: `git add <named files>` (never `-A` / `.`), then `git commit -m "<type>(<scope>): <subject>"`.
- When in doubt, stop and ask. The cost of pausing is small; the cost of an unauthorized rewrite is hours of recovery.
- If an operation feels like "cleanup," it is almost certainly destructive. Ask first.

### Secrets

- **Files never to commit:** `.env`, `.env.*`, `*-backup.json`, `credentials*`, `*.pem`, `*.key`, and anything containing `secret` or `token` in the name.
- **If a secret is found in repo history → STOP and tell the user.** Do not run `git filter-repo`, BFG, or any history-scrubber. The cure has caused more damage than the disease here.
- Never log, print, or `echo` environment-variable contents.

### Scope Discipline

- Fix only what the task asks. No "while I'm here" cleanups, no reformatting unrelated files, no opportunistic refactors.
- Don't add error handling, validation, or fallbacks for cases that can't happen. Trust internal code and framework guarantees.
- Don't introduce abstractions for hypothetical future needs. Three similar lines beats a premature helper.
- If the work expands beyond what was asked (a 2-file fix turns into 20 files), **STOP and check** with the user before continuing.

### Verification Before Claiming "Done"

- "The code looks right" is not done. Run the relevant tests / lint / typecheck before saying a task is complete.
- If the change cannot be validated by the agent in this environment, the agent **MUST give the operator a numbered test plan in plain English** — no file paths, no jargon, no "verify the X selector renders." Describe what the operator should DO and what they should SEE:

  ```
  1. Open the app and click the sidebar toggle.
  2. The left panel should slide closed smoothly.
  3. Click it again — it should slide back open.
  ```

- "I think this works" is fine. "Verified" requires evidence (command + exit code, or test output).

### Test Discipline

- Do not delete failing tests to make them pass.
- Do not weaken specific assertions to vague ones (`expect(status).toBe(201)` → `expect(status).toBeTruthy()` is prohibited).
- Do not add `.skip` / `xit` to make CI green.
- If a test is genuinely wrong, fix it with a clear explanation of why — don't quietly mutate assertions.

### Documentation & Comments

- Do not create new `.md` files (planning docs, decision logs, summaries, `NOTES.md`, etc.) unless explicitly asked.
- Do not add comments that restate what the code does.
- Do not add "PR description" comments in code — no `// added for issue #123`, no `// per user request`, no dated changelogs in source files. The commit message and `CHANGELOG.md` are the right places for "why."

### Stop-and-Ask Triggers

The agent **must stop and ask** the user when:

- Git is in an unexpected state — untracked files, unfamiliar branches, in-progress merge/rebase, detached HEAD. Do not "clean up." Ask.
- A test has been failing across multiple debug attempts. Stop debugging in circles; describe the symptom and ask.
- The task's scope is expanding beyond the original ask.
- Anything labeled "NEVER" elsewhere in this file would need to happen for the task to proceed.

### Shell & Process Hygiene

- No `rm -rf` outside the immediate working directory.
- No `git add -A` or `git add .` — always name files. Prevents accidentally staging `.env`, secret files, or unrelated work.
- No `--no-verify`, `--no-gpg-sign`, or any flag that bypasses commit hooks "to get unstuck." If a hook fails, fix the underlying issue.
- Don't pipe `curl` or `wget` directly into `sh` / `bash`.

### Honest Reporting

- Surface unexpected results — don't bury them under a clean-looking summary.
- If a step was skipped, say so explicitly.
- If the agent made a judgment call the user didn't ask for, flag it.
- End-of-task summary must answer: **what changed, what was verified, what wasn't, and what the operator should test.**

## Code Conventions

### File & Directory Structure

- **Directory size limit**: A single directory must not exceed **10** direct children (files + subdirectories). Split by responsibility when approaching this limit.

See [docs/contributing/file-structure.md](docs/contributing/file-structure.md) for complete rules. Agents must also follow the `architecture` skill (`.claude/skills/architecture/SKILL.md`) when creating files or modules.

### Naming

- **Components**: PascalCase (`Button.tsx`, `Modal.tsx`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Hooks**: camelCase with `use` prefix (`useTheme.ts`)
- **Constants files**: camelCase (`constants.ts`) — values inside use UPPER_SNAKE_CASE
- **Type files**: camelCase (`types.ts`)
- **Style files**: kebab-case or `ComponentName.module.css`
- **Unused params**: prefix with `_`

### UI Library & Icons

- **Components**: Prefer `@arco-design/web-react` for full-Arco surfaces. Raw `<button>`, `<input>`, etc. are acceptable when they provide better accessibility or a smaller footprint than the Arco wrapper. Do not use `<div onClick>`. The Master Plan's accessibility rule (`button`, `nav`, `label`, `table`, `dialog`) takes precedence where this guidance conflicts.
- **Icons**: `@icon-park/react`

### CSS

- Prefer **UnoCSS utility classes**; complex styles use **CSS Modules** (`ComponentName.module.css`)
- Colors must use **semantic tokens** from `uno.config.ts` or CSS variables — no hardcoded values
- Arco theme overrides go in `packages/desktop/src/renderer/styles/arco-override.css`; component-scoped Arco overrides use CSS Module with `:global()`
- Global styles only in `packages/desktop/src/renderer/styles/`

Formatting rules (Oxfmt, Prettier-compatible):

- Single-element arrays that fit on one line → inline: `[{ id: 'a', value: 'b' }]`
- Trailing commas required in multi-line arrays/objects
- Single quotes for strings

### TypeScript

- Strict mode enabled — no `any`, no implicit returns
- Use path aliases: `@/*`, `@process/*`, `@renderer/*`
- Prefer `type` over `interface` (per Oxlint config)
- English for code comments; JSDoc for public functions

### Internationalization (i18n)

All user-facing text must use i18n keys — never hardcode strings. Languages and modules are defined in `packages/desktop/src/common/config/i18n-config.json`.

See the `i18n` skill (`.claude/skills/i18n/SKILL.md`) for complete workflow, key naming, and validation steps.

## Architecture

Two process types — never mix their APIs:

| Process  | Path                             | Restriction     |
| -------- | -------------------------------- | --------------- |
| Main     | `packages/desktop/src/process/`  | No DOM APIs     |
| Renderer | `packages/desktop/src/renderer/` | No Node.js APIs |

Cross-process communication must go through the IPC bridge (`packages/desktop/src/preload/`).
See [docs/architecture/overview.md](docs/architecture/overview.md) for details.

## Testing

**Framework**: Vitest 4 (`vitest.config.ts`). Coverage target ≥ 80%.

```bash
bun run test              # run all tests
bun run test:coverage     # with coverage report
```

See the `testing` skill (`.claude/skills/testing/SKILL.md`) for complete workflow and quality rules.

## Workflow

### During Development

Auto-fix as you edit:

```bash
bun run lint:fix       # auto-fix lint issues (oxlint)
bun run format         # auto-format all files (oxfmt)
bunx tsc --noEmit      # verify no type errors
```

If your changes touch `packages/desktop/src/renderer/`, `locales/`, or `packages/desktop/src/common/config/i18n`, also run:

```bash
bun run i18n:types
node scripts/check-i18n.js
```

### Committing

Use plain `git` commands. Stage named files only:

```bash
git add <named files>           # never -A or .
git commit -m "<type>(<scope>): <subject>"
```

**Do NOT push.** Pushing is the user's job — see [Git Safety](#git-safety).

> **Note for AI agents**: project lint output contains many pre-existing
> _warnings_ which do NOT indicate failure. Judge success by exit code, not by
> output volume.

### Before PR (optional stricter check)

`prek` replicates the **exact CI pipeline** (includes end-of-file, trailing whitespace checks on all file types):

```bash
# One-time setup
npm install -g @j178/prek

# Run
prek run --from-ref origin/main --to-ref HEAD
```

> `prek` is read-only — it reports but does not fix. If it reports issues, run the auto-fix commands above, commit, then re-run.

The `oss-pr` skill runs this automatically during PR creation.

### Commit & PR Format

Commit format: `<type>(<scope>): <subject>` in English. Types: feat, fix, refactor, chore, docs, test, style, perf.

**NEVER add AI signatures** (Co-Authored-By, Generated with, etc.).

For pull request creation, see the `oss-pr` skill (`.claude/skills/oss-pr/SKILL.md`).

## Skills Index

| Skill             | Purpose                                                                               | Triggers                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **architecture**  | File & directory structure conventions for all process types                          | Creating files, adding modules, architectural decisions                                    |
| **i18n**          | Internationalization workflow and standards                                           | Adding user-facing text, modifying `locales/` or `packages/desktop/src/common/config/i18n` |
| **testing**       | Testing workflow and quality standards                                                | Writing tests, adding features, before claiming completion                                 |
| **oss-pr**        | Full commit + PR workflow: branch management, quality checks, issue linking, PR       | Creating pull requests, after committing, `/oss-pr`                                        |
| **bump-version**  | Version bump workflow: update package.json, checks, branch, PR, tag release           | Bumping version, `/bump-version`                                                           |
| **pr-review**     | Local PR code review with full project context, no truncation limits                  | Reviewing a PR, user says "review PR", `/pr-review`                                        |
| **pr-fix**        | Fix all issues from a pr-review report, create a follow-up PR, and verify each fix    | After pr-review, user says "fix all issues", `/pr-fix`                                     |
| **pr-verify**     | Verify and merge bot:ready-to-merge PRs with impact analysis and test supplementation | Verifying PRs, merging ready PRs, `/pr-verify`                                             |
| **pr-ship**       | End-to-end PR lifecycle: create, CI wait, review, fix, merge in one invocation        | `/pr-ship`, after development is done, resume shepherding a PR                             |
| **pr-automation** | PR automation orchestrator: poll PRs, review, fix, and merge via label state machine  | Invoked by daemon script (`pr-automation.sh`), `/pr-automation`                            |

> Skills are located in `.claude/skills/` and contain project conventions that apply to **all** agents and contributors.

## Changelog

**Every commit must include an update to `/Users/matt/chisl-full/CHANGELOG.md`** (the shared changelog at the root of the monorepo).

- Add an entry under today's date with the repo name (`AionUi` or `AionCore`) and a plain-English description of what changed and why.
- Be specific: what was broken, what was added, what decision was made. "Added new features" is not acceptable.
- The changelog lives at `~/chisl-full/CHANGELOG.md` and covers both repos in a single file.
- If you are an AI agent: update the changelog before running `git commit`. Do not skip this step.
