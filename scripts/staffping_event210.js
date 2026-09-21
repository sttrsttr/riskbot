#!/usr/bin/env node
//
// ONE-OFF REPAIR for event 210: the /api/createthread call created every group thread
// but thread.send() failed on missing permissions, so create_thread returned nothing.
// Result: no staff ping in the threads and eventmanager__groups.threadid never stored.
//
// This script, for every group of the event with threadid IS NULL:
//   1. finds the matching active private thread "<roundname> <groupname>" in the event's mainchannel
//   2. sends the same staff ping create_thread sends
//   3. writes the thread id back to eventmanager__groups.threadid
//
// REST only (no gateway), so it is safe to run next to the pm2 bot.
//
//   node scripts/staffping_event210.js            # dry run: show what would happen
//   node scripts/staffping_event210.js --send     # actually ping and update the DB
//   node scripts/staffping_event210.js --send --event 210

const mysql = require('mysql2/promise');
const { REST } = require('@discordjs/rest');

global.config = require('../riskbot_config.json');

const args = process.argv.slice(2);
const SEND = args.includes('--send');
const eventArg = args.indexOf('--event');
const EVENTID = eventArg !== -1 ? parseInt(args[eventArg + 1], 10) : 210;
const DELAY_MS = 1200; // stay well clear of the channel message rate limit

const db = '`' + global.config.mysql_database + '`';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
	const rest = new REST({ version: '10' }).setToken(global.config.token);
	const pool = mysql.createPool({
		host: global.config.mysql_host,
		user: global.config.mysql_username,
		password: global.config.mysql_password,
		database: global.config.mysql_database,
		supportBigNumbers: true,
		bigNumberStrings: true, // snowflakes exceed Number precision
	});

	try {
		const [[event]] = await pool.query(
			'SELECT `id`, `name`, `serverid`, `mainchannel`, `staffrole` FROM ' + db + '.`eventmanager__events` WHERE `id` = ?', [EVENTID]);
		if (!event) throw new Error('Event ' + EVENTID + ' not found');
		console.log(`Event ${event.id}: ${event.name}\n  server ${event.serverid}  mainchannel ${event.mainchannel}  staffrole ${event.staffrole}`);

		const [groups] = await pool.query(
			'SELECT eg.`id`, eg.`name`, eg.`threadid`, r.`roundname` FROM ' + db + '.`eventmanager__groups` eg ' +
			'INNER JOIN ' + db + '.`eventmanager__rounds` r ON eg.`roundid` = r.`id` ' +
			'WHERE r.`eventid` = ? AND eg.`completed` IS NULL ORDER BY eg.`id`', [EVENTID]);
		const todo = groups.filter((g) => g.threadid === null);
		console.log(`${groups.length} open groups, ${todo.length} without a stored thread id`);

		const active = await rest.get(`/guilds/${event.serverid}/threads/active`);
		const threadsByName = new Map();
		for (const t of active.threads) {
			if (String(t.parent_id) === String(event.mainchannel)) threadsByName.set(t.name, t);
		}

		const content = `<@&${event.staffrole}> can all relax, I will be this groups host this round ❤️`;
		let sent = 0, missing = 0, failed = 0;

		for (const g of todo) {
			const threadName = `${g.roundname} ${g.name}`;
			const thread = threadsByName.get(threadName);
			if (!thread) {
				console.log(`  MISSING  group ${g.id} "${threadName}" - no active thread with that name`);
				missing++;
				continue;
			}
			if (!SEND) {
				console.log(`  DRY RUN  group ${g.id} "${threadName}" -> thread ${thread.id}`);
				continue;
			}
			try {
				const msg = await rest.post(`/channels/${thread.id}/messages`, {
					body: { content, allowed_mentions: { roles: [String(event.staffrole)], users: [] } },
				});
				await pool.query('UPDATE ' + db + '.`eventmanager__groups` SET `threadid` = ? WHERE `id` = ?', [thread.id, g.id]);
				console.log(`  SENT     group ${g.id} "${threadName}" -> thread ${thread.id}, message ${msg.id}`);
				sent++;
			} catch (err) {
				console.error(`  FAILED   group ${g.id} "${threadName}" thread ${thread.id}:`, err.message);
				failed++;
			}
			await sleep(DELAY_MS);
		}

		console.log(`\nDone. sent ${sent}, missing ${missing}, failed ${failed}${SEND ? '' : ' (dry run, nothing sent or written)'}`);
	} finally {
		await pool.end();
	}
})().catch((err) => {
	console.error(err);
	process.exit(1);
});
