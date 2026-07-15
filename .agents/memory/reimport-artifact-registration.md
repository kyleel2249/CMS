---
name: Re-registering artifacts after a GitHub re-import
description: What to do when a re-imported repo has artifact directories and committed .replit-artifact/artifact.toml files, but listArtifacts() returns empty and no workflows exist.
---

After a project is re-imported from GitHub, the platform's artifact/workflow registry starts empty even if `artifacts/<slug>/.replit-artifact/artifact.toml` files are still present and committed in the repo. `listArtifacts()` returns `[]` and `WorkflowsRestart` fails with "doesn't exist" for the expected names.

`createArtifact()` cannot fix this — it refuses to run against a slug whose directory already exists (`ARTIFACT_DIR_EXISTS`), and the artifact code is already correct, so recreating it would be wrong anyway.

**Fix:** for each affected artifact, read its existing `artifact.toml`, write the *unchanged* content to a sibling temp file (e.g. `.replit-artifact/artifact.edit.toml`), then call `verifyAndReplaceArtifactToml({ tempFilePath, artifactTomlPath })`. Writing back identical, valid TOML through this callback is enough to trigger re-registration — it adds the artifact and its managed workflow(s) with no code changes.

**Why:** the registry is server-side state separate from the repo contents; re-import doesn't replay it, but pushing a validated TOML through the platform's write path does.

**How to apply:** if a re-imported (or otherwise freshly-cloned) repo has no workflows configured yet but `.replit-artifact/artifact.toml` files exist on disk, try this re-sync before touching `.replit`, before calling `configureWorkflow`, and before assuming the project needs to be rebuilt from scratch.
