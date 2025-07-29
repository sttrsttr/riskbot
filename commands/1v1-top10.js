const { SlashCommandBuilder } = require('discord.js');
var mysql = require('mysql2');
const { mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');

module.exports = {
	data: new SlashCommandBuilder()
	  .setName('1v1-top10')
	  .setDescription('See who is on top of the 1v1 tournament'),
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

		var sql = "SELECT r.rank, u.username, r.points FROM `friendsofrisk`.`1v1__ranking` r INNER JOIN `friendsofrisk`.`rcl__discord_users` u ON r.userid = u.id ORDER BY r.`rank` ASC LIMIT 0,10";
		const result = await new Promise((resolve, reject) => {
		  con.query(sql, function (err, result) {
			if (err) reject(err);
			resolve(result);
		  });
		});
		var rows = result;
		errors = "Current TOP 10 standings:\n";
		for (const message of rows) {
			errors = errors + "\n"+ message.rank +". "+ message.username + " ("+ parseFloat(message.points) +" points)";
			foundres = true;
		}
		errors = errors + "\n\nView the complete ranking list at https://www.friendsofrisk.com/1v1/. Only verified and apporoved results are included in the ranking.\n";

		con.end();

		if (foundres) {
			await interaction.reply({ content: errors, ephemeral: false });
		} else {
			await interaction.reply({ content: 'Unable to find rankings. Unknown error occoured', ephemeral: true });
		}


	  } catch (error) {
		console.error(error);
		await interaction.reply({ content: "Error getting status, please try again later", ephemeral: true });
	  }
	}
  };
  
