const { SlashCommandBuilder, Message } = require('discord.js');
var mysql = require('mysql2');
const { ladderbotlog } = require('../modules/ladderbotlog.js');
const { guilds, mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');

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
	  .setName('ladder-result')
	  .setDescription('Post results from a match')
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
	async execute(interaction, client) {
		await interaction.reply({ content: `I'm on it`, ephemeral: true });

	  try {


//		await interaction.reply({ content: "Give me a second please...\n"+ dmtargets, ephemeral: true });

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

		// Set up variables
		const interactionUser = await interaction.guild.members.fetch(interaction.user.id);
		const user1 = interaction.options.getUser('player1');
		const user2 = interaction.options.getUser('player2');
		const player1_score = parseFloat(interaction.options.getString('player1_points')) ?? 0;
		const player2_score = parseFloat(interaction.options.getString('player2_points')) ?? 0;
		const players = [];

		players[0] = {
			user: user1,
			score: player1_score			
		};
		players[1] = {
			user: user2,
			score: player2_score			
		};

		for (i = 0; i < players.length; i++) {
			// Make sure that all players exists in the participants table first
			const userid = players[i].user.id;
			let nickname = players[i].user.nickname;
			const globalname = players[i].user.globalName;
			const username = players[i].user.username;
			if (nickname == "undefined" || nickname == "") {
				nickname = globalname;
			}
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
				players[i].rank = 0;
			} else {
				players[i].rank = result[0].rank;
			}
		}


		let sql = "SELECT * FROM `"+ mysql_database +"`.`1v1ladder__challenges` WHERE `deadline` > NOW() AND (`player1` = "+ user2.id +" OR `player1` = "+ user1.id +") AND (`player2` = "+ user2.id +" OR `player2` = "+ user1.id +") AND `validto` IS NULL AND `played` IS NULL;";
		const result2 = await new Promise((resolve, reject) => {
		con.query(sql, function (err, result) {
			if (err) reject(err);
				resolve(result);
			});
		});
		const rows2 = result2;
		if (rows2.length == 0) {
			// Post message
			await interaction.followUp({ content: `I am so sorry, it doesnt seem like you have challenged eachother. I couldnt find any outstanding challenges to adhere the result to. Please send out the challenge first, and then report the results.`, ephemeral: true});
		} else {

		ladderbotlog(client, `${interaction.user.username} just posted some results`);

		var text = '\n\n+-------------------------+\n| 1v1 match report             \n+-------------------------+\n| '+ user1.toString() +': **'+ player1_score +'** points \n| '+ user2.toString() +': **'+ player2_score +'** points \n+-------------------------+\nBoth players need to react to this message with ✅ to verify the result.\n\n';
		const guild = await client.guilds.fetch(guilds.RETRYGAMES);
		const channel = await guild.channels.fetch('1191398301879259337');
		const replyMessage = await channel.send(text, { allowedMentions: { repliedUser: false } });
		await interaction.followUp({ content: `Results posted to https://discord.com/channels/681626969670156320/1191398301879259337`, ephemeral: true });

		// Post message
		if (replyMessage instanceof Message) {
			await replyMessage.react("✅");
		}

		// Add the game report to results
		sql = "INSERT INTO `"+ mysql_database +"`.`1v1ladder__results` (`guild`, `channelid`, `messageid`,`player1`, `player1_score`, `player2`, `player2_score`) VALUES ("+ replyMessage.guildId +", "+ replyMessage.channelId +", "+ replyMessage.id +", "+ user1.id +",'"+ player1_score +"','"+ user2.id +"','"+ player2_score +"');";
		try {
			const result3 = await new Promise((resolve, reject) => {
			con.query(sql, function (err, result) {
				if (err) reject(err);
					resolve(result);
				});
			});
			if (result3) {

				sql = "UPDATE `"+ mysql_database +"`.`1v1ladder__challenges` SET `played` = NOW() WHERE `deadline` > NOW() AND (`player1` = "+ user2.id +" OR `player1` = "+ user1.id +") AND (`player2` = "+ user2.id +" OR `player2` = "+ user1.id +") AND `validto` IS NULL AND `played` IS NULL;";
				const result2 = await new Promise((resolve, reject) => {
				con.query(sql, function (err, result) {
					if (err) reject(err);
						resolve(result);
					});
				});
		

			} else {
				await interaction.followUp({ content: "Something went horribly wrong when saving results to database, please try again later", ephemeral: true });
			}

		} catch (error) {
			// Handle errors
			console.error("Error:", error);
		}



		}




		con.end();


	  } catch (error) {
		console.error(error);
		await interaction.followUp({ content: "Something went horribly wrong, please try again later", ephemeral: true });
	  }
	}
  };
  
