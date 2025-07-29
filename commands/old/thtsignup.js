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
	  .setName('thtsignup')
	  .setDescription('Sign up for the Top Hat Tournemnt')
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

		let sql = "SELECT `id` FROM `"+ mysql_database +"`.`users` WHERE `discordid` = '"+ userid +"'";
		const result = await new Promise((resolve, reject) => {
		  con.query(sql, function (err, result) {
			if (err) reject(err);
			resolve(result);
		  });
		});
		const rows = result;
		if (rows.length == 1) {
			// User already exists


			let sql5 = "SELECT 1 FROM `"+ mysql_database +"`.`tournament__players` WHERE `tournament` = 10 AND `user` = '"+ rows[0].id +"'";
			const result5 = await new Promise((resolve, reject) => {
			  con.query(sql5, function (err, result) {
				if (err) reject(err);
				resolve(result);
			  });
			});
			const rows_signup = result5;
			if (rows_signup.length == 1) {
				// User already signed up
				await interaction.reply({ content: 'You are already signed up for the Top Hat Tournament You can use the /availability command to update your availability', ephemeral: true });
			} else {

				const guid = uuidv4().toUpperCase();
				let sql3 = "UPDATE `"+ mysql_database +"`.`users` SET `guid` = '"+ guid +"', `guid_validto` = NULL WHERE `id` = "+ rows[0].id +";";
				const result3 = await new Promise((resolve, reject) => {
					con.query(sql3, function (err, result) {
					  if (err) reject(err);
					  resolve(result);
					});
				});
				let sql = "INSERT INTO `"+ mysql_database +"`.`tournament__players` VALUES (NULL,10,'"+ rows[0].id +"',NOW(),NULL,NULL,NULL,NULL);";
				try {
					const result2 = await new Promise((resolve, reject) => {
					  con.query(sql, function (err, result) {
						if (err) reject(err);
						resolve(result);
					  });
					});
					if (result2.insertId) {
						await interaction.reply({ content: 'Signup for THT successfull, use this link to add your availability: https://www.friendsofrisk.com/register/verify/'+ rows[0].id +'/'+ guid, ephemeral: true });
					} else {
						await interaction.reply({ content: 'Something went horribly wrong (1), or I am stupid. You could try to use the /login command', ephemeral: true });
					}
				} catch (error) {
					// Handle errors
					console.error("Error:", error);
				}

			}
		} else {
			// Sign up user
			const guid = uuidv4().toUpperCase();
			let sql = "INSERT INTO `"+ mysql_database +"`.`users` VALUES (NULL,'"+ username +"','"+ userid +"',NULL,NULL,NULL,NULL,NOW(),NULL,'"+ guid +"',NULL,DATE_ADD(NOW(), INTERVAL +1 WEEK),'"+ altname +"','"+ altname2 +"',NULL,NULL,NULL,0);";
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
					let sql = "INSERT INTO `"+ mysql_database +"`.`tournament__players` VALUES (NULL,10,"+ insertedId +",NOW(),NULL,NULL,NULL,NULL);";
					try {
						const result2 = await new Promise((resolve, reject) => {
						  con.query(sql, function (err, result2) {
							if (err) reject(err);
							resolve(result2);
						  });
						});
						const rows2 = result2;
						const insertedId2 = result2.insertId;
						if (insertedId2) {
							await interaction.reply({ content: 'Signup for THT successfull, use this link to add your availability: https://www.friendsofrisk.com/register/verify/'+ insertedId +'/'+ guid, ephemeral: true });
						} else {
							await interaction.reply({ content: 'Signup failed. You could try to use the /login command and sign up manually', ephemeral: true });
						}
					} catch (error) {
						// Handle errors
						console.error("Error:", error);
					}
				} else {
					await interaction.reply({ content: 'Something went horribly wrong (2), I was not able to create your user profile', ephemeral: true });
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
  
