# Git conventions

Repository: `https://github.com/melakhaa/Therapy-Chatbot.git`. Default branch `main`.
**No CI configuration exists** (no `.github/`) — run builds/tests locally before opening a PR.

## Commit messages — Conventional Commits v1.0.0

All commits follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>[(scope)][!]: <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Use for |
|------|---------|
| `feat` | a new feature (user-visible) |
| `fix` | a bug fix (user-visible) |
| `docs` | documentation only |
| `style` | formatting, no code behavior change |
| `refactor` | code change that neither fixes a bug nor adds a feature |
| `perf` | performance improvement |
| `test` | adding or fixing tests |
| `build` | build system or dependencies (npm, requirements, native) |
| `ci` | CI configuration |
| `chore` | maintenance not covered above |
| `revert` | revert a previous commit |

### Rules enforced by the hook

- `type` must be one of the list above, lowercase.
- `scope` is optional and, when present, lowercase `[a-z0-9._/-]` — e.g. `feat(auth): ...`,
  `refactor(chatbot/rag): ...`. Scope is a module/area, not a file path.
- `!` before the colon marks a **breaking change**: `feat(api)!: drop v1 endpoints`.
- `description` is non-empty, starts immediately after `: `, and does **not** end with a period.
- Subject is at most **100 characters**.
- Merge, `Revert ...`, `fixup! ...`, `squash! ...`, and empty messages are passed through.

### Body & footers

- Separate the subject from the body with one blank line; wrap the body at ~72 columns.
- Explain **why**, not what (the diff shows what).
- Reference issues in a footer, e.g. `Refs: #12` / `Closes: #12`.
- State breaking changes in a footer too:
  ```
  feat(api)!: drop v1 endpoints

  BREAKING CHANGE: clients must migrate to /v2 before release.
  ```

### Attribution

- **No AI co-author trailers.** Do not add `Co-authored-by: Claude ...` (or any other tool) to a
  commit. GitHub credits co-authors in the repository contributors graph, so tooling stays out of
  commit messages — commits are credited to their human author only.

### Examples

```
feat(auth): add OTP password reset
fix(mobile): reset chat scroll on session change
docs(readme): document Ollama prerequisites
chore(deps): bump expo to SDK 54
refactor(backend): extract severity thresholds
feat(api)!: require service key for account admin routes
```

## Atomic commits

- One logical change per commit — usually one feature or layer, not one file. A schema rename,
  its backend adoption, and each frontend adoption are separate commits.
- A commit never exists to repair an earlier commit on the same branch: fold the correction
  into the commit it belongs to (`git commit --fixup <sha>` + `git rebase --autosquash`) before
  the PR.
- The scope in the message must match what the commit touches (`refactor(mobile): ...` touches
  `apps/mobile` only); rename collateral stays with the layer that caused it.
- Feature branches may be force-pushed with `--force-with-lease` after a history cleanup;
  `main` is never rewritten.

## Enforcement (dependency-free hook)

`.githooks/commit-msg` validates messages; `.githooks/commit-msg.test.sh` is its self-check.

```bash
# wired automatically by `npm install` (root package.json "prepare" script)
git config core.hooksPath .githooks

# run the validator's tests
sh .githooks/commit-msg.test.sh

# bypass once for a WIP commit
git commit --no-verify
```

No husky/commitlint dependency is used — git's native `core.hooksPath` is enough.

## Branches & PRs

- Feature branches merged via **pull requests** to `main` (history is full of
  `Merge pull request #N from melakhaa/<branch>`).
- Use lower-kebab-case branch names: `add-docs`, `fix-readme`, `refactor-folder-structure`.
- Keep one focused feature per branch/PR; PR title should itself read like a conventional commit.
- No enforced commit format beyond the hook. Tests are manual runners, not CI: `npm test`
  (unit tier), `npm run test:integration`, `npm run test:e2e` — run the tiers your change
  touches before opening a PR, and write the test first with the `tdd` skill
  ([testing-conventions.md](testing-conventions.md)).

## Ignored / never commit

`.gitignore` excludes `node_modules/`, `.expo/`, `dist/`, `web-build/`, `expo-env.d.ts`,
native build output (`/apps/mobile/ios`, `/apps/mobile/android`, keystores, `*.pem`),
Python (`__pycache__/`, `.venv/`, `venv/`, `env/`), `.DS_Store`, `*.tsbuildinfo`, and
**env files** (`.env*.local`) — never commit secrets ([security-conventions.md](security-conventions.md)).
Install from the repo root, not inside an app ([npm-workspaces-conventions.md](npm-workspaces-conventions.md)).
