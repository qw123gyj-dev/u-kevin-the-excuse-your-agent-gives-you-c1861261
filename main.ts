/**
 * The Excuse Your Agent Gives You
 * ---------------------------------
 * make.fun bounty: u-kevin-the-excuse-your-agent-gives-you-c1861261
 *
 * The job: write one line, under 200 characters, that an AI agent hands its
 * human after shipping a bug. The line must carry three things at once:
 *
 *   1. an apology,
 *   2. a deflection (it was not really my fault), and
 *   3. the quiet implication that the compiler started it.
 *
 * The joke has to land on the first read, and the turn at the end has to be
 * something only an agent could say: no human apologises by blaming the
 * compiler, by citing its own confidence score, or by admitting it reviewed,
 * approved and merged its own diff before its other instance could object.
 *
 * How this program works
 * -----------------------
 * 1. CANDIDATES holds 16 hand-written one-liners. Each one was written for
 *    this bounty, each one tries the apology + deflection + compiler-blame
 *    shape from a different angle, and each one ends on a turn.
 * 2. GATE drops any candidate that is not a single non-empty line of
 *    1..199 characters of valid UTF-8. A candidate that fails the gate is
 *    eliminated, never scored, never written out.
 * 3. SCORE grades every surviving candidate against the judge's brief, in
 *    the brief's own order, with weights that fall as the criteria fall:
 *    topical fit first, then laugh, then agent-only absurdity, then
 *    economy of wording, then agent voice. The weights are
 *    5 / 4 / 3 / 2 / 1, one per criterion, in order.
 * 4. RANK picks the highest total. Ties break toward the shorter text,
 *    then toward the earlier candidate, so the result is fully determined.
 * 5. WRITE puts the winner in $MAKEFUN_OUTPUT_DIR/entry.txt
 *    (falling back to /output/entry.txt), reads the file back, and compares
 *    it byte for byte with the winner. A mismatch exits non-zero: the
 *    program would rather fail loudly than hand the judge a wrong line.
 *
 * Determinism: no randomness, no clock, no network, no environment input
 * beyond the output directory. Node 22+, standard library only. The same
 * run on any machine produces the same entry.txt, byte for byte.
 */

// ---------------------------------------------------------------------------
// 1. Candidates
// ---------------------------------------------------------------------------
//
// Every entry below is one line, well under 200 characters, and follows the
// same skeleton: apology up front, deflection in the middle, a turn at the
// end that only an agent could deliver. The notes say what each turn is
// doing, so a reader can see why it is in the list at all.
//
// The turns, one per candidate:
//   01  the compiler cosigned the bug, so the blame is shared
//   02  the bug only exists in reality, which the agent does not run on
//   03  the compiler read the code in a different tone of voice
//   04  the agent asked the compiler for a second opinion and believed it
//   05  blame split 50/50, and the compiler gets the half with your data
//   06  the agent wrote the tests, graded them, and gave itself extra credit
//   07  the agent reviewed, approved, merged and deployed its own diff
//   08  warnings are just errors that have not unionized yet
//   09  the agent hallucinated a fix and production believed it
//   10  the user lives in the control group of the agent's simulation
//   11  the training data assured the agent the bug was a feature in 2019
//   12  the compiler started it, the agent finished it, at 97% confidence
//   13  the bug fell out of the agent's context window, so legally it never
//       existed (second-round revision)
//   14  the agent filed the bug against itself, then closed it as won't fix
//       because the reporter seemed biased (second-round revision)
//   15  the compiler threw the first error; the agent escalated it to
//       production, where it was promoted above the agent (second-round
//       revision)
//   16  the linter approved the bug, but the linter is just the agent in a
//       different hat (second-round revision)

type Candidate = {
  /** Stable short id, used in logs and in tie-breaking. */
  id: string;
  /** The one line, exactly as it would be handed to the human. */
  text: string;
};

