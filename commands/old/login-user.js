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
	  .setName('login-user')
	  .setDescription('Log into your account at friendsofrisk.com')
	  .addUserOption(option =>
		option.setName('user')
			.setDescription('The user you want to log in as')
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

		let sql = "SELECT `id` FROM `"+ mysql_database +"`.`users` u INNER JOIN `"+ mysql_database +"`.`user_admins` ua ON u.`id` = ua.`userid` AND u.`discordid` = '"+ interaction.user.id +"'";
		const result = await new Promise((resolve, reject) => {
		  con.query(sql, function (err, result) {
			if (err) reject(err);
			resolve(result);
		  });
		});
		const rows = result;
		if (rows.length == 1) {


		const user = interaction.options.getMember('user');
		const userid = user.id;

		let sql = "SELECT `id` FROM `"+ mysql_database +"`.`users` WHERE `discordid` = '"+ userid +"'";
		const result = await new Promise((resolve, reject) => {
		  con.query(sql, function (err, result) {
			if (err) reject(err);
			resolve(result);
		  });
		});
		const rows = result;
		if (rows.length == 1) {

			const guid = uuidv4().toUpperCase();
			let sql = "UPDATE `"+ mysql_database +"`.`users` SET `guid` = '"+ guid +"', `guid_validto` = DATE_ADD(NOW(), INTERVAL +1 DAY) WHERE `discordid` = '"+ userid +"' AND `id` = "+ rows[0].id +";";
			const result = await new Promise((resolve, reject) => {
				con.query(sql, function (err, result) {
				  if (err) reject(err);
				  resolve(result);
				});
			  });
	  
			await interaction.reply({ content: 'Use this link to log into the site without a password: https://www.friendsofrisk.com/register/login/'+ rows[0].id +'/'+ guid, ephemeral: true });

		} else {
				await interaction.reply({ content: 'Unable to log you in, couldt find any user with your discord ID', ephemeral: true });
		}
		} else {
			await interaction.reply({ content: 'You dont have access to this command :----(', ephemeral: true });
		}
		con.end();


	  } catch (error) {
		console.error(error);
		await interaction.reply({ content: "Error getting status, please try again later", ephemeral: true });
	  }
	}
  };
  
