// Analyse real /assassin assignments recovered from the bot logs.
//
// Games are recovered as contiguous runs of "<assassin> ==|;:;:;:;> <target>"
// lines; any other log output (heartbeats etc.) separates one game from the next.
//
// Usage: node scripts/analyze-assassin-logs.js <logfile> [<logfile> ...]

const fs = require('fs');
const ARROW = ' ==|;:;:;:;> ';

// "Name (Discord: other)" -> "Name", so a player is counted as one identity
const canon = (s) => s.replace(/\s*\(Discord:.*?\)\s*$/, '').trim();

const rawBlocks = [];
const anomalies = [];
let nullNames = 0;

for (const file of process.argv.slice(2)) {
	let block = [];
	const flush = () => { if (block.length) rawBlocks.push({ file, edges: block }); block = []; };
	for (const rawLine of fs.readFileSync(file, 'utf8').split('\n')) {
		const line = rawLine.replace(/\r$/, '');
		if (line.includes(ARROW)) {
			const [a, t] = line.split(ARROW);
			if (a === 'null' || t === 'null') nullNames++;
			block.push([canon(a), canon(t)]);
		} else {
			flush();
		}
	}
	flush();
}

// A game is a permutation: assassins and targets are the same set, each once.
// A long DM round-trip can let an unrelated log line land mid-game, so blocks
// are merged until that closure holds rather than trusted as-is.
const closes = (edges) => {
	const a = edges.map(e => e[0]), t = edges.map(e => e[1]);
	const aS = new Set(a), tS = new Set(t);
	return aS.size === a.length && tS.size === t.length && [...aS].every(x => tS.has(x));
};

const games = [];
let boundaryHits = 0, merged = 0;
{
	// Merge at most MAX_MERGE consecutive blocks looking for closure; if a block
	// still cannot start a valid game (e.g. a name logged as "null" so the sets
	// can never match), drop it and resync on the next one.
	const MAX_MERGE = 4;
	let i = 0;
	while (i < rawBlocks.length) {
		let done = false;
		for (let j = i; j < Math.min(i + MAX_MERGE, rawBlocks.length); j++) {
			const edges = rawBlocks.slice(i, j + 1).flatMap(b => b.edges);
			if (closes(edges)) {
				games.push({ file: rawBlocks[i].file, edges });
				if (j === i) boundaryHits++; else merged++;
				i = j + 1;
				done = true;
				break;
			}
		}
		if (!done) { anomalies.push(rawBlocks[i]); i++; }
	}
}

// --- Validate each recovered game ------------------------------------------
const valid = [];
for (const g of games) {
	const assassins = g.edges.map(e => e[0]);
	const targets = g.edges.map(e => e[1]);
	const aSet = new Set(assassins), tSet = new Set(targets);
	const sameSet = aSet.size === assassins.length && tSet.size === targets.length &&
		[...aSet].every(n => tSet.has(n));
	if (!sameSet) { anomalies.push(g); continue; }
	if (g.edges.some(([a, t]) => a === t)) { anomalies.push(g); continue; }

	// Decompose the permutation into cycles
	const next = new Map(g.edges);
	const seen = new Set();
	const cycles = [];
	for (const start of aSet) {
		if (seen.has(start)) continue;
		let len = 0, cur = start;
		do { seen.add(cur); cur = next.get(cur); len++; } while (cur !== start);
		cycles.push(len);
	}
	valid.push({ ...g, players: [...aSet], n: assassins.length, cycles: cycles.sort((x, y) => y - x) });
}

console.log(`Log files: ${process.argv.slice(2).join(', ')}`);
console.log(`Assignment lines: ${rawBlocks.reduce((s, b) => s + b.edges.length, 0)}`);
console.log(`Games recovered: ${games.length}   valid: ${valid.length}   unresolved: ${anomalies.length}`);
console.log(`  closed exactly at a log-block boundary: ${boundaryHits}   needed merging across an interleaved log line: ${merged}`);
console.log(`  blocks dropped (could not form a game): ${anomalies.length}, covering ${anomalies.reduce((s,b)=>s+b.edges.length,0)} lines`);
console.log(`  assignment lines where a name logged as "null": ${nullNames}\n`);

// --- 1. Game size distribution ---------------------------------------------
const bySize = {};
for (const g of valid) (bySize[g.n] ||= []).push(g);
console.log('GAME SIZE DISTRIBUTION');
console.log('-'.repeat(40));
for (const n of Object.keys(bySize).sort((a, b) => a - b)) {
	console.log(`  ${String(n).padStart(2)} players   ${String(bySize[n].length).padStart(4)} games`);
}