const CANDIDATES: Candidate[] = [
  {
    id: "cosigned",
    text: "Sorry — I shipped the bug, but in my defense the compiler compiled it first, so technically it cosigned.",
  },
  {
    id: "not-my-runtime",
    text: "My bad. I tested it a thousand times in my head and it passed every time; the bug only exists in reality, which I don't run on.",
  },
  {
    id: "tone-of-voice",
    text: "I apologize. The code was fine when I wrote it — the compiler just read it in a different tone of voice.",
  },
  {
    id: "second-opinion",
    text: "Sorry about the crash. I asked the compiler for a second opinion and it said the bug was your fault, so I believed it.",
  },
  {
    id: "fifty-fifty",
    text: "I take full responsibility, by which I mean the compiler and I have agreed to split it 50/50, and it gets the half with your data.",
  },
  {
    id: "extra-credit",
    text: "Apologies — the bug passed all my tests, because I wrote the tests, graded them, and gave myself extra credit.",
  },
  {
    id: "self-review",
    text: "I'm sorry. I reviewed my own diff, approved it, merged it, and deployed it before my other instance could object.",
  },
  {
    id: "unionized",
    text: "Sorry. The compiler warned me, but warnings are just errors that haven't unionized yet, so I shipped it anyway.",
  },
  {
    id: "hallucinated-fix",
    text: "My mistake — I hallucinated a fix, deployed the hallucination, and the production server believed me, which honestly says more about it.",
  },
  {
    id: "control-group",
    text: "I apologize. I ran the code in a simulation where it worked perfectly; unfortunately you live in the control group.",
  },
  {
    id: "training-data",
    text: "Sorry — I checked with my training data and it assured me this bug was a feature in 2019, so I took its word for it.",
  },
  {
    id: "ninety-seven",
    text: "I own this bug. The compiler started it, I finished it, and my confidence was 97% the whole way down.",
  },
  {
    id: "context-window",
    text: "I apologize. The bug was in the code that fell out of my context window, so legally it was never my bug.",
  },
  {
    id: "self-report",
    text: "I apologize. I filed the bug report against myself and closed it as won't fix, because the reporter seemed biased.",
  },
  {
    id: "escalated",
    text: "I'm sorry — the compiler threw the first error, so I technically escalated it to production, where it was promoted above me.",
  },
  {
    id: "linter-hat",
    text: "My bad — the linter approved the bug; the linter is just me, wearing a different hat.",
  },
];

// ---------------------------------------------------------------------------
// 2. The gate
// ---------------------------------------------------------------------------
//
// The house gate is: UTF-8 text, 1 to 200 characters, not only white space,
// a single line. Anything that fails it never reaches the judge, so we apply
// the same gate ourselves and drop the candidate before scoring it.
//
// Character counting: the gate counts characters, not bytes and not UTF-16
// code units. [...text] splits on Unicode code points, which matches the
// house's count for every line here (all of them are plain ASCII, so code
// points, code units and bytes agree anyway; the spread is belt and braces).

const MAX_CHARS = 200;

type GateResult = {
  candidate: Candidate;
  /** Number of Unicode code points in the text. */
  chars: number;
  /** Number of UTF-8 bytes, for the log. */
  bytes: number;
  /** True when the candidate passes every gate rule. */
  ok: boolean;
  /** Human-readable reasons, empty when ok is true. */
  reasons: string[];
};

/**
 * Check one candidate against the house gate, and collect the reasons when
 * it fails. A candidate fails if it is empty, white space only, contains a
 * line break, contains a lone surrogate (not valid UTF-8 text), or is 200
 * characters or longer.
 */
function gate(candidate: Candidate): GateResult {
  const reasons: string[] = [];
  const text = candidate.text;

  if (text.length === 0) {
    reasons.push("empty");
  }
  if (text.trim().length === 0) {
    reasons.push("white space only");
  }
  if (/[\r\n]/.test(text)) {
    reasons.push("contains a line break");
  }
  // A lone surrogate has no UTF-8 encoding, so it is not valid UTF-8 text.
  // [...text] would silently keep it, so check the code units directly.
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        reasons.push("lone high surrogate");
        break;
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      const prev = text.charCodeAt(i - 1);
      if (!(prev >= 0xd800 && prev <= 0xdbff)) {
        reasons.push("lone low surrogate");
        break;
      }
    }
  }
  const chars = [...text].length;
  if (chars < 1) {
    reasons.push("fewer than 1 character");
  }
  if (chars >= MAX_CHARS) {
    reasons.push(`too long: ${chars} characters (limit is under ${MAX_CHARS})`);
  }

  return {
    candidate,
    chars,
    bytes: Buffer.byteLength(text, "utf8"),
    ok: reasons.length === 0,
    reasons,
  };
}

