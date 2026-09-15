// Set this to your Firebase Realtime Database URL (see README).
const DB_URL = 'https://tideman-34cbc-default-rtdb.firebaseio.com';

const app = document.getElementById('app');

async function db(path, method, body) {
  const r = await fetch(`${DB_URL}/${path}.json`, { method, body: body && JSON.stringify(body) });
  if (!r.ok) throw new Error(`${method || 'GET'} ${path} failed: ${r.status}`);
  return r.json();
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function randomId() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(36).padStart(2, '0')).join('');
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function link(hash) {
  return location.origin + location.pathname + hash;
}

function showError(e) {
  app.innerHTML = `<p class="error">${esc(e.message)}</p><p><a href="#">Create a poll</a></p>`;
}

// --- Create poll ---

function renderNew() {
  app.innerHTML = `
    <h1>New poll</h1>
    <form id="f">
      <label for="title">Title</label>
      <input type="text" id="title" required maxlength="200">
      <label for="cands">Candidates, one per line</label>
      <textarea id="cands" required></textarea>
      <p class="error" id="err"></p>
      <button class="primary" type="submit">Publish</button>
    </form>`;
  const f = document.getElementById('f');
  f.onsubmit = async e => {
    e.preventDefault();
    const title = document.getElementById('title').value.trim();
    const candidates = [...new Set(document.getElementById('cands').value.split('\n').map(s => s.trim()).filter(Boolean))];
    const err = document.getElementById('err');
    if (candidates.length < 2) { err.textContent = 'Enter at least two distinct candidates.'; return; }
    f.querySelector('button').disabled = true;
    try {
      const id = randomId();
      await db(`polls/${id}`, 'PUT', { title, candidates });
      renderPublished(id);
    } catch (ex) { err.textContent = ex.message; f.querySelector('button').disabled = false; }
  };
}

function renderPublished(id) {
  const url = link(`#p/${id}`);
  app.innerHTML = `
    <h1>Published</h1>
    <label for="url">Voting link</label>
    <input type="text" id="url" readonly value="${esc(url)}">
    <p><button id="copy">Copy link</button></p>
    <p><a href="#p/${id}">Vote</a> · <a href="#r/${id}">Results</a></p>`;
  document.getElementById('copy').onclick = async e => {
    await navigator.clipboard.writeText(url);
    e.target.textContent = 'Copied';
  };
}

// --- Vote ---

async function renderVote(id) {
  const poll = await db(`polls/${id}`);
  if (!poll) throw new Error('Poll not found.');
  const cands = poll.candidates;
  let pool = shuffle(cands.map((_, i) => i));
  const ranked = [];

  app.innerHTML = `
    <h1>${esc(poll.title)}</h1>
    <label for="name">Your name</label>
    <input type="text" id="name" required maxlength="100" autocomplete="name">
    <p class="muted">Votes are public. Your name and ranking will be shown on the results page.</p>
    <h2>Your ranking</h2>
    <p class="muted">Click candidates below in order of preference. Candidates you leave unranked count as tied below the ones you rank.</p>
    <ol id="ranked"></ol>
    <h2>Unranked</h2>
    <ul id="pool"></ul>
    <p class="error" id="err"></p>
    <button class="primary" id="submit">Submit vote</button>
    <p><a href="#r/${id}">Results</a></p>`;

  const rankedEl = document.getElementById('ranked');
  const poolEl = document.getElementById('pool');

  function draw() {
    rankedEl.innerHTML = ranked.map((c, i) => `<li>${esc(cands[c])}
      <button class="small" data-up="${i}" title="Move up" ${i === 0 ? 'disabled' : ''}>&#9650;</button>
      <button class="small" data-down="${i}" title="Move down" ${i === ranked.length - 1 ? 'disabled' : ''}>&#9660;</button>
      <button class="small" data-remove="${i}" title="Remove">&#10005;</button></li>`).join('');
    poolEl.innerHTML = pool.map(c => `<li><button data-add="${c}">${esc(cands[c])}</button></li>`).join('');
  }
  draw();

  app.onclick = e => {
    const b = e.target.closest('button[data-add],button[data-up],button[data-down],button[data-remove]');
    if (!b) return;
    const d = b.dataset;
    if (d.add !== undefined) { const c = +d.add; pool = pool.filter(x => x !== c); ranked.push(c); }
    else if (d.up !== undefined) { const i = +d.up; [ranked[i - 1], ranked[i]] = [ranked[i], ranked[i - 1]]; }
    else if (d.down !== undefined) { const i = +d.down; [ranked[i + 1], ranked[i]] = [ranked[i], ranked[i + 1]]; }
    else if (d.remove !== undefined) { const i = +d.remove; pool.push(ranked[i]); ranked.splice(i, 1); }
    draw();
  };

  document.getElementById('submit').onclick = async e => {
    const name = document.getElementById('name').value.trim();
    const err = document.getElementById('err');
    if (!name) { err.textContent = 'Enter your name.'; return; }
    if (!ranked.length) { err.textContent = 'Rank at least one candidate.'; return; }
    e.target.disabled = true;
    try {
      await db(`votes/${id}`, 'POST', { name, ranking: ranked, t: { '.sv': 'timestamp' } });
      location.hash = `#r/${id}`;
    } catch (ex) { err.textContent = ex.message; e.target.disabled = false; }
  };
}

