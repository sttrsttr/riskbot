const { SlashCommandBuilder } = require('discord.js');
var mysql = require('mysql2');
const { ladderbotlog } = require('../modules/ladderbotlog.js');
const { mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');

module.exports = {
	data: new SlashCommandBuilder()
	  .setName('ladder-join')
	  .setDescription('Join the 1v1 ladder')
		,
	async execute(interaction, client) {
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
		const nickname = interactionUser.nickname || interactionUser.user.username || interactionUser.user.globalName;
		const globalname = interactionUser.user.globalName || interactionUser.user.username;
		const username = interactionUser.user.username;
		const userid = interactionUser.user.id;

		let sql = "SELECT * FROM `"+ mysql_database +"`.`1v1ladder__participants` WHERE `discorduserid` = '"+ userid +"'";
		const result = await new Promise((resolve, reject) => {
		  con.query(sql, function (err, result) {
			if (err) reject(err);
			resolve(result);
		  });
		});
		const rows = result;
		if (rows.length == 0) {

			let sql = "INSERT INTO `"+ mysql_database +"`.`1v1ladder__participants` (`discorduserid`, `username`, `nickname`, `globalname`) VALUES ("+ userid +","+ con.escape(username) +","+ con.escape(nickname) +","+ con.escape(globalname) +");";
			try {
				const result = await new Promise((resolve, reject) => {
				  con.query(sql, function (err, result) {
					if (err) reject(err);
					resolve(result);
				  });
				});
				if (result) {
					ladderbotlog(client, `${interaction.user.username} joined the ladder`);
					await interaction.reply({ content: 'You have successfully joined the ladder. You can now challenge someone by using the /ladder-challenge command', ephemeral: true });
				} else {
					ladderbotlog(client, `${interaction.user.username} tried to join the ladder but the bot failed`);
					await interaction.reply({ content: 'Something went horribly wrong, or I am stupid. Please reach out to someone for help with this', ephemeral: true });
				}
			} catch (error) {
				// Handle errors
				console.error("Error:", error);
			}


		} else {
			ladderbotlog(client, `${interaction.user.username} tried to join the ladder once more. IDIOT.`);
			await interaction.reply({ content: 'You are already IN the ladder you silly person', ephemeral: true });

		}
		con.end();


	  } catch (error) {
		console.error(error);
		ladderbotlog(client, `${interaction.user.username} made me crash 😵‍💫`);
		await interaction.reply({ content: "Something went horribly wrong, please try again later", ephemeral: true });
	  }
	}
  };
  
