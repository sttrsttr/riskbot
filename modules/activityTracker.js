// Counts how many messages each user posts per day in the channels listed under
// `activity_watchlist_channels` in riskbot_config.json, so the website can show
// per-server activity statistics.
//
// The bot has no MessageContent intent, so nothing about the message itself is
// available or stored - a row is only (day, serverid, channelid, userid) plus a
// running count. See scripts/activity_tracking.sql for the table.

var mysql = require('mysql2');

const ACTIVITY_TABLE = 'activity__discord_daily';

// Messages arrive one at a time and often in bursts, so we keep a pool open rather
// than opening a connection per message the way the command handlers do.
let pool = null;

// channelid -> serverid, built from the config watchlist.
let watchedChannels = null;

// A dead MySQL would otherwise write one error line per message posted.
let lastErrorLogged = 0;
const ERROR_LOG_INTERVAL_MS = 60000;

function getPool() {
	if (pool === null) {
		// bigNumberStrings keeps snowflakes exact - as JS numbers they lose their last digits.
		pool = mysql.createPool({
			host: global.config.mysql_host,
			user: global.config.mysql_username,
			password: global.config.mysql_password,
			database: global.config.mysql_database,
			connectionLimit: 4,
			supportBigNumbers: true,
			bigNumberStrings: true,
			enableKeepAlive: true
		});
	}
	return pool;
}

function logActivityError(error) {
	const now = Date.now();
	if (now - lastErrorLogged < ERROR_LOG_INTERVAL_MS) return;
	lastErrorLogged = now;
	console.error('Activity tracker error (further errors muted for 60s):', error.message || error);
}

// Flattens `activity_watchlist_channels` ({ GUILDNAME: [channelid, ...] }) into a
// channelid -> serverid map. Guild names are resolved through `config.guilds`; a
// watchlist entry naming a guild the bot does not know about is skipped, since that
// is a config typo rather than something we should silently track.
function buildWatchlist() {
	const channels = new Map();
	const watchlist = global.config.activity_watchlist_channels || {};

	for (const guildName of Object.keys(watchlist)) {
		const serverId = global.config.guilds[guildName];
		if (serverId === undefined) {
			console.error(`Activity tracker: unknown guild '${guildName}' in activity_watchlist_channels, skipping its channels`);
			continue;
		}
		for (const channelId of watchlist[guildName]) {
			channels.set(String(channelId), String(serverId));
		}
	}

	return channels;
}

function getWatchedChannels() {
	if (watchedChannels === null) watchedChannels = buildWatchlist();
	return watchedChannels;
}

// Re-reads the watchlist from global.config, for when the config is reloaded without
// restarting the bot. Returns how many channels are being watched.
function refreshActivityWatchlist() {
	watchedChannels = buildWatchlist();
	console.log(`Activity tracker: watching ${watchedChannels.size} channels`);
	return watchedChannels.size;
}

// Returns the watched channel id a message belongs to, or null when the message is
// somewhere we don't track. Messages posted in a thread count towards the channel the
// thread hangs under, so thread chatter isn't lost just because the thread id is new.
// Only threads follow their parent - a plain channel's parent is its category, which
// would otherwise pull in every channel under a watched id.
function watchedChannelFor(message) {
	const watched = getWatchedChannels();
	const channel = message.channel;

	if (watched.has(message.channelId)) return message.channelId;

	if (channel && channel.isThread && channel.isThread() && watched.has(channel.parentId)) {
		return channel.parentId;
	}

	return null;
}

// Bumps today's counter for this author. Fire-and-forget on purpose: message tracking
// must never delay or break the rest of the messageCreate handling.
function trackMessage(message) {
	try {
		if (!message.guildId) return;                       // DMs are never on a watchlist
		if (!message.author || message.author.bot) return;
		if (message.system) return;

		const channelId = watchedChannelFor(message);
		if (channelId === null) return;

		// DATE(NOW()) buckets on the MySQL server clock, the same clock every other
		// timestamp in this database is written with.
		const sql = "INSERT INTO `" + global.config.mysql_database + "`.`" + ACTIVITY_TABLE + "` "
			+ "(`day`,`serverid`,`channelid`,`userid`,`messages`,`firstmessage`,`lastmessage`) "
			+ "VALUES (DATE(NOW()),?,?,?,1,NOW(),NOW()) "
			+ "ON DUPLICATE KEY UPDATE `messages` = `messages` + 1, `lastmessage` = NOW()";

		getPool().query(sql, [message.guildId, channelId, message.author.id], (err) => {
			if (err) logActivityError(err);
		});
	} catch (error) {
		logActivityError(error);
	}
}

module.exports = {
	trackMessage,
	refreshActivityWatchlist,
	getWatchedChannels,
	ACTIVITY_TABLE
};