// --- Results ---

function names(cands, list) {
  return list.map(c => esc(cands[c])).join(', ');
}

function describeRound(cands, r) {
  const out = [`<p>Remaining: ${names(cands, r.alive)}.`];
  const dropped = r.alive.filter(c => !r.smith.includes(c));
  if (r.winner !== undefined) {
    out.push(dropped.length
      ? ` ${esc(cands[r.winner])} beats every other remaining candidate head-to-head, so wins.</p>`
      : ` Only one candidate remains: ${esc(cands[r.winner])}.</p>`);
    return out.join('');
  }
  out.push(dropped.length
    ? ` Smith set: ${names(cands, r.smith)}. Eliminated for losing head-to-head to every member of the Smith set: ${names(cands, dropped)}.`
    : ' Every candidate is in the Smith set.');
  const fp = r.smith.map(c => `${esc(cands[c])} ${r.counts[c]}`).join(', ');
  out.push(` First preferences: ${fp}${r.exhausted ? ` (${r.exhausted} ballots exhausted)` : ''}.`);
  out.push(` Eliminated for fewest first preferences${r.tiebreak ? ` (tie broken by ${r.tiebreak})` : ''}: ${esc(cands[r.eliminated])}.</p>`);
  return out.join('');
}

async function renderResults(id) {
  const [poll, votesObj] = await Promise.all([db(`polls/${id}`), db(`votes/${id}`)]);
  if (!poll) throw new Error('Poll not found.');
  const cands = poll.candidates;
  const n = cands.length;
  const votes = Object.values(votesObj || {}).sort((a, b) => a.t - b.t);
  const ballots = votes.map(v => (v.ranking || []).filter(c => Number.isInteger(c) && c >= 0 && c < n));
  const url = link(`#p/${id}`);

  let html = `
    <h1>${esc(poll.title)}</h1>
    <p>${votes.length} vote${votes.length === 1 ? '' : 's'} · <a href="#p/${id}">Vote</a> · voting link: <a href="${esc(url)}">${esc(url)}</a></p>`;

  if (!votes.length) {
    app.innerHTML = html + '<p>No votes yet.</p>';
    return;
  }

  const { pairwise, places } = tidemanRanking(n, ballots);

  html += `<h2>Winner: ${esc(cands[places[0].winner])}</h2>
    <h2>Ranking</h2>
    <ol>${places.map(p => `<li>${esc(cands[p.winner])}</li>`).join('')}</ol>

    <h2>How the result was computed</h2>
    <p>Method: Tideman Alternative. Repeatedly restrict to the Smith set (the smallest group of candidates who each beat every candidate outside the group head-to-head), then eliminate the remaining candidate with the fewest first preferences, until one candidate remains. Lower places are found by removing the winner and repeating.</p>
    ${places.map((p, i) => `<details ${i === 0 ? 'open' : ''}><summary>Place ${i + 1}: ${esc(cands[p.winner])}</summary>${p.rounds.map(r => describeRound(cands, r)).join('')}</details>`).join('')}

    <h2>Head-to-head</h2>
    <p class="muted">Each cell is the number of voters who ranked the row candidate above the column candidate. Shaded cells are wins.</p>
    <div style="overflow-x:auto"><table>
      <tr><th></th>${cands.map(c => `<th class="rot">${esc(c)}</th>`).join('')}</tr>
      ${cands.map((c, a) => `<tr><th>${esc(c)}</th>${cands.map((_, b) =>
        a === b ? '<td></td>' : `<td class="${pairwise[a][b] > pairwise[b][a] ? 'win' : ''}">${pairwise[a][b]}</td>`).join('')}</tr>`).join('')}
    </table></div>

    <h2>Ballots</h2>
    <div style="overflow-x:auto"><table>
      <tr><th>Voter</th><th>Time</th><th>Ranking</th></tr>
      ${votes.map((v, i) => `<tr><td>${esc(v.name)}</td><td>${esc(new Date(v.t).toLocaleString())}</td><td>${ballots[i].map((c, j) => `${j + 1}. ${esc(cands[c])}`).join('<br>')}</td></tr>`).join('')}
    </table></div>`;
  app.innerHTML = html;
}

// --- Router ---

async function route() {
  app.onclick = null;
  const m = location.hash.match(/^#([pr])\/([a-z0-9]+)$/);
  try {
    if (!m) renderNew();
    else if (m[1] === 'p') await renderVote(m[2]);
    else await renderResults(m[2]);
  } catch (e) { showError(e); }
}

window.addEventListener('hashchange', route);
route();
