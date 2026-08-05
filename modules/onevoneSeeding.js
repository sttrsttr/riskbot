var mysql = require('mysql2');

const LEADERBOARD_TABLE = 'leaderboard__sabr1v1';

// Looks up SABR 1v1 ladder positions for the given Discord ids. `playerid` on the
// leaderboard is the Discord id, and a lower `rank` is a better player.
// Resolves to a Map of playerId -> rank, holding only the players that are ranked.
function fetchSeedRanks(playerIds) {
	return new Promise((resolve, reject) => {
		// Discord ids only ever contain digits; anything else never reaches the query.
		const ids = [...new Set(playerIds.map(id => String(id)))].filter(id => /^\d+$/.test(id));

		if (ids.length === 0) {
			resolve(new Map());
			return;
		}

		// bigNumberStrings keeps snowflakes exact - as JS numbers they lose their last digits.
		const con = mysql.createConnection({
			host: global.config.mysql_host,
			user: global.config.mysql_username,
			password: global.config.mysql_password,
			supportBigNumbers: true,
			bigNumberStrings: true
		});

		const sql = "SELECT `playerid`, `rank` FROM `" + global.config.mysql_database + "`.`" + LEADERBOARD_TABLE + "` WHERE `playerid` IN (?)";

		con.query(sql, [ids], (err, rows) => {
			con.end();

			if (err) {
				reject(err);
				return;
			}

			const ranks = new Map();
			for (const row of rows) {
				const rank = Number(row.rank);
				if (!Number.isFinite(rank)) continue;
				ranks.set(String(row.playerid), rank);
			}

			resolve(ranks);
		});
	});
}

module.exports = { fetchSeedRanks, LEADERBOARD_TABLE };
