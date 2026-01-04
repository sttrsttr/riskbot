const { SlashCommandBuilder } = require('discord.js');
var mysql = require('mysql2');
const { mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');

module.exports = {
	data: new SlashCommandBuilder()
	  .setName('maketeamavailability')
	  .setDescription('Update your team availability at friendsofrisk based on these players')
	  .addStringOption(option =>
		option.setName('teamsize')
			.setDescription('How many players must be available at the same time?')
			.setRequired(true)
			.addChoices(
				{ name: '2v2', value: '2' },
				{ name: '3v3', value: '3' },
				{ name: '4v4', value: '4' })
		)
	  .addUserOption(option =>
		option
		.setName('user1')
		.setDescription('user1')
		.setRequired(true)
	)
	.addUserOption(option =>
		option
		.setName('user2')
		.setDescription('user2')
		.setRequired(true)
	)
	.addUserOption(option =>
		option
		.setName('user3')
		.setDescription('user3')
		.setRequired(false)
	)
	.addUserOption(option =>
		option
		.setName('user4')
		.setDescription('user4')
		.setRequired(false)
	)
		,
	async execute(interaction) {
	  try {


		// Connect to SQL database
		var con = mysql.createConnection({
			host: global.config.mysql_host,
			user: global.config.mysql_username,
			password: global.config.mysql_password,
			supportBigNumbers: true,
			bigNumberStrings: true
		});  
		con.connect(function(err) {
			if (err) throw err;
		});

		// Set up variables
		const interactionUser = await interaction.guild.members.fetch(interaction.user.id);

		let user = [];
		let userids = [];
		user[0] = interaction.options.getMember('user1');
		user[1] = interaction.options.getMember('user2');
		user[2] = interaction.options.getMember('user3');
		user[3] = interaction.options.getMember('user4');

		const playercount = parseInt(interaction.options.getString('teamsize')) ?? 2;

		for (i = 0; i < user.length; i++) {
			if (user[i]) {
				userids[i] = user[i].id;
			}
		}

		let sql1 = "SELECT * FROM `"+ global.config.mysql_database +"`.`users` WHERE `discordid` = '"+ interactionUser.id +"' LIMIT 1";
		const teamcaptain = await new Promise((resolve, reject) => {
		  con.query(sql1, function (err, result) {
			if (err) reject(err);
			resolve(result);
		  });
		});

		let message;

		if (teamcaptain[0].id) {
			let sql3 = "DELETE FROM `"+ global.config.mysql_database +"`.`user__teamavailability` WHERE `userid` = "+ teamcaptain[0].id +"";
			const result3 = await new Promise((resolve, reject) => {
				con.query(sql3, function (err, result) {
				  if (err) reject(err);
				  resolve(result);
				});
			});	

			let sqlcount = "SELECT "+ teamcaptain[0].id +", a.`weekday`, a.`hour` FROM `"+ global.config.mysql_database +"`.`users` u INNER JOIN `"+ global.config.mysql_database +"`.`user__availability` a on u.id = a.userid and u.discordid in ("+ userids.join(',') +") group by a.weekday, a.hour having count(*) > "+ (playercount-1) +"";
			const count = await new Promise((resolve, reject) => {
				con.query(sqlcount, function (err, result) {
				  if (err) reject(err);
				  resolve(result);
				});
			});	

			let sql = "INSERT INTO `"+ global.config.mysql_database +"`.`user__teamavailability` "+ sqlcount;
			const result = await new Promise((resolve, reject) => {
				con.query(sql, function (err, result) {
				  if (err) reject(err);
				  resolve(result);
				});
			});	
			if (count.length == 0) {
				message = "Team availability updated based on the times where minimum "+ playercount +" of these players could play. I couldnt find ANY overlapping times. You have to add more availabilities and run the command again.";
			} else if (count.length < 5) {
				message = "Team availability updated based on the times where minimum "+ playercount +" of these players could play. I could only find "+ count.length +" overlapping times, you should try to add more availability and try this command again.";
			} else {
				message = "Team availability updated based on the times where minimum "+ playercount +" of these players could play. I found a total of "+ count.length +" overlapping times.";
			}

		} else {
			message = "You are not signed up at Friends of Risk, cannot create team availability. Please use the /availability command first to set up your own profile.";
		}

		try {
			await interaction.reply({ content: message, ephemeral: true });
		} catch (error) {
			// Handle errors
			console.error("Error:", error);
		}
		con.end();


	  } catch (error) {
		console.error(error);
		await interaction.reply({ content: "Error running command, please try again later", ephemeral: true });
	  }
	}
  };
  