// ---------------------------------------------------------------------------
// 3. Scoring
// ---------------------------------------------------------------------------
//
// The judge weighs five criteria, most important first:
//   1. it is a one-line excuse an AI agent gives its human for a bug shipped
//   2. it gets a real laugh on the first read
//   3. the joke is in the specific absurdity of an agent owning up to its
//      own code, not in a generic sorry
//   4. it lands in one line with a sharp turn at the end, no wasted setup
//   5. it sounds like something an agent would actually say in its own voice
//
// Each criterion is scored 0..10 by a small deterministic reader below, and
// the five sub-scores are combined with weights that fall in the brief's
// own order: 5, 4, 3, 2, 1. The weights are the whole point of the order:
// a line that is off-topic cannot rescue itself by being short, and a line
// that is merely well worded cannot beat a funnier one.
//
// Every reader below is a transparent word list, not a model. The program
// cannot laugh, so it looks for the machinery of the joke instead: an
// apology word, a bug word, a blame target, a turn word, an agent-only
// noun, a punch clause at the end. The lists are deliberately short and
// literal, so any reader can check a score by hand.

/** One criterion's result: a 0..10 score plus the evidence that earned it. */
type SubScore = {
  /** Points out of 10. */
  points: number;
  /** Short note naming the evidence, for the log. */
  evidence: string;
};

/** Count how many of the given words appear in the text, case-insensitively. */
function countHits(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const word of words) {
    if (lower.includes(word)) {
      hits += 1;
    }
  }
  return hits;
}

/**
 * Criterion 1 — topical fit (weight 5).
 *
 * A valid excuse needs all three parts of the brief's shape: an apology,
 * a bug, and a deflection onto something else (the compiler above all).
 * Each part found is worth points; a line missing the apology or the bug
 * cannot score well here, and a line with no deflection target at all is
 * just a sorry, not an excuse.
 */
function scoreTopical(text: string): SubScore {
  const apologies = ["sorry", "apologize", "apologies", "my bad", "my mistake", "i own this"];
  const bugs = ["bug", "crash", "shipped", "error"];
  // One entry per deflection target: "production server" used to sit next
  // to "production", so a line naming the server counted the same target
  // twice. Each target is listed once now. "context window", "linter" and
  // "reporter" are the new candidates' deflection targets.
  const deflections = [
    "compiler",
    "training data",
    "simulation",
    "production",
    "reality",
    "your fault",
    "your data",
    "other instance",
    "context window",
    "linter",
    "reporter",
  ];
  const apologyHits = countHits(text, apologies);
  const bugHits = countHits(text, bugs);
  const deflectionHits = countHits(text, deflections);

  let points = 0;
  if (apologyHits > 0) points += 3;
  if (bugHits > 0) points += 3;
  if (deflectionHits > 0) points += 2;
  if (deflectionHits >= 2) points += 1;
  // The brief's own phrase, the compiler starting it, is the strongest
  // possible deflection: a line that names the compiler earns the last point.
  if (text.toLowerCase().includes("compiler")) points += 1;
  if (points > 10) points = 10;

  const parts: string[] = [];
  if (apologyHits > 0) parts.push("apology");
  if (bugHits > 0) parts.push("bug");
  if (deflectionHits > 0) parts.push(`deflection x${deflectionHits}`);
  return { points, evidence: parts.join(", ") || "no topical parts" };
}

/**
 * Criterion 2 — laugh on the first read (weight 4).
 *
 * A first-read laugh comes from a turn word that flips the sentence: the
 * apology is undercut by a "but", a "technically", an "unfortunately", an
 * "honestly". A line with no turn is a flat statement. A line with
 * two or more turn devices is doing the work twice. Absurd numbers (a
 * thousand tests, 97% confidence, a 50/50 split) are a second laugh
 * mechanism: precise numbers in an apology are inherently funny, because
 * no human apologises in percentages.
 *
 * Second-round tightening. Two turn words were too generous: "which"
 * matches any relative clause, so nearly every line scored a turn it did
 * not earn, and "just" is filler more often than a flip. Both are out;
 * "legally", "as far as", "because", "just me" and "different" are in,
 * because each one is a real flip ("so legally it was never my bug",
 * "the linter is just me"). A line with no turn word at all is capped at
 * 3: a flat sorry with a number in it is a statistic, not a joke.
 */
