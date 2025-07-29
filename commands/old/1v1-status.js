const { SlashCommandBuilder } = require('discord.js');
var mysql = require('mysql2');
const { mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');

module.exports = {
	data: new SlashCommandBuilder()
	  .setName('1v1-status')
	  .setDescription('See how you are doing in the 1v1 tournament'),
	async execute(interaction) {
	  try {
		const interactionUser = await interaction.guild.members.fetch(interaction.user.id);
		let errors = "";
		let foundres = false;

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

		var sql = "SELECT * FROM `friendsofrisk`.`1v1__ranking` WHERE `userid` = "+ interactionUser.id;
		const result = await new Promise((resolve, reject) => {
		  con.query(sql, function (err, result) {
			if (err) reject(err);
			resolve(result);
		  });
		});
		var rows = result;
		for (const message of rows) {
			errors = "You are currently ranked #"+ message.rank +" with a total of "+ message.points +" points. Keep up the good work!";
			foundres = true;
		}

		con.end();

		if (foundres) {
			await interaction.reply({ content: errors, ephemeral: true });
		} else {
			await interaction.reply({ content: 'Unable to find your ranking. Are you sure you have reported and gotten your reports approved?', ephemeral: true });
		}


	  } catch (error) {
		console.error(error);
		await interaction.reply({ content: "Error getting status, please try again later", ephemeral: true });
	  }
	}
  };
  
