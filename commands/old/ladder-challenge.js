const { SlashCommandBuilder, Message } = require('discord.js');
const mysql = require('mysql2');
const { ladderbotlog } = require('../modules/ladderbotlog.js');
const { guilds,mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');


function padTo2Digits(num) {
	return num.toString().padStart(2, '0');
}  
function formatDate(date) {
	return [date.getFullYear(),padTo2Digits(date.getMonth() + 1), padTo2Digits(date.getDate()), ].join('-') + ' ' + [padTo2Digits(date.getHours()), padTo2Digits(date.getMinutes()),].join(':');
}
function getDeadline (hours) {
	const now = new Date();
	const tomorrow = new Date(now.getTime() + hours * 60 * 60 * 1000);
	return tomorrow;
}

async function addParticipant (userid, nickname, username, globalname) {
	// Connect to SQL database
	var con = mysql.createConnection({
		host: mysql_host,
		user: mysql_username,
		password: mysql_password,
		supportBigNumbers: true,
		bigNumberStrings: true
	});  
	con.connect(function(err) {
		if (err) throw err;
	});
	let sql = "INSERT INTO `"+ mysql_database +"`.`1v1ladder__participants` (`discorduserid`, `username`, `nickname`, `globalname`) VALUES ("+ userid +","+ con.escape(username) +","+ con.escape(nickname) +","+ con.escape(globalname) +");";
	try {
		const result = await new Promise((resolve, reject) => {
		con.query(sql, function (err, result) {
			if (err) reject(err);
				resolve(result);
			});
		});
	} catch (error) {
		// Handle errors
		console.error("Error:", error);
	}
	con.end();

}


module.exports = {
	data: new SlashCommandBuilder()
	  .setName('ladder-challenge')
	  .setDescription('Challenge the players above you')
	  .addStringOption(option =>
		option.setName('first_game')
			.setDescription('What game are you starting with?')
			.setRequired(true)
			.addChoices(
				{ name: 'Game 1', value: 'Game 1' },
				{ name: 'Game 2', value: 'Game 2' },
				{ name: 'Game 3', value: 'Game 3' },
				{ name: 'Game 4', value: 'Game 4' }
			)
		),
	async execute(interaction, client) {
	  try {

		var con = mysql.createConnection({
			host: mysql_host,
			user: mysql_username,
			password: mysql_password,
			supportBigNumbers: true,
			bigNumberStrings: true
		});  
		con.connect(function(err) {
			if (err) throw err;
		});

		const interactionUser = await interaction.guild.members.fetch(interaction.user.id);
		const game1 = interaction.options.getString('first_game') ?? 'undefined';
		let userid = interactionUser.user.id;

		const nickname = interactionUser.nickname || interactionUser.user.username || interactionUser.user.globalName;
		const globalname = interactionUser.user.globalName || interactionUser.user.username;
		const username = interactionUser.user.username;

		let rank = 0;

		let sql = "SELECT * FROM `"+ mysql_database +"`.`1v1ladder__participants` WHERE `discorduserid` = '"+ userid +"'";
		const result = await new Promise((resolve, reject) => {
		con.query(sql, function (err, result) {
			if (err) reject(err);
				resolve(result);
			});
		});
		const rows = result;
		if (rows.length == 0) {
			await addParticipant(userid, nickname, globalname, username);
		} else {
			rank = result[0].rank;
		}

		if (rank == 0) {
			rank = 99999999999999;
		}

		sql = "SELECT `discorduserid`, `rank` FROM `"+ mysql_database +"`.`1v1ladder__participants` WHERE `rank` < '"+ rank +"' ORDER BY `rank` DESC LIMIT 0,1";
		const above = await new Promise((resolve, reject) => {
		con.query(sql, function (err, result) {
			if (err) reject(err);
				resolve(result);
			});
		});

		if (above.length > 0) {

			let sqlmax = "SELECT MAX(`rank`) AS `maxrank` FROM `"+ mysql_database +"`.`1v1ladder__participants`";
			const maxrank = await new Promise((resolve, reject) => {
			con.query(sqlmax, function (err, result) {
				if (err) reject(err);
					resolve(result);
				});
			});	



			sql = "SELECT `player1`, `player2`, `deadline` FROM `"+ mysql_database +"`.`1v1ladder__challenges` WHERE `validto` IS NULL AND `deadline` > NOW() AND `played` IS NULL AND (`player1` = "+ above[0].discorduserid +" OR `player2`  = "+ above[0].discorduserid +")";
			const challenge = await new Promise((resolve, reject) => {
			con.query(sql, function (err, result) {
				if (err) reject(err);
					resolve(result);
				});
			});

			sql = "SELECT `player1`, `player2`, `deadline` FROM `"+ mysql_database +"`.`1v1ladder__challenges` WHERE `validto` IS NULL AND `deadline` > NOW() AND `played` IS NULL AND (`player2` = "+ userid +" OR `player1`  = "+ userid +")";
			const challenge2 = await new Promise((resolve, reject) => {
			con.query(sql, function (err, result) {
				if (err) reject(err);
					resolve(result);
				});
			});

			sql = "SELECT r.`player1`, r.`player2`, DATE_ADD(r.`validfrom`, INTERVAL 3 HOUR) AS `validfrom` FROM `"+ mysql_database +"`.`1v1ladder__results` r INNER JOIN `"+ mysql_database +"`.`1v1ladder__participants` p1 ON p1.`discorduserid` = r.`player1` INNER JOIN`"+ mysql_database +"`.`1v1ladder__participants` p2 ON p2.`discorduserid` = r.`player2` AND r.`validfrom` > DATE_ADD(NOW(), INTERVAL -3 HOUR) AND (r.`player2` = "+ userid +" OR r.`player1`  = "+ userid +" OR r.`player2` = "+ above[0].discorduserid +" OR r.`player1`  = "+ above[0].discorduserid +") AND p1.`rank` != "+ maxrank[0].maxrank +" AND p2.rank != "+ maxrank[0].maxrank +" AND 1 = 2";
			const cooldown = await new Promise((resolve, reject) => {
			con.query(sql, function (err, result) {
				if (err) reject(err);
					resolve(result);
				});
			});

			if (challenge.length > 0) {
				const deadline = new Date(challenge[0].deadline);
				const deadline_timestamp = Math.floor(deadline.getTime() / 1000);
				await interaction.reply({ content: `I am sorry, <@${challenge[0].player1}> has challenged <@${challenge[0].player2}> and they have until <t:${deadline_timestamp}> (your local time) to report their game results before any of them can be challenged again.`, ephemeral: true });

				ladderbotlog(client, `${interaction.user.username} tried to challenge someone but was stopped due to an open challenge`);

			} else if (challenge2.length > 0) {
				const deadline = new Date(challenge2[0].deadline);
				const deadline_timestamp = Math.floor(deadline.getTime() / 1000);
				await interaction.reply({ content: `I am sorry, you have already been challenged by <@${challenge2[0].player1}> and you have until <t:${deadline_timestamp}> (your local time) to report the game results before you can challenge anybody else.`, ephemeral: true });
				ladderbotlog(client, `${interaction.user.username} tried to challenge someone but was stopped due to an open challenge`);
			} else if (cooldown.length > 0) {
				const deadline = new Date(cooldown[0].validfrom);
				const deadline_timestamp = Math.floor(deadline.getTime() / 1000);
				if (cooldown[0].player1 == userid || cooldown[0].player2 == userid) {
					await interaction.reply({ content: `I am sorry, you are in a cooldown period until <t:${deadline_timestamp}> (your local time) before you can challenge anyone.`, ephemeral: true });
				} else {
					await interaction.reply({ content: `I am sorry, <@${above[0].discorduserid}> is in a cooldown period until <t:${deadline_timestamp}> (your local time) before they can accept any challenges.`, ephemeral: true });
				}
				ladderbotlog(client, `${interaction.user.username} tried to challenge someone but was stopped due to the 3 hour cooldown period`);
			} else {

				let timelimit = 48; // 2 days as default
				if (above[0].rank <= 5) {
					timelimit = 168; // 7 days for top5
				} else if (above[0].rank <= 10) {
					timelimit = 120; // 5 days for top10
				} else if (above[0].rank <= 15) {
					timelimit = 72; // 3 days for top15
				}

				let deadline = new Date(getDeadline(timelimit));
				const deadline_timestamp = Math.floor(deadline.getTime() / 1000);

				const message = `${interactionUser} would like to challenge <@${above[0].discorduserid}>, and the first game is going to be ${game1}. We have to report and verify the results (with /ladder-result) of the match by <t:${deadline_timestamp}> (your local time) or I will win automatically.`;
				const guild = await client.guilds.fetch(guilds.RETRYGAMES);
				const channel = await guild.channels.fetch('1202318462181965925');
				const replyMessage = await channel.send(message, { allowedMentions: { repliedUser: false } });
				await interaction.reply({ content: `Challenge has been sent to <@${above[0].discorduserid}> in the https://discord.com/channels/681626969670156320/1202318462181965925 We have to report and verify the results (with /ladder-result) of the match by <t:${deadline_timestamp}> (your local time) or I will win automatically.`, ephemeral: true });

				ladderbotlog(client, `${interaction.user.username} challenged the person above`);

				// Add the game report to results
				let sql3 = "INSERT INTO `"+ mysql_database +"`.`1v1ladder__challenges` (`guild`, `channelid`, `messageid`,`player1`, `player2`, `game1`, `deadline`) VALUES ("+ replyMessage.guildId +", "+ replyMessage.channelId +", "+ replyMessage.id +", "+ interactionUser.user.id +","+ above[0].discorduserid +",'"+ game1 +"','"+ formatDate(deadline) +"');";
					const result3 = await new Promise((resolve, reject) => {
					con.query(sql3, function (err, result) {
						if (err) reject(err);
							resolve(result);
						});
					});0
					if (result3) {
//						await interaction.followUp({ content: "Challenge saved to database (this is an debug message)", ephemeral: true });
					} else {
						await interaction.followUp({ content: "Something went horribly wrong when saving the challenge to database, please try again later", ephemeral: true });
					}
				}
		} else {
			await interaction.reply({ content: "There is noone above you on the ladder. That must mean you are #1, congrats! 🥳", ephemeral: true });
		}


		con.end();


	  } catch (error) {
		console.error(error);
		ladderbotlog(client, `${interaction.user.username} made me crash 😵‍💫`);
		await interaction.reply({ content: "Something went horribly wrong, please try again later", ephemeral: true });
	  }
	}
  };
  