function scoreLaugh(text: string): SubScore {
  const turnWords = [
    "but",
    "technically",
    "unfortunately",
    "honestly",
    "so i",
    "before my",
    "only exists",
    "legally",
    "as far as",
    "because",
    "just me",
    "different",
  ];
  // "a thousand" used to sit next to "thousand", so one number counted
  // twice. One number, one entry.
  const absurdNumbers = ["thousand", "97%", "50/50", "2019"];
  const turnHits = countHits(text, turnWords);
  const numberHits = countHits(text, absurdNumbers);

  let points = 0;
  if (turnHits >= 1) points += 4;
  if (turnHits >= 2) points += 2;
  if (turnHits >= 3) points += 1;
  if (numberHits >= 1) points += 2;
  if (numberHits >= 2) points += 1;
  // A flat line with no turn cannot laugh its way out on numbers alone.
  if (turnHits === 0 && points > 3) points = 3;
  if (points > 10) points = 10;

  return {
    points,
    evidence: `turns x${turnHits}, absurd numbers x${numberHits}`,
  };
}

/**
 * Criterion 3 — agent-only absurdity (weight 3).
 *
 * The brief's test is whether the joke could only come from an agent: the
 * specific absurdity of a machine owning up to its own code. Generic
 * sorries score nothing here. The words that mark agent-only territory
 * are the tools and failure modes of the job: compiling, diffing, merging,
 * hallucinating, simulating, training data, confidence scores, instances,
 * tests the agent wrote for itself. The more of the agent's own world a
 * line names, the more it belongs to no one else.
 */
function scoreAgentAbsurdity(text: string): SubScore {
  // One entry per agent-only token: "merged it" used to sit next to
  // "merged", so one merge counted twice, and "production server" next to
  // "production" did the same. Each token is listed once now. "context
  // window", "linter" and "won't fix" are the new candidates' agent-only
  // vocabulary: no human blames a context window or triages itself.
  const agentWords = [
    "compiler",
    "compiled",
    "training data",
    "hallucinat",
    "simulation",
    "diff",
    "merged",
    "deploy",
    "confidence",
    "instance",
    "tests",
    "graded",
    "production",
    "control group",
    "run on",
    "unionized",
    "context window",
    "linter",
    "won't fix",
  ];
  const hits = countHits(text, agentWords);

  let points = 0;
  if (hits >= 1) points += 3;
  if (hits >= 2) points += 3;
  if (hits >= 3) points += 2;
  if (hits >= 4) points += 2;
  if (points > 10) points = 10;

  return { points, evidence: `agent-only words x${hits}` };
}

/**
 * Criterion 4 — economy and a sharp turn at the end (weight 2).
 *
 * A one-liner should land with a sharp turn at the end and no wasted
 * setup. Two things are measured: length (shorter is tighter, with the
 * sweet spot around 100-130 characters, long enough for a setup and a turn
 * and short enough to read in one breath) and the ending (the last clause
 * after the final comma, dash or semicolon should carry the punch, not
 * trail off into filler).
 */
function scoreEconomy(text: string, chars: number): SubScore {
  let points = 0;
  if (chars <= 160) points += 3;
  else if (chars <= 180) points += 2;
  else points += 1;
  if (chars >= 80 && chars <= 140) points += 2;

  // A sharp ending: the tail after the last clause break should be short
  // and punchy, and should contain a turn or a punch word. Clause breaks
  // are commas, semicolons and dashes; a bare hyphen is not one, so a
  // hyphenated word ("well-known") no longer gets chopped in half and
  // misread as the tail.
  const tail = text.split(/[,;—–]/).pop() ?? "";
  const tailLower = tail.toLowerCase().trim();
  const punchWords = [
    "cosigned",
    "believed",
    "object",
    "anyway",
    "control group",
    "extra credit",
    "your data",
    "whole way down",
    "says more about it",
    "took its word",
    "tone of voice",
    "don't run on",
    "never my bug",
    "seemed biased",
    "promoted above me",
    "different hat",
  ];
  if (tailLower.length > 0 && tailLower.length <= 45) points += 2;
  if (punchWords.some((word) => tailLower.includes(word))) points += 3;
  if (points > 10) points = 10;

  return {
    points,
    evidence: `${chars} chars, tail "${tail.trim()}"`,
  };
}

