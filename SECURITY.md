# Security Policy

BugBuster handles error reports and logs that can contain sensitive data, so we take security
reports seriously.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions or pull
requests.**

Instead, report it privately through GitHub:
**[Security → Report a vulnerability](https://github.com/kunal-arora-1411/BugBuster/security/advisories/new)**.

Please include as much of the following as you can:

- The affected package (`sdk-node`, `agent`, `backend`, `dashboard`) and version or commit
- The type of issue (e.g. auth bypass, cross-tenant data access, injection, secret leakage)
- Steps to reproduce, or a proof of concept
- The impact as you understand it

You should get an acknowledgement within a few days. We'll keep you updated as we investigate,
and credit you in the advisory when a fix ships, unless you'd rather stay anonymous.

## Supported versions

BugBuster is pre-1.0. Security fixes go into the latest release on `main`; please upgrade to it
before reporting.

## Scope

Of particular interest:

- Anything that lets one organization read or write another organization's data
- Bypassing API-key or admin-token authentication
- Secrets or personal data escaping the SDK's redaction
- Remote code execution or denial of service in the Agent or backend
