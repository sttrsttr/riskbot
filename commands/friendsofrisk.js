const { SlashCommandBuilder } = require('discord.js');
var mysql = require('mysql2');
const { mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');

function uuidv4() {
	return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
	  (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
	);
  }  

module.exports = {
	data: new SlashCommandBuilder()
	  .setName('friendsofrisk')
	  .setDescription('Login at friendsofrisk.com')
		,
	async execute(interaction) {
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
		const username = interactionUser.nickname || interactionUser.user.globalName || interactionUser.user.username;
		const altname = interactionUser.user.globalName || interactionUser.user.username;
		const altname2 = interactionUser.user.username;
		const userid = interactionUser.user.id;
		

		let sql = "SELECT * FROM `"+ mysql_database +"`.`users` WHERE `discordid` = '"+ userid +"' LIMIT 1";
		const result = await new Promise((resolve, reject) => {
		  con.query(sql, function (err, result) {
			if (err) reject(err);
			resolve(result);
		  });
		});
		const rows = result;
		if (rows.length == 1) {

			const guid = uuidv4().toUpperCase();
			let sql2 = "UPDATE `"+ mysql_database +"`.`users` SET `guid` = '"+ guid +"', `guid_validto` = DATE_ADD(NOW(), INTERVAL +1 DAY) WHERE `discordid` = '"+ userid +"' AND `id` = "+ rows[0].id +";";
			const result = await new Promise((resolve, reject) => {
				con.query(sql2, function (err, result) {
				  if (err) reject(err);
				  resolve(result);
				});
			  });
			  await interaction.reply({ content: 'Use this link to log into the site: https://www.friendsofrisk.com/register/login/'+ rows[0].id +'/'+ guid, ephemeral: true });

		} else {
			// Sign up user
			const guid = uuidv4().toUpperCase();
			let sql = "INSERT INTO `"+ mysql_database +"`.`users` VALUES (NULL,'"+ username +"','"+ userid +"',NULL,NULL,NULL,NULL,NOW(),NULL,'"+ guid +"',DATE_ADD(NOW(), INTERVAL +1 WEEK),NULL,'"+ altname +"',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);";

			try {
				const result = await new Promise((resolve, reject) => {
				  con.query(sql, function (err, result) {
					if (err) reject(err);
					resolve(result);
				  });
				});
				const rows = result;
				const insertedId = result.insertId;
				if (insertedId) {
					await interaction.reply({ content: 'Signup successfull, use this link to log into the site: https://www.friendsofrisk.com/register/verify/'+ insertedId +'/'+ guid, ephemeral: true });
				} else {
					await interaction.reply({ content: 'Something went horribly wrong, or I am stupid. Please reach out to someone for help with this', ephemeral: true });
				}
			} catch (error) {
				// Handle errors
				console.error("Error:", error);
			}
		}
		con.end();


	  } catch (error) {
		console.error(error);
		await interaction.reply({ content: "Error getting status, please try again later", ephemeral: true });
	  }
	}
  };
  