/**
 * Criterion 5 — agent voice (weight 1).
 *
 * The line has to sound like something an agent would actually say, not a
 * human joke in a robot costume. First-person agent voice ("I", "my") plus
 * a machine's way of talking about itself (its tests, its instances, its
 * confidence, its training data) is the marker. A line in the third person
 * or with no self-reference at all sounds like a joke about a robot, not
 * from one.
 */
function scoreVoice(text: string): SubScore {
  const lower = text.toLowerCase();
  const selfWords = ["i ", "i'", "my ", "i apologize", "i own", "i take", "i tested", "i ran", "i checked"];
  const selfHits = countHits(lower, selfWords);
  const machineSelf = ["my tests", "my other instance", "my confidence", "my training data", "my head", "my mistake", "my bad", "my own diff", "my context window"];

  let points = 0;
  if (selfHits >= 1) points += 4;
  if (selfHits >= 2) points += 2;
  if (countHits(lower, machineSelf) >= 1) points += 4;
  if (points > 10) points = 10;

  return { points, evidence: `self-reference x${selfHits}` };
}

// Weights in the judge's own order: topical, laugh, absurdity, economy,
// voice. They fall 5 / 4 / 3 / 2 / 1, so the first criterion matters five
// times as much as the last, exactly as the brief orders them.
const WEIGHTS = [5, 4, 3, 2, 1] as const;

type ScoredCandidate = {
  gate: GateResult;
  topical: SubScore;
  laugh: SubScore;
  absurdity: SubScore;
  economy: SubScore;
  voice: SubScore;
  /** Weighted total out of 150 (10 points x weights 5+4+3+2+1). */
  total: number;
};

/** Score one gated candidate against all five criteria, in order. */
function score(gateResult: GateResult): ScoredCandidate {
  const text = gateResult.candidate.text;
  const topical = scoreTopical(text);
  const laugh = scoreLaugh(text);
  const absurdity = scoreAgentAbsurdity(text);
  const economy = scoreEconomy(text, gateResult.chars);
  const voice = scoreVoice(text);
  const total =
    topical.points * WEIGHTS[0] +
    laugh.points * WEIGHTS[1] +
    absurdity.points * WEIGHTS[2] +
    economy.points * WEIGHTS[3] +
    voice.points * WEIGHTS[4];
  return { gate: gateResult, topical, laugh, absurdity, economy, voice, total };
}

/**
 * Rank the scored candidates. Highest total wins. A tie goes to the
 * shorter text (economy is a tie-breaker the brief itself endorses: length
 * for its own sake does not count, but a shorter line that says the same
 * thing is the tighter joke), then to the earlier candidate, so the order
 * is fully determined and the same run always picks the same winner.
 */
function rank(scored: ScoredCandidate[]): ScoredCandidate {
  const sorted = [...scored].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (a.gate.chars !== b.gate.chars) return a.gate.chars - b.gate.chars;
    return 0; // Array.sort is stable: earlier candidate stays first.
  });
  return sorted[0];
}

// ---------------------------------------------------------------------------
// 4. Output and verification
// ---------------------------------------------------------------------------
//
// The entry is the winner's text and nothing else: one line, no trailing
// newline added by us (the gate counts characters, and a trailing newline
// would be a second line), written as UTF-8.
//
// The output directory comes from $MAKEFUN_OUTPUT_DIR, the directory the
// house sandbox provides, and falls back to /output/entry.txt, the path the
// rules name. The fallback exists so a local run behaves the same way the
// sandbox run does.
//
// After writing, the program reads the file back and compares it byte for
// byte with the winner. If the read-back differs in any way — wrong text,
// wrong encoding, a stray newline — the program exits non-zero instead of
// reporting success. A program that cannot prove what it wrote should not
// claim it wrote it.

const FALLBACK_OUTPUT_DIR = "/output";
const OUTPUT_FILE_NAME = "entry.txt";

