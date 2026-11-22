# Contributing to BugBuster

Thanks for your interest in BugBuster! There is a lot still to build — the SDK, the Agent, the
backend, the dashboard and the docs all have open work — and contributions of every size are
welcome.

By participating you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Finding something to work on

- **[`good first issue`](https://github.com/kunal-arora-1411/Debuginator/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)** —
  small, self-contained tasks with a clear "done when". The best place to start.
- **[`help wanted`](https://github.com/kunal-arora-1411/Debuginator/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)** — larger
  pieces, often from the roadmap (the dashed boxes in the README's architecture diagram).
- Found a bug or have an idea that isn't filed yet? [Open an issue](https://github.com/kunal-arora-1411/Debuginator/issues/new/choose) first.

**Before you start coding, comment on the issue** to say you're taking it, so two people don't
build the same thing. For anything bigger than a bug fix, describe your approach in the issue and
wait for a thumbs-up — it saves you from writing a PR that goes in a different direction than the
project.

## Setting up

**Prerequisites:** Node.js ≥ 22.15 (the Agent and backend use Node's built-in zstd), pnpm 10+,
and Docker (or any MongoDB on `localhost:27017`) if you want to run the full pipeline by hand.

```bash
git clone https://github.com/<your-username>/BugBuster.git
cd BugBuster
pnpm install
pnpm build
pnpm test:unit
```

To run the whole pipeline locally — SDK → Agent → backend → MongoDB → dashboard — follow
[Developing BugBuster locally](README.md#developing-bugbuster-locally) in the README.

## The repo at a glance

| Package | What lives there |
|---|---|
| [`packages/types`](packages/types) | The wire-format contract shared by every package. Change it carefully — everything depends on it. |
| [`packages/sdk-node`](packages/sdk-node) | The SDK inside the user's process: hot path, fingerprinting, the in-process fold, logs. |
| [`packages/agent`](packages/agent) | The host-local daemon: cross-process merge, compression, retries, circuit breaker, spool. |
| [`packages/backend`](packages/backend) | Ingest + Query API, multi-tenant MongoDB, alerts, the admin page. |
| [`packages/dashboard`](packages/dashboard) | The read-only viewer for issues and logs. |
| [`examples/`](examples) | An instrumented demo app and the end-to-end pipeline tests. |

**Before changing the core design** (the hot path, the fold, sampling, the Agent, backpressure),
read [`docs/architecture/ingest-pipeline.md`](docs/architecture/ingest-pipeline.md). It explains
why things are built the way they are, and §10 lists what is deliberately *not* built yet and what
would justify building it.

## Making a change

1. Fork the repo and create a branch from `main`: `git checkout -b fix/short-description`.
2. Make your change, with tests. Bug fixes should include a test that fails without the fix.
3. Run the same checks CI runs:

   ```bash
   pnpm format:check     # or `pnpm format` to fix
   pnpm lint
   pnpm typecheck
   pnpm build
   pnpm test:unit
   pnpm test:integration # downloads a real mongod the first time; no Docker needed
   ```

4. Update the docs (README, `docs/`) if you changed behavior, configuration or an API. If you
   changed the Query API, regenerate the OpenAPI spec:
   `pnpm --filter @bugbusterhq/backend openapi`.
5. Open a pull request against `main` and fill in the template. Link the issue it closes
   (`Closes #123`).

### Pull request guidelines

- **One concern per PR.** A focused 100-line PR gets reviewed in a day; a 2,000-line one waits.
- **Write commit messages that say what and why**, in the imperative: "Retry spooled batches
  after the circuit closes", not "fixed stuff".
- **Keep the hot path fast.** The SDK's capture path has a budget of a few microseconds; changes
  there should come with a benchmark (`pnpm bench`).
- **Never log or store secrets.** Redaction exists for a reason — keep new fields inside it.
- CI must be green before a PR is merged. A maintainer will review, may ask for changes, and will
  merge once it's ready.

## Reporting bugs and requesting features

Use the [issue templates](https://github.com/kunal-arora-1411/Debuginator/issues/new/choose). For bugs, the most useful things to include
are: what you ran, what you expected, what happened instead, and your Node/OS/package versions.

**Security vulnerabilities are different** — please don't open a public issue. See
[SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the project's
[MIT License](LICENSE).
