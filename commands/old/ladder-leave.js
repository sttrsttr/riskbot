const { SlashCommandBuilder } = require('discord.js');
var mysql = require('mysql2');
const { ladderbotlog } = require('../modules/ladderbotlog.js');
const { mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');

module.exports = {
	data: new SlashCommandBuilder()
	  .setName('ladder-leave')
	  .setDescription('Leave the 1v1 ladder (and lose your position)')
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
		const userid = interactionUser.user.id;

		let sql = "SELECT * FROM `"+ mysql_database +"`.`1v1ladder__participants` WHERE `discorduserid` = '"+ userid +"'";
		const result = await new Promise((resolve, reject) => {
		  con.query(sql, function (err, result) {
			if (err) reject(err);
			resolve(result);
		  });
		});
		const yourself = result;
		if (yourself.length == 0) {
			await interaction.reply({ content: 'You arent even in the ladder, what do you mean?', ephemeral: true });
		} else {

			ladderbotlog(client, `<@${userid}> didnt want to play any more and got set back to rank 0`);
			sql = "UPDATE `"+ mysql_database +"`.`1v1ladder__participants` SET `rank` = 0 WHERE `discorduserid` = "+ userid +"";
			const result3 = await new Promise((resolve, reject) => {
			  con.query(sql, function (err, result) {
				if (err) reject(err);
				resolve(result);
			  });
			});

			sql = "UPDATE `"+ mysql_database +"`.`1v1ladder__participants` SET `rank` = `rank`-1 WHERE `rank` > "+ yourself[0].rank +"";
			const result2 = await new Promise((resolve, reject) => {
			  con.query(sql, function (err, result) {
				if (err) reject(err);
				resolve(result);
			  });
			});

			await interaction.reply({ content: 'I have removed you from the ladder. Hope to see you again some time', ephemeral: true });
		}
		con.end();


	  } catch (error) {
		console.error(error);
		await interaction.reply({ content: "Something went horribly wrong, please try again later", ephemeral: true });
	  }
	}
  };
  
