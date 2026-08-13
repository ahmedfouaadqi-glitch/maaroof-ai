# MAAROOF Unresolved Conflicts

## 1. GitHub/Lovable authentication

The local Manus session has a GitHub connector entry, but it is disabled. The Lovable screenshot previously showed GitHub as `Not connected` before the user configured the project rule. The branch is therefore prepared locally, but a successful push and Lovable pull/sync still require a verified connection in the user's Lovable project or an authenticated GitHub push path.

## 2. Deployment trigger

The repository has no visible GitHub Actions workflow and the public inspection did not prove that a GitHub push deploys `maaroofai.com`. The domain is managed through Lovable/Cloudflare. This branch must be reviewed in Lovable Preview; it must not be assumed to be live until Lovable reports a successful sync and Preview build.

## 3. Lint debt

The repository-wide lint command fails before and after this branch because of extensive existing formatting and `no-explicit-any` findings. The branch implementation passes tests, typecheck, build, and diff checks, but the repository cannot be described as lint-clean without a separate lint-remediation project.

## 4. Browser, Omni Router, and Google Drive

No runtime proof was found for a Browser Operator, Omni Router adapter, or Google Drive memory provider. These remain intentionally out of this first slice. Adding them now would be an unverified integration, not a safe completion of the current change.

## 5. Authenticated Preview

The branch has not yet been validated through a real signed-in user/workspace in Lovable Preview. This is the final technical gate before any production Publish. It must cover a normal execution, explicit recommendation, explicit simulation, a disabled tool, and a workspace-scope check.