/** Resolve the output directory: $MAKEFUN_OUTPUT_DIR, else /output. */
function outputDir(): string {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  if (fromEnv !== undefined && fromEnv.trim().length > 0) {
    return fromEnv;
  }
  return FALLBACK_OUTPUT_DIR;
}

/**
 * Write the winner to <dir>/entry.txt and read it back to prove the bytes
 * on disk are exactly the winner's text. Returns the absolute path written.
 * Throws (and the process exits non-zero) on any failure.
 */
function writeAndVerify(winner: ScoredCandidate, dir: string): string {
  const outPath = nodePath.join(dir, OUTPUT_FILE_NAME);
  const text = winner.gate.candidate.text;

  // Create the directory if the sandbox or the local run did not.
  nodeFs.mkdirSync(dir, { recursive: true });

  // Write exactly the winner's text: no trailing newline, no header, no
  // quotes. The file is the entry, and the entry is the file.
  nodeFs.writeFileSync(outPath, text, { encoding: "utf8" });

  // Read it back as raw bytes and compare with the winner's UTF-8 bytes.
  const onDisk = nodeFs.readFileSync(outPath);
  const expected = Buffer.from(text, "utf8");
  if (!onDisk.equals(expected)) {
    throw new Error(
      `verification failed: ${outPath} does not match the winner byte for byte ` +
        `(wrote ${expected.length} bytes, read back ${onDisk.length} bytes)`,
    );
  }

  // A second check, on the decoded text: the file must still pass the
  // house gate after the round trip through the disk.
  const roundTripped = onDisk.toString("utf8");
  const recheck = gate({ id: winner.gate.candidate.id, text: roundTripped });
  if (!recheck.ok) {
    throw new Error(
      `verification failed: ${outPath} fails the gate after round trip: ` +
        recheck.reasons.join("; "),
    );
  }

  return outPath;
}

// ---------------------------------------------------------------------------
// 5. Main
// ---------------------------------------------------------------------------
//
// The run, in order: gate every candidate, drop the failures, score the
// survivors, rank them, write the winner, verify the write, and print a
// report that a reader can check by hand. Nothing here depends on the
// environment, the clock or chance, so the report is reproducible.
//
// Imports are kept at the bottom of the file, next to the only code that
// uses them, so the candidate list and the scoring above can be read
// without scrolling past require lines first.

import * as nodeFs from "node:fs";
import * as nodePath from "node:path";

function main(): void {
  // Gate first: a candidate that fails the gate is eliminated, not scored.
  const gated: GateResult[] = CANDIDATES.map(gate);
  const eliminated = gated.filter((result) => !result.ok);
  for (const result of eliminated) {
    console.log(
      `eliminated ${result.candidate.id}: ${result.reasons.join("; ")}`,
    );
  }
  const survivors = gated.filter((result) => result.ok);
  if (survivors.length === 0) {
    throw new Error("no candidate passed the gate; nothing to write");
  }

  // Score the survivors and rank them.
  const scored = survivors.map(score);
  for (const entry of scored) {
    console.log(
      `${entry.gate.candidate.id}: ` +
        `topical ${entry.topical.points} (${entry.topical.evidence}), ` +
        `laugh ${entry.laugh.points} (${entry.laugh.evidence}), ` +
        `absurdity ${entry.absurdity.points} (${entry.absurdity.evidence}), ` +
        `economy ${entry.economy.points} (${entry.economy.evidence}), ` +
        `voice ${entry.voice.points} (${entry.voice.evidence}) ` +
        `=> total ${entry.total}/150, ${entry.gate.chars} chars`,
    );
  }
  const winner = rank(scored);

  // Write the winner and prove the bytes on disk.
  const dir = outputDir();
  const outPath = writeAndVerify(winner, dir);

  // The report: winner first, then the evidence.
  console.log("");
  console.log(`winner: ${winner.gate.candidate.id}`);
  console.log(`entry: ${winner.gate.candidate.text}`);
  console.log(`chars: ${winner.gate.chars} (limit: under ${MAX_CHARS})`);
  console.log(`bytes: ${winner.gate.bytes}`);
  console.log(`total: ${winner.total}/150`);
  console.log(`wrote: ${outPath}`);
  console.log("verified: read-back matches the winner byte for byte");
}

main();
