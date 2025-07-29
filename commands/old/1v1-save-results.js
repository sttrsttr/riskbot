
// This command can be called to save any verified results manually.
// The same procedure is called each time someone reports a new results, but it may be
// necesarry to invoke this command manually from time to time (or after the very last
// results have been reported in the tournament)

// Load required modules and config
const { SlashCommandBuilder } = require('discord.js');
const { channel_main1v1, mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');
var mysql = require('mysql2');

// Register command
module.exports = {
	data: new SlashCommandBuilder()
	  .setName('1v1-save-result')
	  .setDescription('Save verified results to database'),
	async execute(interaction) {
	  try {
		const interactionUser = await interaction.guild.members.fetch(interaction.user.id);

		await interaction.deferReply({ ephemeral: false });

		let errors = "I am on it";

		await interaction.editReply({ content: errors });

		errors = "Verified results added to database";

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

		// Fetch any reports newer than 48 hours that havent been verified by both players yet
		var sql = "SELECT `id`, `reporter`, `playera`, `playerb` FROM `"+ mysql_database +"`.`1v1__reports` WHERE `verified` IS NULL AND `approved` IS NULL AND `validto` IS NULL AND `validfrom` > DATE_ADD(NOW(), INTERVAL -48 HOUR)";
		const result = await new Promise((resolve, reject) => {
		  con.query(sql, function (err, result) {
			if (err) reject(err);
			resolve(result);
		  });
		});
		var rows = result;
		var players = 0;
		var userlist = [];
		var reactioncount = 0;
		var reporter = 0;

		let currentDate = new Date();
		const start = currentDate.getTime();

		const msgcount = rows.length;

		// Loop through each report, and look for reactions on the message itself
		for (const message of rows) {
			currentDate = new Date();
			let timestamp = currentDate.getTime();
			console.log(message.id.toString() +": "+ timestamp);
			userlist = [];
			players = 2;
			reactioncount = 0;
			threshold = 2;
			msgid = message.id.toString();
			reporter = message.reporter.toString();
			user1 = message.playera.toString();
			user2 = message.playerb.toString();

			// Add both players to userlist
			userlist.push(user1);
			userlist.push(user2);

			// If one of the players reported, they dont need to react as well
			if (userlist.includes(reporter)) {
				reactioncount++;
				delete userlist[reporter];
			}
		  	var messageReacted = await interaction.client.channels.cache.get(channel_main1v1).messages.fetch(msgid);

			var reactions = await messageReacted.reactions.cache.get("✅");
			if (reactions) {
				var users = await reactions.users.fetch();
				// Loop through all users who reacted with the thumbs up emoji
				for (const userr of users) {
					// Check that reactions actually come from the players of this report
					if (userlist.includes(userr[1].id) && userr[1].id !== reporter) {
						reactioncount++;
					}
				}
			}

			var reactions = await messageReacted.reactions.cache.get("👍");
			if (reactions) {
				var users = await reactions.users.fetch();
				// Loop through all users who reacted with the thumbs up emoji
				for (const userr of users) {
					// Check that reactions actually come from the players of this report
					if (userlist.includes(userr[1].id) && userr[1].id !== reporter) {
						reactioncount++;
					}
				}
			}

			// Check that enough players have reacted
			if (reactioncount >= threshold) {
				var sql = "UPDATE `"+ mysql_database +"`.`1v1__reports` SET `verified` = NOW() WHERE `id` = "+ msgid +"";
				con.query(sql, function (err, result) {
					if (err) throw err;
				});
			}
			
		}

		con.end();

		currentDate = new Date();
		const end = currentDate.getTime();

		let runtime = end-start;

		errors = errors + "\nTotal run time: "+ runtime +"ms, running through "+ msgcount +" messages";

		// Job well done 
		await interaction.editReply({ content: errors });
	  } catch (error) {
		console.error(error);
		await interaction.editReply({ content: "Error saving verified results" });
	  }
	}
  };
  