// --- 2. Cycle structure -----------------------------------------------------
console.log('\nCYCLE STRUCTURE  (a game should be ONE closed loop)');
console.log('-'.repeat(60));
const shapes = {};
for (const g of valid) {
	const key = `${g.n}p: ${g.cycles.join('+')}`;
	shapes[key] = (shapes[key] || 0) + 1;
}
let fragmented = 0;
for (const g of valid) if (g.cycles.length > 1) fragmented++;
for (const k of Object.keys(shapes).sort()) {
	const isSplit = k.includes('+');
	console.log(`  ${k.padEnd(20)} ${String(shapes[k]).padStart(4)} games ${isSplit ? '   <-- SPLIT into separate loops' : ''}`);
}
console.log(`\n  Games fragmented into 2+ independent loops: ${fragmented}/${valid.length} = ${(100 * fragmented / valid.length).toFixed(1)}%`);

// --- 3. Positional bias: which option slot targets which slot ---------------
// The assassin order in the log is the order the users were passed to the
// command, so slot index is meaningful and comparable across games.
console.log('\nPOSITIONAL BIAS  (assassin slot -> target slot), games of 6');
console.log('-'.repeat(70));
for (const size of [6, 5, 4]) {
	const gs = bySize[size] || [];
	if (gs.length < 30) continue;
	const slotOf = (g) => new Map(g.edges.map(([a], i) => [a, i]));
	const matrix = Array.from({ length: size }, () => new Array(size).fill(0));
	for (const g of gs) {
		const idx = slotOf(g);
		g.edges.forEach(([, t], i) => matrix[i][idx.get(t)]++);
	}
	const expected = gs.length / (size - 1);
	console.log(`\n  ${size}-player games (${gs.length} games); uniform expectation per cell = ${expected.toFixed(1)}`);
	console.log('        ' + Array.from({ length: size }, (_, j) => `->s${j}`.padStart(8)).join(''));
	for (let i = 0; i < size; i++) {
		const row = matrix[i].map((c, j) => (i === j ? '  -' : String(c))).map(s => s.padStart(8)).join('');
		console.log(`  s${i}  ` + row);
	}
	// chi-square over the (size)*(size-1) off-diagonal cells
	let chi = 0, cells = 0;
	for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) {
		if (i === j) continue;
		chi += Math.pow(matrix[i][j] - expected, 2) / expected; cells++;
	}
	console.log(`  chi-square = ${chi.toFixed(1)}  (df = ${cells - 1}; near df means unbiased)`);
}

// --- 4. Recurring rosters: do the same people keep getting the same target? --
console.log('\n\nRECURRING ROSTERS  (identical player set played more than once)');
console.log('-'.repeat(78));
const byRoster = {};
for (const g of valid) {
	const key = [...g.players].sort().join(' | ');
	(byRoster[key] ||= []).push(g);
}
const recurring = Object.entries(byRoster)
	.filter(([, gs]) => gs.length >= 3)
	.sort((a, b) => b[1].length - a[1].length);

let totalRepeat = 0, totalConsecutive = 0;
for (const [, gs] of Object.values(recurring)) {}
for (const [, gs] of recurring) {
	for (let i = 1; i < gs.length; i++) {
		const prev = new Map(gs[i - 1].edges);
		for (const [a, t] of gs[i].edges) {
			totalConsecutive++;
			if (prev.get(a) === t) totalRepeat++;
		}
	}
}

console.log(`Rosters that played 3+ times: ${recurring.length}`);
if (totalConsecutive) {
	console.log(`Target unchanged from that roster's previous game: ${totalRepeat}/${totalConsecutive} = ${(100 * totalRepeat / totalConsecutive).toFixed(1)}%`);
}

for (const [key, gs] of recurring.slice(0, 5)) {
	const players = key.split(' | ');
	const n = players.length;
	console.log(`\n  Roster (${n} players, ${gs.length} games): ${players.join(', ')}`);
	const counts = new Map();
	let edges = 0;
	for (const g of gs) for (const [a, t] of g.edges) {
		counts.set(a + '>' + t, (counts.get(a + '>' + t) || 0) + 1); edges++;
	}
	const exp = edges / (n * (n - 1));
	const rows = [];
	for (const a of players) for (const b of players) {
		if (a === b) continue;
		rows.push({ a, b, c: counts.get(a + '>' + b) || 0 });
	}
	rows.sort((x, y) => y.c - x.c);
	console.log(`    expected per ordered pair if uniform: ${exp.toFixed(1)}`);
    console.log(`    most frequent pairings:`);
	for (const r of rows.slice(0, 6)) {
		console.log(`      ${(r.a + ' ==> ' + r.b).padEnd(46)} ${String(r.c).padStart(3)}  (${(r.c / exp).toFixed(1)}x expected)`);
	}
	const never = rows.filter(r => r.c === 0).length;
	console.log(`    ordered pairs that NEVER occurred: ${never}/${rows.length}`);
	let chi = rows.reduce((s, r) => s + Math.pow(r.c - exp, 2) / exp, 0);
	console.log(`    chi-square = ${chi.toFixed(1)} (df = ${rows.length - 1})`);
}

if (anomalies.length) {
	console.log(`\n\nMALFORMED BLOCKS: ${anomalies.length} (assassin set != target set, or self-target)`);
	for (const g of anomalies.slice(0, 5)) {
		console.log('  ---');
		for (const [a, t] of g.edges) console.log(`    ${a} ==> ${t}`);
	}
}
