# Security policy

## Scope

PELLET reads public state and prints it. It has no wallet connect, no signing
path, no execution boundary, and no code path that accepts a private key or seed
phrase. The browser wrapper binds to loopback and is read-only.

## Reporting a vulnerability

Open a private security advisory on this repository. Please include the command
or endpoint, the Node version, and what you expected instead.

Do not attach a `.env`, an RPC URL with an embedded key, or a wallet address you
would rather not have linked to you.

## What counts

In scope: anything that causes the process to write outside `PELLET_DATA_DIR`,
execute content fetched from a provider, leak a credential into output or logs,
or bind the web wrapper beyond loopback.

Out of scope: a provider being down, a market number being stale, or a `CAST`
that did not work out. Those are documented behaviours, not defects.
