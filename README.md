# LinkChain — on-chain URL shortener on BOT Chain

Register a short slug pointing to any URL, paid for in native BOT. Anyone
can boost a link's visibility ranking for a fee. Both fees flow directly to
a treasury address — genuine, continuous transaction volume in native BOT.

## Why this design is safe by construction

Registration and boosting fees are **simple, one-way payments to a
treasury** - never pooled, never redistributed to other users, never tied
to anyone else's payout. This deliberately avoids the structural risk that
shows up elsewhere in this project set (see The Card's oracle-risk
disclosure, or BOOST's reasoning for why points carry no redemption
value): a "pay to boost" mechanic only becomes risky if the fees get
funneled into rewards for other participants, creating a Ponzi-shaped
dependency on new fee-payers to fund existing ones. That never happens
here. A boost fee just... goes to the treasury. That's the whole
mechanism.

**Slug registration is permissionless and first-come-first-served** - the
same model as domain names, ENS names, or any naming registry. This is a
standard, well-understood pattern, not a design gap. There's no way to
reserve a slug in advance or prevent someone else from registering a
string you wanted; that's true of every system built this way.

## Contract behavior

- `registerSlug(slug, targetURL)` — pays the current `registrationFee`
  in full to the treasury. Slugs are capped at 32 characters and must be
  unique.
- `boostLink(slug)` — pays the current `boostFee` to the treasury,
  increments the link's boost count. Anyone can boost any registered link,
  including the slug's own owner.
- `updateTargetURL(slug, newTargetURL)` — slug-owner-only, lets you
  redirect an existing link to a new destination without re-registering.
- `setFees(newRegistrationFee, newBoostFee)` — owner-only. Fees are
  adjustable after deployment (set to whatever's appropriate for your
  launch), including down to zero if you want registration to be free at
  some point.

## Setup

```bash
npm install
cp .env.example .env    # paste your TEST wallet's private key
npm run compile
npm test                 # covers registration and boosting fee enforcement,
                          # duplicate-slug rejection, the slug length cap,
                          # ownership-gated target URL updates, and
                          # confirms fees are forwarded to the treasury
                          # exactly, every time
npm run deploy:testnet
```

The deploy script sets both the owner and the treasury to your deployer
wallet by default, with a starting registration fee of 0.01 BOT and boost
fee of 0.005 BOT - edit `scripts/deploy.js` before deploying if you want a
different treasury address or starting fees.

Then set `CONTRACT_ADDRESS` in `index.html`, and pick the right
`BOT_NETWORK` block (testnet by default).

## What's solid, and what to know about the rest

- Full test coverage on fee enforcement (exact amounts required for both
  registration and boosting), duplicate-slug prevention, the length cap,
  ownership-gated URL updates, and - specifically - confirming the
  treasury actually receives every fee, exactly. Verified via direct
  `solc` compile in the environment this was built in; run `npm test`
  yourself to confirm.
- No content moderation exists on target URLs - anyone can register a
  slug pointing anywhere, including to something harmful or illegal. If
  this goes live with real users, that's worth thinking through the same
  way Spill's moderation design was: since nothing can be truly deleted
  on-chain, any moderation would need to happen at the display/frontend
  layer (e.g. not rendering certain slugs by default), not by pretending
  the contract can remove anything.
- Unaudited, like the rest of this project set - though this one carries
  meaningfully lower financial risk than most others here, since it's a
  simple fee-for-service model with funds always flowing one direction,
  never pooled or owed back to anyone.
