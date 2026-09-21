#!/usr/bin/env node
//
// ONE-TIME BACKFILL: reads channel history for every channel in
// `activity_watchlist_channels` and fills activity__discord_daily with the same
// per-day / per-user message counts modules/activityTracker.js writes live.
//
// Only author id and timestamp are used - no message content is read or stored
// (the bot has no MessageContent intent, so REST returns it empty anyway).
//
// Talks to Discord over REST only, never the gateway, so it does not open a second
// session alongside the pm2 bot and cannot interfere with it.
//
//   node scripts/backfill_activity.js --dry-run          # count, write nothing
//   node scripts/backfill_activity.js                    # backfill 3 years
//   node scripts/backfill_activity.js --years 1
//   node scripts/backfill_activity.js --channel 860905708177063956
//   node scripts/backfill_activity.js --purge            # wipe window + rescan
//
// Interrupt it (ctrl-c) and run it again - progress is checkpointed on whole-day
// boundaries per channel, so resuming never double counts and never drops a day.

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2');
const { REST } = require('@discordjs/rest');

global.config = require('../riskbot_config.json');

const ACTIVITY_TABLE = 'activity__discord_daily';
const DEFAULT_PROGRESS_FILE = path.join(__dirname, 'backfill_activity_progress.json');

// Each window gets its own progress file, so extending further back never disturbs the
// checkpoints of a run that already finished. Resolved in resolveWindow().
let PROGRESS_FILE = DEFAULT_PROGRESS_FILE;
const PAGE_SIZE = 100;                  // Discord's max per messages request
const PAGE_DELAY_MS = 250;              // politeness on top of the REST queue's own 429 handling
const FLUSH_ROWS = 500;                 // rows per multi-row INSERT

// discord.js treats every other message type as a system message, and so do we.
// 0 Default, 19 Reply, 20 ChatInputCommand, 23 ContextMenuCommand.
const COUNTED_MESSAGE_TYPES = new Set([0, 19, 20, 23]);

// ---------------------------------------------------------------- arguments

function printUsage() {
	console.log(`Backfills ${ACTIVITY_TABLE} from Discord channel history.

  --years N        how far back to go, in whole calendar years (default 3)
  --days N         window in days instead, for short top-ups and testing
  --until DATE     end the window at YYYY-MM-DD instead of today
  --extend-back N  go N more years back from where an earlier run stopped
  --channel ID     only this watchlist channel
  --no-threads     skip threads (forum channels hold all their messages in threads)
  --dry-run        count and report, write nothing, leave no checkpoints
  --purge          delete the window for these channels first, then rebuild it
  --force          add on top of rows that already exist (can double counts)
  --reset          ignore the saved checkpoints and start the scan over
  --progress PATH  use a specific progress file
  --help

Counts are added to the table, so re-scanning a channel that already has rows would
inflate them; the script refuses unless you pass --purge or --force. Channels already
tracked in the progress file are exempt - they resume safely - so adding a new channel
to the watchlist and simply re-running does the right thing.

Interrupt it freely: progress is checkpointed after every page and resuming re-reads
nothing it already counted. Today is never touched - the live tracker in
modules/activityTracker.js owns it.

Going further back once a run has finished, without redoing any of it:
  node scripts/backfill_activity.js --extend-back 2
The previous window's start becomes this one's end, and the slice gets its own
progress file, so the two never interfere.`);
}

