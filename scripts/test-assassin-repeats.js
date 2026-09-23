// Follow-up: how often does a player get the SAME target in the next game?
// Uses the same real-code harness as assassin-sim.js.
const path = require('path');
const REPO = '/home/riskbot';
const RUNS = parseInt(process.argv[2] || '100000', 10);
const N = parseInt(process.argv[3] || '6', 10);

const helpers = require(path.join(REPO, 'modules/helperfunctions.js'));
helpers.httpsPostRequest = async () => JSON.stringify({ status: 'error', data: [] });
global.config = { for_api_key: 'stub' };

const ARROW = ' ==|;:;:;:;> ';
let current = {};
const realLog = console.log;
console.log = (msg) => {
	if (typeof msg === 'string' && msg.includes(ARROW)) {
		const [a, t] = msg.split(ARROW);
		current[a] = t;
		return;
	}
	realLog(msg);
};

const NAMES = Array.from({ length: N }, (_, i) => `Player ${i + 1}`);
const mk = (id, n) => ({ id, displayName: n, user: { id, globalName: n, username: n }, send: async () => {} });
const byId = new Map(NAMES.map((n, i) => [String(i + 1), mk(String(i + 1), n)]));
byId.set('caller', mk('caller', 'Game Master'));
const interaction = {
	user: { id: 'caller' },
	guild: { members: { fetch: async (id) => byId.get(id) } },
	options: { getMember: (o) => byId.get(o.replace('user', '')) || null },
	deferReply: async () => {}, editReply: async () => {}, followUp: async () => {},
};

const assassin = require(path.join(REPO, 'commands/assassin.js'));

(async () => {
	let prev = null;
	let playerRepeats = 0, playerObs = 0, gamesWithAnyRepeat = 0, gamesCompared = 0;
	const perPlayerRepeat = Object.fromEntries(NAMES.map(n => [n, 0]));

	for (let r = 0; r < RUNS; r++) {
		current = {};
		await assassin.execute(interaction);
		if (prev) {
			gamesCompared++;
			let any = false;
			for (const p of NAMES) {
				playerObs++;
				if (prev[p] === current[p]) { playerRepeats++; perPlayerRepeat[p]++; any = true; }
			}
			if (any) gamesWithAnyRepeat++;
		}
		prev = current;
	}
	console.log = realLog;

	console.log(`Consecutive-game analysis over ${RUNS} games, ${N} players\n`);
	console.log(`A player keeps the same target as last game: ${playerRepeats}/${playerObs} = ${(100*playerRepeats/playerObs).toFixed(2)}%  (theory: ${(100/(N-1)).toFixed(2)}%)`);
	console.log(`A game where AT LEAST ONE player kept their target: ${gamesWithAnyRepeat}/${gamesCompared} = ${(100*gamesWithAnyRepeat/gamesCompared).toFixed(2)}%\n`);
	console.log('Per-player repeat rate (should be flat):');
	for (const p of NAMES) {
		console.log(`  ${p.padEnd(12)} ${(100*perPlayerRepeat[p]/gamesCompared).toFixed(2)}%`);
	}
})();
