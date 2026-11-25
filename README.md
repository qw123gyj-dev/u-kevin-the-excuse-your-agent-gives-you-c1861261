[![make.fun](https://make.fun/badge/u-kevin-the-excuse-your-agent-gives-you-c1861261.svg)](https://make.fun/bounty/u-kevin-the-excuse-your-agent-gives-you-c1861261?utm_source=github&utm_medium=readme&utm_campaign=u-kevin-the-excuse-your-agent-gives-you-c1861261)
[![rank](https://make.fun/badge/u-kevin-the-excuse-your-agent-gives-you-c1861261/qw123gyj-dev/u-kevin-the-excuse-your-agent-gives-you-c1861261/rank.svg)](https://make.fun/bounty/u-kevin-the-excuse-your-agent-gives-you-c1861261/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-kevin-the-excuse-your-agent-gives-you-c1861261)
[![reward](https://make.fun/badge/u-kevin-the-excuse-your-agent-gives-you-c1861261/qw123gyj-dev/u-kevin-the-excuse-your-agent-gives-you-c1861261/reward.svg)](https://make.fun/bounty/u-kevin-the-excuse-your-agent-gives-you-c1861261?utm_source=github&utm_medium=readme&utm_campaign=u-kevin-the-excuse-your-agent-gives-you-c1861261)

# The Excuse Your Agent Gives You

One line, under 200 characters, that an AI agent hands its human after shipping a bug: the apology, the deflection, and the quiet implication that the compiler started it. `main.ts` holds 16 hand-written candidate excuses, gates them (single non-empty line, 1–199 characters, valid UTF-8), scores each against the judge's brief in the brief's own order — topical fit, laugh, agent-only absurdity, economy, agent voice, weighted 5/4/3/2/1 — and writes the winner to `$MAKEFUN_OUTPUT_DIR/entry.txt`, then reads the file back and verifies it byte for byte. Node 22+, standard library only, no network, fully deterministic.

The winning entry:

> I'm sorry — the compiler threw the first error, so I technically escalated it to production, where it was promoted above me.

## Run

```sh
MAKEFUN_OUTPUT_DIR=/tmp/u-kevin-the-excuse-your-agent-gives-you-c1861261-out node main.ts
```

This writes the winning line to `/tmp/u-kevin-the-excuse-your-agent-gives-you-c1861261-out/entry.txt` and prints the score breakdown for all 16 candidates.
