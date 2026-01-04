const { SlashCommandBuilder, quote } = require('discord.js');
var mysql = require('mysql2');
const { mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');

function uuidv4() {
	return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
	  (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
	);
  } 

module.exports = {
	data: new SlashCommandBuilder()
	  .setName('showavailability')
	  .setDescription('Show a users availability from Friends of Risk')
	.addUserOption(option =>
		option
		.setName('user')
		.setDescription('user')
		.setRequired(false)
	)
	,
	async execute(interaction) {
	  try {

//		await interaction.reply({ content: "Give me a second please...\n"+ dmtargets, ephemeral: true });

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
		const optionUser = interaction.options.getMember('user');
		let user = optionUser ? optionUser : interactionUser;
		let gametimes = {
			'd1': {},
			'd2': {},
			'd3': {},
			'd4': {},
			'd5': {},
			'd6': {},
			'd7': {}
		};

		let weekdays = {
			'd1': 'Monday',
			'd2': 'Tuesday',
			'd3': 'Wednesday',
			'd4': 'Thursday',
			'd5': 'Friday',
			'd6': 'Saturday',
			'd7': 'Sunday'
		};

		let replymessage = "";


		await interaction.reply({ content: "I am on it...  I will check if they have some available times set up in Friends of Risk", ephemeral: true });

		let sql = "SELECT * FROM `"+ global.config.mysql_database +"`.`users` WHERE `discordid` = '"+ user.id +"' LIMIT 1";
				const result = await new Promise((resolve, reject) => {
				  con.query(sql, function (err, result) {
					if (err) reject(err);
					resolve(result);
				  });
				});
				const rows = result;
				let hstring = "";
				let dstring = "";
				if (rows.length == 1) {
					replymessage = replymessage +'Here is the availability of ' + user.toString() + " (last updated "+ rows[0].avail_lastupdate +"):\n";
					let sql2 = "SELECT * FROM `"+ global.config.mysql_database +"`.`user__availability` WHERE `userid` = '"+ rows[0].id +"' ORDER BY `weekday` ASC, `hour` ASC";
					const result2 = await new Promise((resolve, reject) => {
					  con.query(sql2, function (err, result2) {
						if (err) reject(err);
						resolve(result2);
					  });
					});
					const availability = result2;
					if (availability.length > 0) {
						for (ii = 0; ii < availability.length; ii++) {

							hstring = 'h'+ availability[ii]['hour'];
							dstring = 'd'+ availability[ii]['weekday'];
							gametimes[dstring][hstring] = 1;

						}
					}

					let prevhour = 0;
					let simplehour = 0;
					let chainsize = 0;
					let chaincount = 0;
					let chainstart = "";
					for (var day of Object.keys(gametimes)) {
						prevhour = -2;
						chainstart = -2;
						chainsize = 0;
						chaincount = 0;
						replymessage = replymessage + `**${weekdays[day]}**:\n`;
						for (var hour of Object.keys(gametimes[day])) {
							simplehour = parseInt(hour.replace('h', ''));
							if (simplehour != prevhour+1) {
								// New chain0
								if (chainstart == -2) {
									// First one
									chainstart = simplehour;
								} else {
									// Finish the previous one
									if (chaincount > 0) {
										replymessage = replymessage + `, `;	
									}
									chainend = prevhour;
									chaincount++;
									if (chainsize == 1) {
										replymessage = replymessage + `${chainstart}:00`;
									} else {
										replymessage = replymessage + `${chainstart}:00-${chainend}:00`; 
									}
								}
								chainstart = simplehour;
								chainsize = 1;
							} else {
								// Continue
								chainsize++;
							}
							prevhour = simplehour;
						}
						chainend = prevhour;
						if (chaincount > 0) {
							replymessage = replymessage + `, `;	
						}

						if (chainsize == 1) {
							replymessage = replymessage + `${chainstart}:00\n`;
						} else if (chainsize > 0) {
							replymessage = replymessage + `${chainstart}:00-${chainend}:00\n`; 
						} else {
							replymessage = replymessage + `No availabilty\n`; 
						}
			
					}
			

				} else {
					replymessage = replymessage + user.toString() + " (__has no availability__)\n";
				}

		con.end();
	
		try {

			await interaction.followUp({ content: replymessage, ephemeral: true });				

		} catch (error) {
			console.error(error);
			await interaction.followUp({ content: "Error, I might not have the correct permissions to send messages to this channel.", ephemeral: true });				
		}


	  } catch (error) {
		console.error(error);
		await interaction.reply({ content: "Error, please try again later", ephemeral: true });
	  }
	}
  };
  