function parseArgs(argv) {
	const opts = { years: 3, days: null, until: null, extendBack: null, progress: null,
		dryRun: false, purge: false, force: false, reset: false, threads: true, channel: null };

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--dry-run') opts.dryRun = true;
		else if (arg === '--purge') opts.purge = true;
		else if (arg === '--force') opts.force = true;
		else if (arg === '--reset') opts.reset = true;
		else if (arg === '--no-threads') opts.threads = false;
		else if (arg === '--years') opts.years = Number(argv[++i]);
		else if (arg === '--days') opts.days = Number(argv[++i]);
		else if (arg === '--until') opts.until = String(argv[++i]);
		else if (arg === '--extend-back') opts.extendBack = Number(argv[++i]);
		else if (arg === '--progress') opts.progress = String(argv[++i]);
		else if (arg === '--channel') opts.channel = String(argv[++i]);
		else if (arg === '--help' || arg === '-h') { printUsage(); process.exit(0); }
		else {
			console.error(`Unknown argument: ${arg}`);
			process.exit(1);
		}
	}

	if (!Number.isFinite(opts.years) || opts.years <= 0) {
		console.error('--years must be a positive number');
		process.exit(1);
	}

	if (opts.days !== null && (!Number.isFinite(opts.days) || opts.days <= 0)) {
		console.error('--days must be a positive number');
		process.exit(1);
	}

	if (opts.extendBack !== null && (!Number.isFinite(opts.extendBack) || opts.extendBack <= 0)) {
		console.error('--extend-back must be a positive number of years');
		process.exit(1);
	}

	if (opts.until !== null && !/^\d{4}-\d{2}-\d{2}$/.test(opts.until)) {
		console.error('--until must be a date as YYYY-MM-DD');
		process.exit(1);
	}

	if (opts.extendBack !== null && opts.until !== null) {
		console.error('--extend-back derives its own end date; do not combine it with --until');
		process.exit(1);
	}

	// Purging the window invalidates every checkpoint that pointed into it.
	if (opts.purge) opts.reset = true;

	return opts;
}

const opts = parseArgs(process.argv.slice(2));

// ---------------------------------------------------------------- time helpers

// Everything is bucketed on UTC days: the MySQL server clock is UTC, so this matches
// the DATE(NOW()) the live tracker writes.
function utcDay(date) {
	return date.toISOString().slice(0, 10);
}

function sqlDateTime(date) {
	return date.toISOString().slice(0, 19).replace('T', ' ');
}

