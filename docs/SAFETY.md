# Safety

## What PELLET does not do

- It does not connect a wallet. There is no wallet connect in the CLI or in the
  browser wrapper.
- It does not sign, send, or queue transactions.
- It does not hold, read or ask for a private key, seed phrase or signing
  credential. No code path in this repository accepts one.
- It does not execute code from anything it reads.
- It does not rate token safety, predict price, or tell you to buy anything.

## What it does do

It reads public state — chain RPC and market data — and prints what it read with
the reasoning attached. That is the whole product.

## Before you act on a screen

**A wake is not an endorsement.** A wallet with a strong record waking up on a
token is one observation. It does not mean the wallet is right, that it is not
exiting, or that it has not been compromised.

**A cleared wall set is not a recommendation.** `CAST` means five specific
conditions held at one moment. It says nothing about whether entering was a good
idea.

**Synthetic rows are labelled, and you should believe the label.** Cached and
night modes generate the stream from the bootstrap set so the terminal is usable
offline and on a screenshare. Those rows are marked in the header, in every
event object, and in every exported pellet. Do not trade a screenshot without
checking which mode produced it.

**A negative desk row is a result.** A token ranking below zero means tracked
wallets took money out during the window. That is information, not a gap.

## Credentials

The optional read credentials are read-only leaderboard keys. Keep them in
`.env`, which is gitignored, and never in the repository or in a screenshot.
`pellet doctor` reports only whether a credential is present, never its value.

## If you wire execution later

This repository has no execution boundary, and adding one is outside its scope.
If you build one elsewhere, keep signing material out of the browser, out of the
process that renders the terminal, and out of any file this project writes.

## Reporting

Open an issue for a defect. For anything credential-related, do not attach logs
or screenshots that include a `.env`, an RPC URL with an embedded key, or a
wallet address you do not want linked to you.
