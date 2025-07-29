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
	  .setName('register-user')
	  .setDescription('Register an account on behalf of this user at friendsofrisk.com')
	  .addUserOption(option =>
		option.setName('user')
			.setDescription('The user you want to create an account for')
			.setRequired(true)
		)		,
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
		const user = interaction.options.getMember('user');
		const username = user.nickname || user.user.globalName || user.user.username;
		const altname = user.user.globalName || user.user.username;
		const altname2 = user.user.username;
		const userid = user.id;

		let sql = "SELECT 1 FROM `"+ mysql_database +"`.`users` WHERE `discordid` = '"+ userid +"'";
		const result = await new Promise((resolve, reject) => {
		  con.query(sql, function (err, result) {
			if (err) reject(err);
			resolve(result);
		  });
		});
		const rows = result;
		if (rows.length == 1) {
			await interaction.reply({ content: 'It looks like we already have a user with that discordid. Use /login-user @user to log in', ephemeral: true });
		} else {
			// Sign up user
			const guid = uuidv4().toUpperCase();
			let sql = "INSERT INTO `"+ mysql_database +"`.`users` VALUES (NULL,'"+ username +"','"+ userid +"',NULL,NULL,NULL,NULL,NOW(),NULL,'"+ guid +"',NULL,DATE_ADD(NOW(), INTERVAL +1 WEEK),'"+ altname +"','"+ altname2 +"',NULL,NULL,NULL,NULL,NULL,0);";
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
				await interaction.reply({ content: 'Something went horribly wrong', ephemeral: true });
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
  
