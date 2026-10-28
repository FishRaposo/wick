# Security

Wick is a static browser game with no backend, accounts, analytics or runtime dependencies. It stores a best score, settings and a local run save in `localStorage`.

## Reporting

Please report a suspected vulnerability privately through GitHub's **Security → Report a vulnerability** flow rather than a public issue. Include the browser, the steps and what an attacker could do. There is no bug bounty.

## Scope

Useful reports include script injection through a crafted save, a storage read that crashes the game, and a dependency or build-script compromise. A game rule being exploitable for a higher score is a bug, not a security issue.
