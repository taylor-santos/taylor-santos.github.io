// Tideman Alternative (Smith//IRV).
// Ballots are arrays of candidate indices, most preferred first.
// Candidates missing from a ballot are treated as tied below every ranked candidate.

function pairwise(n, ballots) {
  const m = Array.from({ length: n }, () => Array(n).fill(0));
  for (const b of ballots) {
    const rank = Array(n).fill(b.length);
    b.forEach((c, i) => { rank[c] = i; });
    for (let a = 0; a < n; a++)
      for (let c = 0; c < n; c++)
        if (rank[a] < rank[c]) m[a][c]++;
  }
  return m;
}

// Smallest set of candidates in `alive` whose members each beat every candidate outside it.
function smithSet(m, alive) {
  const k = alive.length;
  const r = alive.map(a => alive.map(b => a === b || m[a][b] >= m[b][a]));
  for (let x = 0; x < k; x++)
    for (let a = 0; a < k; a++)
      if (r[a][x])
        for (let b = 0; b < k; b++)
          if (r[x][b]) r[a][b] = true;
  return alive.filter((_, i) => r[i].every(Boolean));
}

function firstPlace(ballots, alive) {
  const counts = {};
  for (const c of alive) counts[c] = 0;
  let exhausted = 0;
  for (const b of ballots) {
    const top = b.find(c => alive.includes(c));
    if (top === undefined) exhausted++; else counts[top]++;
  }
  return { counts, exhausted };
}

function winsWithin(m, c, alive) {
  return alive.filter(d => d !== c && m[c][d] > m[d][c]).length;
}

// Returns { winner, rounds } for the candidates in `cands`.
function tidemanWinner(m, ballots, cands) {
  const rounds = [];
  let alive = cands.slice();
  for (;;) {
    const smith = smithSet(m, alive);
    const round = { alive: alive.slice(), smith };
    rounds.push(round);
    alive = smith;
    if (alive.length === 1) {
      round.winner = alive[0];
      return { winner: alive[0], rounds };
    }
    const { counts, exhausted } = firstPlace(ballots, alive);
    round.counts = counts;
    round.exhausted = exhausted;
    const min = Math.min(...alive.map(c => counts[c]));
    let losers = alive.filter(c => counts[c] === min);
    if (losers.length > 1) {
      const minWins = Math.min(...losers.map(c => winsWithin(m, c, alive)));
      const byWins = losers.filter(c => winsWithin(m, c, alive) === minWins);
      round.tiebreak = byWins.length < losers.length
        ? 'fewest pairwise wins among remaining candidates'
        : 'fewest pairwise wins, then earliest in candidate list';
      losers = byWins;
    }
    round.eliminated = losers[0];
    alive = alive.filter(c => c !== losers[0]);
  }
}

// Full ranking: find the winner, remove them, repeat.
function tidemanRanking(n, ballots) {
  const m = pairwise(n, ballots);
  let cands = Array.from({ length: n }, (_, i) => i);
  const places = [];
  while (cands.length) {
    const r = tidemanWinner(m, ballots, cands);
    places.push(r);
    cands = cands.filter(c => c !== r.winner);
  }
  return { pairwise: m, places };
}

if (typeof module !== 'undefined') module.exports = { pairwise, smithSet, tidemanWinner, tidemanRanking };
