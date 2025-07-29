// This command let users report a 1v1 match and store it to a database for future verification
// It also looks at any previous reports and check if enough players have verified the results

// Optional parameter to be added during testing
//				.addStringOption(option =>
//					option.setName('ignore_rules')
//						.setDescription('Ignore all the rules?')
//						.setRequired(false)
//						.addChoices(
//							{ name: 'Yes', value: '1' },
//							{ name: 'No', value: '0' })
// )


// Load required modules and config
const { SlashCommandBuilder } = require('discord.js');
const { channel_main1v1, mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');
var mysql = require('mysql2');
const utf8 = require('utf8');

// Register command
module.exports = {
	data: new SlashCommandBuilder()
		.setName('1v1-result')
		.setDescription('Report result from a 1v1 casual league game')
				.addUserOption(option =>
					option
					.setName('player1')
					.setDescription('Player1')
					.setRequired(true)
				)
				.addStringOption(option =>
					option.setName('player1_points')
						.setDescription('Player1 points')
						.setRequired(true))
				.addUserOption(option =>
					option
					.setName('player2')
					.setDescription('Player2')
					.setRequired(true)
				)
				.addStringOption(option =>
					option.setName('player2_points')
						.setDescription('Player2 points')
						.setRequired(true)
				)
		,
		async execute(interaction) {
			const interactionUser = await interaction.guild.members.fetch(interaction.user.id);

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
				console.log("Connected to MySQL server!");
			});

			var is_error = 0;
			var errors = "Game report added.";

			// Get user input
			const user1 = interaction.options.getUser('player1');
			const user2 = interaction.options.getUser('player2');
			const player1_score = parseFloat(interaction.options.getString('player1_points')) ?? 0;
			const player2_score = parseFloat(interaction.options.getString('player2_points')) ?? 0;
			user1id = user1.id;
			user2id = user2.id;

			//const ignore_rules = interaction.options.getString('ignore_rules') ?? '0';
			const ignore_rules = '0';

			const userids = [user1id, user2id];

			const promises = userids.map((userID) => {
					return new Promise(async (resolve) => {
						const member = await interaction.guild.members.fetch(userID);
						resolve(member.displayName || member.user.username);
					});
			});

			const nicknames = await Promise.all(promises);
			// you now have access to ALL the nicknames, even if the members were not cached

			// Add discord users to lookup-table
			var sql = "REPLACE INTO `"+ mysql_database +"`.`rcl__discord_users` VALUES ("+ user1.id +",'"+ utf8.encode(nicknames[0].replace("'", "").substring(0,49)) +"')";
			con.query(sql, function (err, result) {
				if (err) throw err;
			});
			var sql = "REPLACE INTO `"+ mysql_database +"`.`rcl__discord_users` VALUES ("+ user2.id +",'"+ utf8.encode(nicknames[1].replace("'", "").substring(0,49)) +"')";
			con.query(sql, function (err, result) {
				if (err) throw err;
			});

			// Validate the report
			var sumscore = player1_score+player2_score;

			if (isNaN(player1_score) || isNaN(player2_score)) {
				errors = "Invalid score input. Please make sure to only type in numbers in the scoring field. Please try again.\n\nFor more info on how to use this bot, please see pinned messages in this channel. If you need further assistance ping Event Helper.";
				is_error = 1;
			} else if (user1id === user2id) {
				errors = "Player A and Player B cannot be the same user! Please try again.\n\nFor more info on how to use this bot, please see pinned messages in this channel. If you need further assistance ping Event Helper.";
				is_error = 1;
			} else if (player1_score.toString().indexOf(".") > 0 && player1_score.toString().indexOf(".") < 5 || player2_score.toString().indexOf(".") > 0 && player2_score.toString().indexOf(".") < 5) {
				errors = "Invalid results. Any player can only have full or half points. You have entered "+ player1_score +" for Player A and "+ player2_score +" for Player B.\n\nFor more info on how to use this bot, please see pinned messages in this channel. If you need further assistance ping Event Helper.";
				is_error = 1;
				

			} else if (sumscore > 4 && ignore_rules === '0') {
				errors = "Invalid results. The total points for both players should not be higher than 4. You have entered "+ player1_score +" for Player A and "+ player2_score +" for Player B.\n\nFor more info on how to use this bot, please see pinned messages in this channel. If you need further assistance ping Event Helper.";
				is_error = 1;
				
			} else if (sumscore < 4 && ignore_rules === '0') {
				errors = "Invalid results. The total points for both players should not be lower than 4. You have entered "+ player1_score +" for Player A and "+ player2_score +" for Player B.\n\nFor more info on how to use this bot, please see pinned messages in this channel. If you need further assistance ping Event Helper.";
				is_error = 1;
			} else {
				// All good so far
				var goon = 0;
				var sql = "SELECT 1 FROM `"+ mysql_database +"`.`1v1__reports` WHERE `validfrom` > DATE_ADD(NOW(), INTERVAL -1 WEEK) AND `validto` IS NULL AND ((`playera` = '"+ user1id +"' AND `playerb` = '"+ user2id +"') OR (`playerb` = '"+ user1id +"' AND `playera` = '"+ user2id +"'))";
				const result = await new Promise((resolve, reject) => {
					con.query(sql, function (err, result) {
					  if (err) reject(err);
					  resolve(result);
					});
				});
				var rows = result;
				if (rows.length > 0 && ignore_rules === '0') {
					errors = ""+ user1.toString() +" and "+ user2.toString() +" have already played the last 7 days, I cannot register a new match between them at this moment.\n\nFor more info on how to use this bot, please see pinned messages in this channel. If you need further assistance ping Event Helper.";
					is_error = 1;
				} else {
					goon = 1;
				}

				if (goon == 1) {

					/*
					// All good so far
					var goon = 0;
					var sql = "SELECT 1 FROM `"+ mysql_database +"`.`1v1__reports` WHERE `validto` IS NULL AND `playera` = '"+ user1id +"' OR `playerb` = '"+ user1id +"'";
					const resulta = await new Promise((resolve, reject) => {
						con.query(sql, function (err, result) {
						if (err) reject(err);
						resolve(result);
						});
					});
					var cnt_player1 = resulta;
					var sql = "SELECT 1 FROM `"+ mysql_database +"`.`1v1__reports` WHERE `validto` IS NULL AND `playera` = '"+ user2id +"' OR `playerb` = '"+ user2id +"'";
					const resultb = await new Promise((resolve, reject) => {
						con.query(sql, function (err, result) {
						if (err) reject(err);
						resolve(result);
						});
					});
					var cnt_player2 = resultb;
					if (cnt_player1.length > 4) {
						errors = ""+ user1.toString() +" have already played 5 matches, I cannot register a new match between them.\n\nFor more info on how to use this bot, please see pinned messages in this channel. If you need further assistance ping Event Helper.";
						is_error = 1;
					} else if (cnt_player2.length > 4) {
						errors = ""+ user2.toString() +" have already played 5 matches, I cannot register a new match between them.\n\nFor more info on how to use this bot, please see pinned messages in this channel. If you need further assistance ping Event Helper.";
						is_error = 1;
					} else {
						goon = 1;
					}
					*/

					if (goon == 1) {
						var text = '\n\n+-------------------------+\n| 1v1 match report             \n+-------------------------+\n| '+ user1.toString() +': **'+ player1_score +'** points \n| '+ user2.toString() +': **'+ player2_score +'** points \n+-------------------------+\nBoth players need to react to this message with ✅ to verify the result. If the results are not verified by 48 hours the match is no longer valid.\n\nVisit https://www.friendsofrisk.com/1v1 to see your standings\n\n';
						let message = await interaction.client.channels.cache.get(channel_main1v1).send(text);
						message.react("✅");
						var sql = "INSERT INTO `"+ mysql_database +"`.`1v1__reports` VALUES ("+ message.id +",NOW(),"+ interactionUser +","+ user1id +",'"+ player1_score +"',"+ user2id +",'"+ player2_score +"',NULL,NULL,NULL)";
						con.query(sql, function (err, result) {
							if (err) throw err;
						});
					}
				}
			}

  			con.end();

			if (is_error == 0) {
				await interaction.reply({ content: errors, ephemeral: false });
			} else {
				await interaction.reply({ content: errors, ephemeral: false });
			}
		}
};