function startOfUtcDay(date) {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Reads the window (and checkpoints) out of a progress file, or null if unusable.
function readProgressFile(file) {
	if (!fs.existsSync(file)) return null;

	try {
		const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
		if (!saved.cutoff || !saved.stopAt) return null;
		return saved;
	} catch {
		return null;
	}
}

function yearsBefore(date, years) {
	return startOfUtcDay(new Date(Date.UTC(
		date.getUTCFullYear() - Math.floor(years),
		date.getUTCMonth(),
		date.getUTCDate()
	)));
}

// Sits alongside the run it extends, so a custom --progress location stays honoured.
function progressPathFor(from, to, dir) {
	return path.join(dir, `backfill_activity_progress_${utcDay(from)}_${utcDay(to)}.json`);
}

const now = new Date();

let stopAt;
let cutoff;
let pinned = null;
let extendedFrom = null;

// Works out which slice of history this run covers and which progress file tracks it.
//
// A full backfill runs for hours and can cross midnight, so the window is pinned in its
// progress file and re-adopted on resume - recomputing it from the new "today" would
// orphan every checkpoint and force a needless --purge.
function resolveWindow() {
	// --extend-back continues an earlier run further into the past. The previous
	// window's cutoff becomes this window's end, so the two slices abut exactly: no
	// gap, no overlap, and nothing already counted is visited again.
	if (opts.extendBack !== null) {
		const baseFile = opts.progress !== null ? opts.progress : DEFAULT_PROGRESS_FILE;
		const base = readProgressFile(baseFile);

		if (base === null) {
			console.error(`--extend-back needs an existing progress file to continue from.`);
			console.error(`Looked for: ${baseFile}`);
			process.exit(1);
		}

		const baseUnits = Object.values(base.units || {});
		const basePending = baseUnits.filter(u => !u.done).length;

		extendedFrom = { file: baseFile, cutoff: base.cutoff, stopAt: base.stopAt, pending: basePending };
		stopAt = new Date(base.cutoff);
		cutoff = yearsBefore(stopAt, opts.extendBack);
		PROGRESS_FILE = progressPathFor(cutoff, stopAt, path.dirname(baseFile));

		// Resuming the extension itself: its own file is the authority on the window.
		if (!opts.dryRun && !opts.reset) pinned = readProgressFile(PROGRESS_FILE);
		if (pinned !== null) {
			stopAt = new Date(pinned.stopAt);
			cutoff = new Date(pinned.cutoff);
		}
		return;
	}

	PROGRESS_FILE = opts.progress !== null ? opts.progress : DEFAULT_PROGRESS_FILE;
	if (!opts.dryRun && !opts.reset) pinned = readProgressFile(PROGRESS_FILE);

	if (pinned !== null) {
		stopAt = new Date(pinned.stopAt);
		cutoff = new Date(pinned.cutoff);
		return;
	}

	// Today belongs to the live tracker - it is already incrementing today's rows, and
	// counting the same messages here would double them. The backfill stops at midnight.
	stopAt = opts.until !== null ? new Date(`${opts.until}T00:00:00.000Z`) : startOfUtcDay(now);

	// Floored to a day boundary so the oldest day in the window is whole, not a part-day.
	// --years steps back whole calendar years so "3 years" lands on the same date; --days
	// is there for short windows (testing, topping up a gap) whole years cannot express.
	cutoff = opts.days !== null
		? new Date(stopAt.getTime() - opts.days * 24 * 60 * 60 * 1000)
		: yearsBefore(stopAt, opts.years);
}

resolveWindow();

if (!(stopAt > cutoff)) {
	console.error(`Empty window: ${utcDay(cutoff)} .. ${utcDay(stopAt)}`);
	process.exit(1);
}

// Discord ids are timestamps shifted left 22 bits from 2015-01-01, and the `before`
// parameter is a plain id comparison - so a synthetic id lets a scan jump straight to
// the end of its window instead of paging back through every newer message first.
const DISCORD_EPOCH = 1420070400000n;

function snowflakeAt(date) {
	return String((BigInt(date.getTime()) - DISCORD_EPOCH) << 22n);
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------- discord REST

const rest = new REST({ version: '10' }).setToken(global.config.token);

// Returns null when the channel is gone or the bot cannot see it, so one bad channel
// in the watchlist never aborts the whole run.
async function restGet(route, label) {
	try {
		return await rest.get(route);
	} catch (error) {
		const status = error.status || error.code;
		if (status === 403 || status === 404 || status === 50001 || status === 10003) {
			console.log(`    skipped ${label}: no access (${status})`);
			return null;
		}
		throw error;
	}
}

async function fetchMessagePage(channelId, beforeId) {
	let route = `/channels/${channelId}/messages?limit=${PAGE_SIZE}`;
	if (beforeId) route += `&before=${beforeId}`;
	return restGet(route, `channel ${channelId}`);
}

// Every thread under `channelId` whose activity could fall inside the window: the
// currently active ones plus archived public/private ones archived after the cutoff.
async function fetchThreads(guildId, channelId) {
	const threads = [];

	const active = await restGet(`/guilds/${guildId}/threads/active`, `active threads in ${guildId}`);
	if (active && Array.isArray(active.threads)) {
		for (const thread of active.threads) {
			if (thread.parent_id === channelId) threads.push(thread);
		}
	}

	for (const kind of ['public', 'private']) {
		let before = null;
		for (;;) {
			let route = `/channels/${channelId}/threads/archived/${kind}?limit=100`;
			if (before) route += `&before=${encodeURIComponent(before)}`;

			const page = await restGet(route, `archived ${kind} threads of ${channelId}`);
			if (!page || !Array.isArray(page.threads) || page.threads.length === 0) break;

			let reachedCutoff = false;
			for (const thread of page.threads) {
				const archivedAt = thread.thread_metadata && thread.thread_metadata.archive_timestamp;
				// Archiving happens after the last message, so an older archive stamp
				// means the whole thread predates the window.
				if (archivedAt && new Date(archivedAt) < cutoff) { reachedCutoff = true; continue; }
				threads.push(thread);
			}

			const last = page.threads[page.threads.length - 1];
			before = last.thread_metadata && last.thread_metadata.archive_timestamp;
			if (!page.has_more || !before || reachedCutoff) break;

			await sleep(PAGE_DELAY_MS);
		}
	}

	return threads;
}

// ---------------------------------------------------------------- mysql

const pool = mysql.createPool({
	host: global.config.mysql_host,
	user: global.config.mysql_username,
	password: global.config.mysql_password,
	database: global.config.mysql_database,
	connectionLimit: 2,
	supportBigNumbers: true,
	bigNumberStrings: true
});

function query(sql, params) {
	return new Promise((resolve, reject) => {
		pool.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
	});
}

const TABLE = "`" + global.config.mysql_database + "`.`" + ACTIVITY_TABLE + "`";

// Adds to whatever is already stored, so a channel and each of its threads can all
// contribute to the same (day, server, channel, user) row.
async function writeRows(rows) {
	if (rows.length === 0 || opts.dryRun) return;

	const sql = "INSERT INTO " + TABLE
		+ " (`day`,`serverid`,`channelid`,`userid`,`messages`,`firstmessage`,`lastmessage`) VALUES ?"
		+ " ON DUPLICATE KEY UPDATE `messages` = `messages` + VALUES(`messages`),"
		+ " `firstmessage` = LEAST(`firstmessage`, VALUES(`firstmessage`)),"
		+ " `lastmessage` = GREATEST(`lastmessage`, VALUES(`lastmessage`))";

	for (let i = 0; i < rows.length; i += FLUSH_ROWS) {
		await query(sql, [rows.slice(i, i + FLUSH_ROWS)]);
	}
}

// ---------------------------------------------------------------- progress file

function loadProgress() {
	// A dry run must leave no checkpoints behind, or the real run that follows would
	// resume from them and skip everything the dry run "scanned" without writing.
	if (opts.dryRun) return null;
	if (opts.reset || !fs.existsSync(PROGRESS_FILE)) return null;

	try {
		const saved = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
		// The window came from this same file, so a mismatch here should be impossible.
		if (saved.cutoff !== cutoff.toISOString() || saved.stopAt !== stopAt.toISOString()) {
			console.log('Progress file window does not match, starting fresh.');
			return null;
		}
		return saved;
	} catch {
		return null;
	}
}

let progress = null;

function saveProgress() {
	if (opts.dryRun) return;
	fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf8');
}

// ---------------------------------------------------------------- watchlist

// Same flattening the live tracker does, so both count exactly the same channels.
function buildTargets() {
	const targets = [];
	const watchlist = global.config.activity_watchlist_channels || {};

	for (const guildName of Object.keys(watchlist)) {
		const serverId = global.config.guilds[guildName];
		if (serverId === undefined) {
			console.error(`Unknown guild '${guildName}' in activity_watchlist_channels, skipping`);
			continue;
		}
		for (const channelId of watchlist[guildName]) {
			if (opts.channel !== null && String(channelId) !== opts.channel) continue;
			targets.push({ guildName, serverId: String(serverId), channelId: String(channelId) });
		}
	}

	return targets;
}

// ---------------------------------------------------------------- scanning

const totals = { scanned: 0, counted: 0, skipped: 0, rows: 0, units: 0, noAccess: 0 };

// Walks one channel or thread backwards through its history.
//
// Messages come back newest-first, so as soon as a message from an older day appears
// the day we were accumulating is complete and gets written. Counts are added to the
// table, so the checkpoint has to guarantee no message is ever counted twice: after
// every page we persist both the resume anchor and the half-finished day's tally, and
// a resumed run restores that tally instead of re-reading those messages. A day is
// written exactly once, when it ends.
async function scanUnit(unitId, unit) {
	const state = progress.units[unitId];
	if (state.done) { totals.skipped++; return; }

	// With no checkpoint yet, start at the newest message that can be in the window
	// rather than at the newest message in the channel. For a slice that ends years ago
	// this is the difference between one request and thousands of discarded ones.
	let beforeId = state.beforeId || snowflakeAt(stopAt);
	let currentDay = state.pendingDay || null;
	// Restore the partially counted day a previous run left behind, if any.
	let perUser = new Map(Object.entries(state.pending || {}));
	let lastSeenId = state.beforeId || null;   // oldest message handled so far, our resume anchor
	let counted = 0;
	let scanned = 0;
	let pages = 0;

	if (currentDay !== null) {
		console.log(`    ${unit.label}: resuming inside ${currentDay} with ${perUser.size} users already tallied`);
	}

	// Records the resume anchor plus the day still being accumulated, so a crash costs
	// at most the page in flight rather than the whole day.
	function checkpoint() {
		// Nothing handled yet - leave the anchor alone rather than blanking it.
		if (lastSeenId !== null) state.beforeId = lastSeenId;
		state.pendingDay = currentDay;
		state.pending = Object.fromEntries(perUser);
		state.counted = (state.counted || 0) + counted;
		state.scanned = (state.scanned || 0) + scanned;
		counted = 0;
		scanned = 0;
		saveProgress();
	}

	// Writes the finished day and clears it from the checkpoint in one step, so the
	// day is never both written and still pending.
	async function flushDay() {
		if (currentDay !== null && perUser.size > 0) {
			const rows = [];
			for (const [userId, agg] of perUser) {
				rows.push([currentDay, unit.serverId, unit.channelId, userId, agg.count, agg.first, agg.last]);
			}

			await writeRows(rows);
			totals.rows += rows.length;
		}

		perUser = new Map();
		currentDay = null;
		checkpoint();
	}

	let noAccess = false;

	for (;;) {
		const page = await fetchMessagePage(unitId, beforeId);
		if (page === null) { noAccess = true; break; }
		if (!Array.isArray(page) || page.length === 0) break;

		pages++;
		let reachedCutoff = false;

		for (const message of page) {
			const created = new Date(message.timestamp);

			if (created < cutoff) { reachedCutoff = true; break; }
			// Safety net: the snowflake anchor means we should never see these.
			if (created >= stopAt) { lastSeenId = message.id; continue; }

			const day = utcDay(created);
			if (currentDay !== null && day !== currentDay) {
				await flushDay();
			}
			currentDay = day;
			scanned++;

			if (message.author && !message.author.bot && !message.webhook_id
				&& COUNTED_MESSAGE_TYPES.has(message.type)) {
				const userId = String(message.author.id);
				const stamp = sqlDateTime(created);
				const agg = perUser.get(userId);
				if (agg === undefined) {
					perUser.set(userId, { count: 1, first: stamp, last: stamp });
				} else {
					agg.count++;
					// Descending order, so each new message is the earlier one.
					agg.first = stamp;
				}
				counted++;
			}

			lastSeenId = message.id;
		}

		if (pages % 20 === 0) {
			const oldest = page.length > 0 ? new Date(page[page.length - 1].timestamp).toISOString().slice(0, 10) : '?';
			console.log(`    ${unit.label}: ${pages} pages, back to ${oldest}, ${state.counted + counted} counted`);
		}

		checkpoint();

		if (reachedCutoff || page.length < PAGE_SIZE) break;

		beforeId = page[page.length - 1].id;
		await sleep(PAGE_DELAY_MS);
	}

	// Nothing older is coming from this unit, so the open day is complete too.
	await flushDay();

	// A unit we could not read is deliberately left un-done: if the bot is later given
	// access, re-running picks it up instead of treating the gap as finished.
	if (noAccess) {
		totals.noAccess++;
		saveProgress();
		console.log(`    ${unit.label}: NO ACCESS - not marked done, re-run after fixing permissions`);
		return;
	}

	state.done = true;
	state.pending = undefined;
	state.pendingDay = undefined;
	saveProgress();

	totals.scanned += state.scanned || 0;
	totals.counted += state.counted || 0;
	totals.units++;

	console.log(`    ${unit.label}: done - ${state.counted || 0} messages counted over ${pages} pages`);
}

// ---------------------------------------------------------------- guard

// The += writes mean a fresh scan over rows that already hold backfilled counts would
// inflate them. Refuse rather than silently corrupt the statistics.
//
// Only channels this run will genuinely re-scan matter. A channel the progress file
// already tracks is either finished (skipped) or mid-scan (resumed from a checkpoint
// that never re-reads a counted message), so its existing rows are not at risk - which
// is what lets you add a new channel to the watchlist and just re-run.
async function guardExistingRows(channelIds) {
	if (channelIds.length === 0) return;

	const sql = "SELECT COUNT(*) AS `rows`, COALESCE(SUM(`messages`),0) AS `messages` FROM " + TABLE
		+ " WHERE `channelid` IN (?) AND `day` >= ? AND `day` < ?";

	let rows;
	try {
		rows = await query(sql, [channelIds, utcDay(cutoff), utcDay(stopAt)]);
	} catch (error) {
		if (error.code === 'ER_NO_SUCH_TABLE') {
			if (opts.dryRun) {
				console.log('NOTE: table does not exist yet - fine for a dry run, nothing is written.');
				console.log('');
				return;
			}
			console.error('');
			console.error(`Table ${ACTIVITY_TABLE} does not exist yet. Create it first:`);
			console.error('  mysql -u root -p friendsofrisk < scripts/activity_tracking.sql');
			process.exit(1);
		}
		throw error;
	}

	const existing = rows[0];

	if (Number(existing.rows) === 0) return;

	if (opts.purge) {
		console.log(`Purging ${existing.rows} existing rows (${existing.messages} messages) in the window...`);
		if (!opts.dryRun) {
			await query("DELETE FROM " + TABLE + " WHERE `channelid` IN (?) AND `day` >= ? AND `day` < ?",
				[channelIds, utcDay(cutoff), utcDay(stopAt)]);
		}
		return;
	}

	if (opts.force) {
		console.log(`WARNING: ${existing.rows} rows already exist in the window and --force was given; counts will be added on top.`);
		return;
	}

	console.error('');
	console.error(`REFUSING TO RUN: ${existing.rows} rows (${existing.messages} messages) already exist`);
	console.error(`for these channels between ${utcDay(cutoff)} and ${utcDay(stopAt)}.`);
	console.error('');
	console.error('Counts are added, so scanning again from scratch would double them. Either:');
	console.error('  - drop --reset and re-run to resume from the saved checkpoints, or');
	console.error('  - re-run with --purge to delete that window and rebuild it, or');
	console.error('  - re-run with --force if you really do want to add on top.');
	process.exit(1);
}

// ---------------------------------------------------------------- main

async function main() {
	const targets = buildTargets();

	if (targets.length === 0) {
		console.error('No channels to scan.');
		process.exit(1);
	}

	console.log(`Backfilling ${ACTIVITY_TABLE}`);
	console.log(`  window   : ${utcDay(cutoff)} .. ${utcDay(stopAt)} (end exclusive)`);
	console.log(`  span     : ${Math.round((stopAt - cutoff) / 86400000)} days`);
	console.log(`  progress : ${PROGRESS_FILE}`);
	if (extendedFrom !== null) {
		console.log(`  extends  : ${utcDay(new Date(extendedFrom.cutoff))} .. ${utcDay(new Date(extendedFrom.stopAt))} (from ${path.basename(extendedFrom.file)})`);
		if (extendedFrom.pending > 0) {
			// Safe - the windows are disjoint - but the two runs would fight for the
			// same Discord rate limit and both crawl.
			console.log(`  NOTE     : that run still has ${extendedFrom.pending} unfinished unit(s).`);
			console.log(`             Let it finish first, unless those are channels the bot cannot read.`);
		}
	}
	console.log(`  channels : ${targets.length}`);
	console.log(`  threads  : ${opts.threads ? 'included' : 'skipped'}`);
	console.log(`  mode     : ${opts.dryRun ? 'DRY RUN - no writes' : 'writing'}`);
	console.log('');

	progress = loadProgress();
	if (progress === null) {
		progress = { cutoff: cutoff.toISOString(), stopAt: stopAt.toISOString(), units: {} };
	} else {
		const done = Object.values(progress.units).filter(u => u.done).length;
		console.log(`Resuming: ${done}/${Object.keys(progress.units).length} known units already done.`);
	}

	// Channels with no checkpoint yet are the ones about to be scanned from scratch -
	// newly added watchlist entries, or every channel on a fresh run.
	const unscanned = targets.filter(t => progress.units[t.channelId] === undefined);
	if (unscanned.length > 0 && unscanned.length < targets.length) {
		console.log(`New in the watchlist since the last run: ${unscanned.length} channel(s) - ${unscanned.map(t => t.channelId).join(', ')}`);
	}
	await guardExistingRows(unscanned.map(t => t.channelId));

	if (opts.dryRun) console.log('Dry run: no checkpoints are written, every channel is walked in full.');
	if (pinned !== null) {
		console.log('Window was pinned by this progress file; --years/--days/--until are ignored until --reset.');
	}

	for (const target of targets) {
		console.log(`[${target.guildName}] channel ${target.channelId}`);

		const units = new Map();
		units.set(target.channelId, {
			serverId: target.serverId,
			channelId: target.channelId,
			label: `#${target.channelId}`
		});

		if (opts.threads) {
			const threads = await fetchThreads(target.serverId, target.channelId);
			console.log(`    ${threads.length} threads in window`);
			for (const thread of threads) {
				units.set(String(thread.id), {
					serverId: target.serverId,
					channelId: target.channelId,     // thread messages count for the parent
					label: `thread ${thread.name || thread.id}`
				});
			}
		}

		for (const [unitId, unit] of units) {
			if (progress.units[unitId] === undefined) {
				progress.units[unitId] = { beforeId: null, done: false, counted: 0, scanned: 0 };
			}
			await scanUnit(unitId, unit);
		}
	}

	console.log('');
	console.log('Finished.');
	console.log(`  units scanned  : ${totals.units} (${totals.skipped} already done)`);
	if (totals.noAccess > 0) {
		console.log(`  UNREADABLE     : ${totals.noAccess} channels/threads the bot cannot read - see the 403s above`);
	}
	console.log(`  messages seen  : ${totals.scanned}`);
	console.log(`  messages counted: ${totals.counted}`);
	console.log(`  rows written   : ${totals.rows}${opts.dryRun ? ' (dry run - nothing written)' : ''}`);

	if (!opts.dryRun) {
		const check = await query("SELECT COUNT(*) AS `rows`, COALESCE(SUM(`messages`),0) AS `messages`,"
			+ " MIN(`day`) AS `from`, MAX(`day`) AS `to` FROM " + TABLE
			+ " WHERE `channelid` IN (?)", [targets.map(t => t.channelId)]);
		console.log(`  table now holds: ${check[0].rows} rows, ${check[0].messages} messages, ${check[0].from} .. ${check[0].to}`);
	}
}

let shuttingDown = false;
process.on('SIGINT', () => {
	if (shuttingDown) process.exit(1);
	shuttingDown = true;
	console.log('\nInterrupted - progress is checkpointed, re-run to resume from the last whole day.');
	process.exit(0);
});

main()
	.then(() => pool.end(() => process.exit(0)))
	.catch(error => {
		console.error('Backfill failed:', error);
		console.error('Progress is checkpointed - re-run to resume.');
		pool.end(() => process.exit(1));
	});
