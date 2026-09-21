// Watches the Friends of Risk live schedule and, when a scheduled game starts while
// one of its players is live on Twitch, creates a Discord scheduled event (external,
// one hour long, location = the Twitch channel) in the MAIN guild.
//
// Data source: https://friendsofrisk.com/openapi/getLiveSchedule/filter/live, which
// returns not-completed games from 15 minutes ago onward where at least one streamer
// in the lobby is live. The Twitch checker behind it runs every 5 minutes, so we poll
// at the same cadence and never faster.
//
// Duplicate protection: every event we create carries a "for-group:<groupid>" marker in
// its description. Before creating anything we fetch the guild's existing scheduled
// events and skip any group that already has one. A process-local set backs that up
// for events that have already finished/vanished from Discord.

const https = require('https');
const { GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel, GuildScheduledEventStatus } = require('discord.js');

const LIVE_SCHEDULE_URL = 'https://friendsofrisk.com/openapi/getLiveSchedule/filter/live';
const EVENT_DURATION_MS = 60 * 60 * 1000;
// Games starting this far into the future still count as "starting now" - one poll cycle.
const UPCOMING_WINDOW_MS = 5 * 60 * 1000;
// Discord rejects start times in the past, so an in-progress game gets this buffer.
const START_BUFFER_MS = 60 * 1000;
const MARKER_PREFIX = 'for-group:';

const announcedGroups = new Set();
let polling = false;

function fetchJson(url) {
	return new Promise((resolve, reject) => {
		const req = https.get(url, { headers: { 'Accept': 'application/json' } }, (resp) => {
			let data = '';
			resp.on('data', (chunk) => { data += chunk; });
			resp.on('end', () => {
				if (resp.statusCode !== 200) {
					return reject(new Error(`HTTP ${resp.statusCode} from ${url}: ${data.slice(0, 200)}`));
				}
				try {
					resolve(JSON.parse(data));
				} catch (error) {
					reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
				}
			});
		});
		req.on('error', reject);
		req.setTimeout(15000, () => req.destroy(new Error(`Timeout fetching ${url}`)));
	});
}

function groupMarker(groupid) {
	return `${MARKER_PREFIX}${groupid}`;
}

// Collects the group ids of events we already created, from their description markers.
function findAnnouncedGroupIds(scheduledEvents) {
	const ids = new Set();
	const pattern = new RegExp(`${MARKER_PREFIX}(\\d+)`);
	for (const event of scheduledEvents.values()) {
		const match = (event.description || '').match(pattern);
		if (match) ids.add(Number(match[1]));
	}
	return ids;
}

function truncate(text, max) {
	return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

// The game is "starting now" when it is already running (API keeps it for 15 minutes
// after gametime) or starts within the next poll cycle.
function isStartingNow(game, now) {
	const start = game.gametime_unix * 1000;
	return start <= now + UPCOMING_WINDOW_MS;
}

function buildEvent(game, liveStreamers, now) {
	// Discord allows a single location, so the busiest stream is the headline and the
	// rest are linked in the description.
	const [primary, ...others] = [...liveStreamers].sort((a, b) => (b.viewers || 0) - (a.viewers || 0));

	const gameStart = game.gametime_unix * 1000;
	const startTime = Math.max(gameStart, now + START_BUFFER_MS);
	const endTime = startTime + EVENT_DURATION_MS;

	const name = truncate(`🔴 ${primary.name} streaming ${game.eventname} ${game.groupname}`, 100);

	let description = `**${game.eventname}** · ${game.roundname} · ${game.groupname}\n`;
	description += `Game starts <t:${game.gametime_unix}:R>\n\n`;
	description += `**Live on Twitch**\n`;
	for (const streamer of [primary, ...others]) {
		const title = streamer.stream_title ? ` — ${streamer.stream_title}` : '';
		description += `• [${streamer.name}](${streamer.url})${title}\n`;
	}
	const playerNames = game.players.map(p => p.name || 'Unknown').join(', ');
	description += `\n**Players**\n${playerNames}\n`;
	description += `\n[Group page](${game.url})`;
	description += `\n\n${groupMarker(game.groupid)}`;

	return {
		name,
		description: truncate(description, 1000),
		scheduledStartTime: new Date(startTime),
		scheduledEndTime: new Date(endTime),
		privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
		entityType: GuildScheduledEventEntityType.External,
		entityMetadata: { location: primary.url },
		reason: `Streamer ${primary.name} live for ${game.eventname} ${game.groupname}`
	};
}

async function checkLiveStreams() {
	if (polling) return; // previous run still going (slow API / Discord)
	polling = true;

	try {
		const guildId = global.config.guilds.MAIN;
		if (guildId === undefined) {
			console.log('Stream watcher: no MAIN guild configured, skipping.');
			return;
		}

		const schedule = await fetchJson(LIVE_SCHEDULE_URL);
		const games = Array.isArray(schedule.games) ? schedule.games : [];
		if (games.length === 0) return;

		const now = Date.now();
		const candidates = games.filter(game => game.any_live && isStartingNow(game, now) && !announcedGroups.has(game.groupid));
		if (candidates.length === 0) return;

		const guild = await global.client.guilds.fetch(guildId);
		// If this fetch fails we bail out of the whole run rather than risk a duplicate.
		const existingEvents = await guild.scheduledEvents.fetch();
		const alreadyAnnounced = findAnnouncedGroupIds(existingEvents);

		for (const game of candidates) {
			if (alreadyAnnounced.has(game.groupid)) {
				announcedGroups.add(game.groupid);
				continue;
			}

			// Only streamers with a resolved channel url can be linked.
			const liveStreamers = (game.streamers || []).filter(s => s.live && s.url);
			if (liveStreamers.length === 0) {
				console.log(`Stream watcher: group ${game.groupid} is flagged live but no streamer has a Twitch url yet, retrying next poll.`);
				continue;
			}

			try {
				const payload = buildEvent(game, liveStreamers, now);
				const created = await guild.scheduledEvents.create(payload);
				announcedGroups.add(game.groupid);
				console.log(`Stream watcher: created event "${created.name}" (${created.id}) for group ${game.groupid}.`);

				// A game that already started should show as live right away instead of
				// "starting in a minute". Not fatal if Discord refuses.
				if (game.gametime_unix * 1000 <= now) {
					try {
						await created.setStatus(GuildScheduledEventStatus.Active);
					} catch (error) {
						console.error(`Stream watcher: could not activate event ${created.id}:`, error.message || error);
					}
				}
			} catch (error) {
				console.error(`Stream watcher: failed to create event for group ${game.groupid}:`, error.message || error);
			}
		}
	} catch (error) {
		console.error('Stream watcher error:', error.message || error);
	} finally {
		polling = false;
	}
}

module.exports = {
	checkLiveStreams,
	// exported for tests / manual checks
	_internal: { buildEvent, findAnnouncedGroupIds, isStartingNow }
};
