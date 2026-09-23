// Simulation harness for /assassin target assignment.
//
// Drives the REAL commands/assassin.js execute() function, stubbing out only
// Discord (interaction + members) and the Friends of Risk API, so the pairing
// logic under test is exactly the shipped code.
//
// Usage: node assassin-sim.js [runs] [playerCount]

const path = require('path');
const REPO = '/home/riskbot';

const RUNS = parseInt(process.argv[2] || '100000', 10);
const PLAYER_COUNT = parseInt(process.argv[3] || '6', 10);

// --- Stub the FoR API before assassin.js destructures it -------------------
const helpers = require(path.join(REPO, 'modules/helperfunctions.js'));
helpers.httpsPostRequest = async () =>
	JSON.stringify({ status: 'error', message: 'User not found', data: [] });

global.config = { for_api_key: 'stub' };

// --- Capture assignments ---------------------------------------------------
// assassin.js logs "<assassin> ==|;:;:;:;> <target>" for every assignment.
const ARROW = ' ==|;:;:;:;> ';
const pairs = new Map();          // "assassin>target" -> count
let assignments = 0;

const realLog = console.log;
console.log = (msg) => {
	if (typeof msg === 'string' && msg.includes(ARROW)) {
		const [assassin, target] = msg.split(ARROW);
		const key = assassin + '>' + target;
		pairs.set(key, (pairs.get(key) || 0) + 1);
		assignments++;
		return;
	}
	realLog(msg);
};

// --- Fake Discord objects --------------------------------------------------
const NAMES = Array.from({ length: PLAYER_COUNT }, (_, i) => `Player ${i + 1}`);

const makeMember = (id, displayName) => ({
	id,
	displayName,
	user: { id, globalName: displayName, username: displayName },
	send: async () => {},
});

const membersById = new Map();
NAMES.forEach((name, i) => membersById.set(String(i + 1), makeMember(String(i + 1), name)));
membersById.set('caller', makeMember('caller', 'Game Master'));

const interaction = {
	user: { id: 'caller' },
	guild: { members: { fetch: async (id) => membersById.get(id) } },
	options: {
		getMember: (opt) => membersById.get(opt.replace('user', '')) || null,
	},
	deferReply: async () => {},
	editReply: async () => {},
	followUp: async () => {},
};

// --- Run -------------------------------------------------------------------
const assassin = require(path.join(REPO, 'commands/assassin.js'));

(async () => {
	const started = Date.now();
	for (let run = 0; run < RUNS; run++) {
		await assassin.execute(interaction);
	}
	const elapsed = ((Date.now() - started) / 1000).toFixed(1);

	console.log = realLog;

	const orderedPairs = [];
	for (const a of NAMES) for (const b of NAMES) if (a !== b) orderedPairs.push([a, b]);

	const expected = assignments / orderedPairs.length;

	console.log(`Runs: ${RUNS}   Players: ${PLAYER_COUNT}   Elapsed: ${elapsed}s`);
	console.log(`Total assignments: ${assignments}`);
	console.log(`Distinct ordered pairs possible: ${orderedPairs.length}`);
	console.log(`Expected count per pair if uniform: ${expected.toFixed(1)}\n`);

	// Ordered pair table: who hunts whom
	console.log('ORDERED PAIRS  (assassin ==> target)');
	console.log('-'.repeat(62));
	console.log('pair'.padEnd(30) + 'count'.padStart(10) + 'share'.padStart(10) + 'vs exp'.padStart(12));
	console.log('-'.repeat(62));
	const rows = orderedPairs.map(([a, b]) => {
		const count = pairs.get(a + '>' + b) || 0;
		return { label: `${a} ==> ${b}`, count };
	});
	for (const r of rows) {
		const share = (100 * r.count / assignments).toFixed(2) + '%';
		const dev = expected ? (((r.count - expected) / expected) * 100).toFixed(2) + '%' : 'n/a';
		console.log(
			r.label.padEnd(30) +
			String(r.count).padStart(10) +
			share.padStart(10) +
			(r.count >= expected ? '+' + dev : dev).padStart(12)
		);
	}

	// Unordered pair table: how often two players are linked in either direction
	console.log('\nUNORDERED PAIRS  (linked in either direction)');
	console.log('-'.repeat(62));
	console.log('pair'.padEnd(30) + 'count'.padStart(10) + 'share'.padStart(10) + 'vs exp'.padStart(12));
	console.log('-'.repeat(62));
	const unorderedTotal = assignments;
	const unorderedExpected = unorderedTotal / (orderedPairs.length / 2);
	for (let i = 0; i < NAMES.length; i++) {
		for (let j = i + 1; j < NAMES.length; j++) {
			const a = NAMES[i], b = NAMES[j];
			const count = (pairs.get(a + '>' + b) || 0) + (pairs.get(b + '>' + a) || 0);
			const share = (100 * count / unorderedTotal).toFixed(2) + '%';
			const dev = (((count - unorderedExpected) / unorderedExpected) * 100).toFixed(2) + '%';
			console.log(
				`${a} <=> ${b}`.padEnd(30) +
				String(count).padStart(10) +
				share.padStart(10) +
				(count >= unorderedExpected ? '+' + dev : dev).padStart(12)
			);
		}
	}

	// Chi-square goodness of fit over ordered pairs
	const chi2 = rows.reduce((s, r) => s + Math.pow(r.count - expected, 2) / expected, 0);
	const df = orderedPairs.length - 1;
	console.log(`\nChi-square over ordered pairs: ${chi2.toFixed(2)} (df=${df})`);
	console.log(`Uniform expectation would put this near ${df}; far above means non-uniform.`);

	const counts = rows.map(r => r.count);
	console.log(`Min pair count: ${Math.min(...counts)}   Max pair count: ${Math.max(...counts)}`);
})();
