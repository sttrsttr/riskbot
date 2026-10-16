const { SlashCommandBuilder, quote } = require('discord.js');
const mysql = require('mysql2');
const { getKarmaScore, fetchMemberOrNull } = require('../modules/signuphandler.js');

// The players status in every active tournament they are signed up for. Noshows are not
// stored on the signup, they get the noshow role of the bracket, so that is read from the
// events server.
async function getTournamentStatuses(con, client, userid) {

	let sql = "SELECT e.`id`, e.`name`, e.`serverid`, s.`waitlist` FROM `" + global.config.mysql_database + "`.`eventmanager__signups` s INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__events` e ON s.`eventid` = e.`id` AND s.`playerid` = " + userid + " AND s.`validto` IS NULL AND e.`validto` IS NULL ORDER BY e.`id` DESC";
	const events = await new Promise((resolve, reject) => {
		con.query(sql, (err, result) => {
			if (err) return reject(err);
			resolve(result);
		});
	});

	if (events.length == 0) {
		return [];
	}

	const eventIds = events.map(event => event.id);

	sql = "SELECT `eventid`, `noshowrole` FROM `" + global.config.mysql_database + "`.`eventmanager__brackets` WHERE `eventid` IN (" + eventIds.join(',') + ") AND `noshowrole` IS NOT NULL";
	const brackets = await new Promise((resolve, reject) => {
		con.query(sql, (err, result) => {
			if (err) return reject(err);
			resolve(result);
		});
	});

	sql = "SELECT r.`eventid`, eg.`name`, eg.`gametime`, eg.`threadid` FROM `" + global.config.mysql_database + "`.`eventmanager__groupmembers` gm INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__groups` eg ON gm.`groupid` = eg.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` AND gm.`playerid` = " + userid + " AND gm.`validto` IS NULL AND eg.`completed` IS NULL AND r.`eventid` IN (" + eventIds.join(',') + ") ORDER BY eg.`gametime` ASC";
	const groups = await new Promise((resolve, reject) => {
		con.query(sql, (err, result) => {
			if (err) return reject(err);
			resolve(result);
		});
	});

	const lines = [];
	const seen = new Set();
	for (const event of events) {

		if (seen.has(event.id)) {
			continue;
		}
		seen.add(event.id);

		const guild = client.guilds.cache.get(event.serverid);
		const member = guild ? await fetchMemberOrNull(guild, userid).catch(() => null) : null;
		const noshowroles = brackets.filter(bracket => bracket.eventid == event.id).map(bracket => bracket.noshowrole);

		let status = 'Participant';
		if (member && noshowroles.some(roleid => member.roles.cache.has(roleid))) {
			status = 'Noshowed';
		} else if (event.waitlist) {
			status = 'Waitlisted';
		}

		// Unscheduled groups have the placeholder game time in year 4000
		for (const group of groups.filter(group => group.eventid == event.id)) {
			const gametime = new Date(group.gametime);
			const when = gametime.getUTCFullYear() >= 4000 ? 'unscheduled' : `<t:${Math.floor(gametime.getTime() / 1000)}:R>`;
			const where = group.threadid ? `<#${group.threadid}>` : group.name;
			status += ` - in ${where} (${when})`;
		}

		lines.push(`**${event.name}:** ${status}`);
	}

	return lines;
}

module.exports = {
	data: new SlashCommandBuilder()
	  .setName('getuserinfo')
	  .setDescription('Show a users info from Friends of Risk')
	.addUserOption(option =>
		option
		.setName('user')
		.setDescription('user')
		.setRequired(true)
	)
	,
	async execute(interaction, client) {
	  try {

		const optionUser = interaction.options.getUser('user');

		await interaction.reply({ content: "I am on it...  connecting to Friends of Risk now", flags: 64 });

		let con;
		try {

			const response = await fetch('https://friendsofrisk.com/api/getuser', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-API-KEY': 'AAAAB3NzaC1yc2EAAAADAQABAAABAQCjYnUwSJEdy8sZMH2E8cNh6q0oYNeAiQjkiTdG6R70ltGHXmGLnzkj0NGrNEiMAjrj4c9f'
				},
				body: JSON.stringify({ discordid: optionUser.id })
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			if (!data) {
				await interaction.followUp({ content: "User not found or no data available.", flags: 64 });
				return;
			}

			// API returns "data": [] for users that are not on Friends of Risk
			const foruser = data.data && !Array.isArray(data.data) ? data.data : null;

			con = mysql.createConnection({
				host: global.config.mysql_host,
				user: global.config.mysql_username,
				password: global.config.mysql_password,
				supportBigNumbers: true,
				bigNumberStrings: true
			});
			await new Promise((resolve, reject) => {
				con.connect(err => {
					if (err) return reject(err);
					resolve();
				});
			});

			// Same range as the website shows, which never goes below 0
			const karma = Math.max(0, Math.min(100, await getKarmaScore(con, optionUser.id)));
			const tournaments = await getTournamentStatuses(con, client, optionUser.id);

			let replymessage = `**FoR Information for ${optionUser.username}**\n`;
			if (foruser) {
				replymessage += `**Name on FoR:** ${foruser.name}\n`;
				replymessage += `**Profile:** https://friendsofrisk.com/player/${optionUser.id}/\n`;
			} else {
				replymessage += `**Name on FoR:** Not registered on Friends of Risk\n`;
			}
			replymessage += `**Karma:** ${karma} (https://friendsofrisk.com/karma/${optionUser.id}/)\n`;
			if (foruser) {
				replymessage += `**ELO rank:** ${foruser.ffa_elo_rank}\n`;
				replymessage += `**ELO score:** ${foruser.ffa_elo_score}\n`;
			}

			replymessage += `## Active tournaments\n`;
			if (tournaments.length == 0) {
				replymessage += `Not signed up for any active tournaments\n`;
			}

			// Stay below Discords 2000 character limit if they are in a lot of tournaments
			let content = replymessage;
			for (const line of tournaments) {
				if (content.length + line.length + 1 > 1900) {
					await interaction.followUp({ content: content, flags: 64, allowedMentions: { parse: [] } });
					content = '';
				}
				content += line + '\n';
			}
			await interaction.followUp({ content: content, flags: 64, allowedMentions: { parse: [] } });

		} catch (error) {
			console.error(error);
			await interaction.followUp({ content: "Error, I might not have the correct permissions to send messages to this channel.", flags: 64 });
		} finally {
			if (con) {
				con.end();
			}
		}


	  } catch (error) {
		console.error(error);
		await interaction.reply({ content: "Error, please try again later", flags: 64 });
	  }
	}
  };

