// Faithful port of the PRE-ebd2941 assassin assignment (git show 450a3d3:commands/assassin.js).
// Used to check whether the cycle structure seen in the real logs is explained
// by the old algorithm, rather than by two games being logged back to back.
//
// Usage: node scripts/test-assassin-old-algorithm.js [runs]

const RUNS = parseInt(process.argv[2] || '100000', 10);

function assignTargets(n) {
	const users = Array.from({ length: n }, (_, i) => i);
	const targets = users.slice();
	let targets_used = [];
	const usertarget = new Array(n).fill('');
	let failed = false;

	for (let i = 0; i < users.length; i++) {
		let attempts = 0;
		let target = "0";
		while (target === "0" && attempts < 200) {
			const targetindex = Math.floor(Math.random() * targets.length);
			const t = targets[targetindex];
			if ((targetindex != i || i == users.length - 1) && !targets_used.includes(targetindex)) {
				target = t;
				usertarget[i] = targetindex;
				targets_used.push(targetindex);
				if (i == targetindex) {
					// last player drew himself: swap with a random earlier slot
					const newtarget = Math.floor(Math.random() * (targets.length - 1));
					usertarget[i] = usertarget[newtarget];
					usertarget[newtarget] = targetindex;
				}
			}
			attempts++;
		}
		if (target === "0") failed = true;
	}
	return { usertarget, failed };
}

function cycles(perm) {
	const n = perm.length;
	const seen = new Array(n).fill(false);
	const out = [];
	for (let s = 0; s < n; s++) {
		if (seen[s]) continue;
		let len = 0, cur = s;
		while (!seen[cur]) { seen[cur] = true; cur = perm[cur]; len++; }
		out.push(len);
	}
	return out.sort((a, b) => b - a);
}

for (const n of [3, 4, 5, 6]) {
	const shapes = {};
	let selfTarget = 0, failures = 0, fragmented = 0;
	const pairCount = Array.from({ length: n }, () => new Array(n).fill(0));

	for (let r = 0; r < RUNS; r++) {
		const { usertarget, failed } = assignTargets(n);
		if (failed || usertarget.some(v => v === '')) { failures++; continue; }
		if (usertarget.some((t, i) => t === i)) selfTarget++;
		const c = cycles(usertarget);
		const key = c.join('+');
		shapes[key] = (shapes[key] || 0) + 1;
		if (c.length > 1) fragmented++;
		usertarget.forEach((t, i) => pairCount[i][t]++);
	}

	const ok = RUNS - failures;
	console.log(`\n=== ${n} players, ${RUNS} runs ===`);
	console.log(`  hard failures (no target assigned): ${failures}`);
	console.log(`  permutations where someone targets themselves: ${selfTarget}`);
	console.log(`  fragmented into 2+ loops: ${fragmented}/${ok} = ${(100 * fragmented / ok).toFixed(1)}%`);
	console.log(`  cycle shapes:`);
	for (const k of Object.keys(shapes).sort()) {
		console.log(`    ${k.padEnd(14)} ${String(shapes[k]).padStart(7)}  ${(100 * shapes[k] / ok).toFixed(1)}%`);
	}
	const exp = ok / (n - 1);
	let chi = 0;
	for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
		if (i === j) continue;
		chi += Math.pow(pairCount[i][j] - exp, 2) / exp;
	}
	console.log(`  ordered-pair chi-square = ${chi.toFixed(1)} (df = ${n * (n - 1) - 1})`);
}

// --- Detailed ordered-pair matrix for 6 players ----------------------------
{
	const n = 6;
	const m = Array.from({ length: n }, () => new Array(n).fill(0));
	let ok = 0;
	for (let r = 0; r < RUNS; r++) {
		const { usertarget, failed } = assignTargets(n);
		if (failed || usertarget.some(v => v === '')) continue;
		usertarget.forEach((t, i) => m[i][t]++);
		ok++;
	}
	const exp = ok / (n - 1);
	console.log(`\n\n=== OLD ALGORITHM: ordered-pair matrix, 6 players, ${ok} runs ===`);
	console.log(`uniform expectation per cell = ${exp.toFixed(0)}\n`);
	console.log('          ' + Array.from({ length: n }, (_, j) => `->s${j}`.padStart(14)).join(''));
	for (let i = 0; i < n; i++) {
		const row = m[i].map((c, j) => i === j ? '-' : `${c} (${(c / exp).toFixed(2)}x)`).map(s => s.padStart(14)).join('');
		console.log(`  s${i}      ` + row);
	}
}
