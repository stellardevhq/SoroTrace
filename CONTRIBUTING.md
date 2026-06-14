# Contributing to SoroTrace

Thank you for your interest in contributing. This document explains how to find something to work on, how to submit a pull request, and what to expect during review. Please read it before opening a PR.

---

## Table of Contents

1. [Code of Conduct](#1-code-of-conduct)
2. [Finding Something to Work On](#2-finding-something-to-work-on)
3. [Before You Start](#3-before-you-start)
4. [Setting Up the Project Locally](#4-setting-up-the-project-locally)
5. [Branching](#5-branching)
6. [Commit Message Format](#6-commit-message-format)
7. [Pull Request Checklist](#7-pull-request-checklist)
8. [PR Naming Convention](#8-pr-naming-convention)
9. [Requesting a Review](#9-requesting-a-review)
10. [After Your PR Is Merged](#10-after-your-pr-is-merged)
11. [Open Design Questions](#11-open-design-questions)

---

## 1. Code of Conduct

Be respectful and constructive. We welcome contributors of all experience levels. If something in this guide is unclear, open a [GitHub Discussion](https://github.com/stellardevhq/SoroTrace/discussions) and ask: improving this document is itself a valid contribution.

---

## 2. Finding Something to Work On

All work is tracked in [GitHub Issues](https://github.com/stellardevhq/SoroTrace/issues). We use the following labels:

| Label | Meaning |
| ----- | ------- |
| `good first issue` | Small, well-scoped tasks that are suitable for first-time contributors |
| `bug` | Something is broken or behaving incorrectly |
| `enhancement` | A new feature or improvement to existing behaviour |
| `documentation` | Changes to docs only: no code required |
| `needs-decision` | Blocked on a design or product decision before work can begin |
| `in progress` | Already assigned and being worked on: pick something else |

**Start with `good first issue` if this is your first contribution.** Filter the issue list by that label [here](https://github.com/stellardevhq/SoroTrace/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22).

If you want to work on something that has no issue yet, open one first and describe what you plan to do. Wait for a maintainer to confirm the direction before writing code — this avoids wasted effort.

---

## 3. Before You Start

1. **Comment on the issue** to let others know you are working on it. A maintainer will assign it to you.
2. **Read the issue fully.** If anything is unclear, ask in the issue comments before starting.
3. **Check the PR list** to make sure nobody is already working on the same thing.

---

## 4. Setting Up the Project Locally

Follow the full local setup guide in [README.md](README.md#local-setup). Make sure `pnpm typecheck`, `pnpm lint`, and `pnpm build` all pass before making changes. If they do not pass on a fresh clone, open a bug report.

---

## 5. Branching

Fork the repository to your own GitHub account, then create a branch from `main`:

```bash
# Clone your fork
git clone https://github.com/<your-username>/SoroTrace.git
cd SoroTrace

# Add the upstream remote so you can pull in future changes
git remote add upstream https://github.com/stellardevhq/SoroTrace.git

# Create a branch for your work
git checkout -b <type>/<short-description>
```

**Branch naming format:** `<type>/<short-description>`

| Type | When to use |
| ---- | ----------- |
| `feat` | Adding a new feature |
| `fix` | Fixing a bug |
| `docs` | Documentation changes only |
| `chore` | Tooling, config, dependency updates |
| `refactor` | Code restructuring with no behaviour change |
| `test` | Adding or updating tests |

Examples:
- `feat/contract-explorer-search`
- `fix/transaction-debugger-null-xdr`
- `docs/contributing-guide`
- `chore/upgrade-turbo-v2`

Keep branches focused on a single issue. If you find an unrelated bug while working, open a separate issue and a separate PR for it.

---

## 6. Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. Every commit message must have this structure:

```
<type>(<scope>): <short description>

[optional body]

[optional footer — e.g. Closes #42]
```

**Rules:**
- Use the imperative mood in the short description: "add search endpoint", not "added" or "adds".
- Keep the first line under 72 characters.
- Reference the related issue in the footer: `Closes #<issue-number>`.
- The `scope` is the package or app affected: `api`, `web`, `types`, `ui`, `soroban-parser`, `stellar-sdk-utils`, `scanner-rules`, `ci`, `docs`.

**Examples:**

```
feat(api): add contract search endpoint with pagination

Implements GET /contracts?q= with full-text search against contract
address, name, and ABI fields. Results are paginated at 20 per page.

Closes #12
```

```
fix(soroban-parser): handle null XDR in transaction decoder

The decoder previously threw when the XDR field was null on failed
transactions. Now returns an empty result set instead.

Closes #37
```

```
docs(contributing): add branching and commit message guide

Closes #45
```

---

## 7. Pull Request Checklist

Before marking your PR as ready for review, confirm all of the following:

- [ ] `pnpm typecheck` passes with no errors
- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm build` completes successfully
- [ ] New behaviour is covered by tests, or the PR explains why tests are not applicable
- [ ] All internal links in any documentation changes resolve correctly
- [ ] The PR does not contain unrelated changes (keep scope tight)
- [ ] The PR description explains *what* changed and *why*, not just *how*
- [ ] The linked issue number appears in the PR description or commit footer (`Closes #<n>`)

---

## 8. PR Naming Convention

PR titles follow the same format as commit messages:

```
<type>(<scope>): <short description>
```

Examples:
- `feat(web): add contract search page`
- `fix(api): prevent crash on null XDR input`
- `chore(ci): pin pnpm to 10.4.1`
- `docs(readme): update local setup prerequisites`

GitHub will use the PR title as the squash-merge commit message, so a descriptive title matters.

---

## 9. Requesting a Review

1. **Push your branch** to your fork and open a pull request against `stellardevhq/SoroTrace` on the `main` branch.
2. **Fill in the PR template** completely. A PR with an empty description will be sent back.
3. **Link the issue** in the description: `Closes #<issue-number>` or `Relates to #<issue-number>`.
4. **Request a review** from `@stellardevhq/maintainers` using the Reviewers panel on the right side of the PR page.
5. **Respond to all review comments** before re-requesting a review. Mark resolved threads as resolved only after the change has been made - not before.
6. **Keep the branch up to date** with `main`. If the branch falls behind, rebase it:

```bash
git fetch upstream
git rebase upstream/main
git push --force-with-lease origin <your-branch>
```

---

## 10. After Your PR Is Merged

- The branch will be deleted automatically by GitHub.
- You do not need to do anything else. The CI pipeline builds and deploys on merge to `main`.
- Your name will appear in the commit history. We do not maintain a separate contributors list.
- If you want to keep contributing, sync your fork before starting the next branch:

```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
```

---

## 11. Open Design Questions

SoroTrace has a Feature Requirements Document (FRD) that contains open questions - areas where the intended behaviour has not yet been decided. These are tracked as issues labelled [`needs-decision`](https://github.com/stellardevhq/SoroTrace/issues?q=is%3Aopen+is%3Aissue+label%3Aneeds-decision).

**A pull request must not resolve an open FRD question without a linked issue that records the decision.** If your PR touches an area that is still undecided:

1. Do not make an assumption and proceed.
2. Open a `needs-decision` issue describing the question and the options you see.
3. Wait for a maintainer to make a decision and close the issue with a recorded outcome.
4. Reference that issue in your PR.

This rule exists so that design decisions are visible, searchable, and reversible - not buried inside a diff.
