const { SlashCommandBuilder, quote } = require('discord.js');
var mysql = require('mysql2');
const { mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');

function uuidv4() {
	return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
	  (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
	);
  } 

  function knuthShuffle(arr) {
    var rand, temp, i;
    for (i = arr.length - 1; i > 0; i -= 1) {
        rand = Math.floor((i + 1) * Math.random());//get random between zero and i (inclusive)
        temp = arr[rand];//swap i and the zero-indexed number
        arr[rand] = arr[i];
        arr[i] = temp;
    }
    return arr;
}

module.exports = {
	data: new SlashCommandBuilder()
	  .setName('schedule')
	  .setDescription('Schedule a match between players')
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
	.addUserOption(option =>
		option
		.setName('user5')
		.setDescription('user5')
		.setRequired(false)
	)
	.addUserOption(option =>
		option
		.setName('user6')
		.setDescription('user6')
		.setRequired(false)
	)
	.addUserOption(option =>
		option
		.setName('user7')
		.setDescription('user7')
		.setRequired(false)
	)
	.addUserOption(option =>
		option
		.setName('user8')
		.setDescription('user8')
		.setRequired(false)
	)
	.addStringOption(option =>
		option.setName('message')
			.setDescription('Add a personal message to the post')
			.setRequired(false)
		)
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

		let user = [];

		user[1] = interaction.options.getMember('user1');
		user[2] = interaction.options.getMember('user2');
		user[3] = interaction.options.getMember('user3');
		user[4] = interaction.options.getMember('user4');
		user[5] = interaction.options.getMember('user5');
		user[6] = interaction.options.getMember('user6');
		user[7] = interaction.options.getMember('user7');
		user[8] = interaction.options.getMember('user8');
		const addmessage = interaction.options.getString('message') ?? '';

		await interaction.reply({ content: "I am on it...  I will check if they have some available times set up in Friends of Risk", ephemeral: true });

		let usercnt = 0;
		let gametimes = {
			'd1': {},
			'd2': {},
			'd3': {},
			'd4': {},
			'd5': {},
			'd6': {},
			'd7': {}
		};
		let gametimes_alt = {
			'd1': {},
			'd2': {},
			'd3': {},
			'd4': {},
			'd5': {},
			'd6': {},
			'd7': {}
		};

		let dmtargets = "";
		let prevhour = -1;
		let prevday = -1;

		const currentdate = new Date();
		let currentday = currentdate.getDay()+1;

		for (i = 0; i < user.length; i++) {
			if (user[i]) {
				//let name = user[i].user.globalName || user[i].user.username || user[i].displayName || user[i].user.nickname;
				usercnt++;
				let sql = "SELECT * FROM `"+ mysql_database +"`.`users` WHERE `discordid` = '"+ user[i].id +"' LIMIT 1";
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
					dmtargets = dmtargets +'> ' + user[i].toString() + "\n";
					let sql2 = "SELECT * FROM `"+ mysql_database +"`.`user__availability` WHERE `userid` = '"+ rows[0].id +"' ORDER BY `weekday` ASC, `hour` ASC";
					const result2 = await new Promise((resolve, reject) => {
					  con.query(sql2, function (err, result2) {
						if (err) reject(err);
						resolve(result2);
					  });
					});
					const availability = result2;
					if (availability.length > 0) {
						for (ii = 0; ii < availability.length; ii++) {

							if (currentday > 5 || (currentday < availability[ii]['weekday'] && currentday != availability[ii]['weekday'])) {							


							hstring = 'h'+ availability[ii]['hour'];
							dstring = 'd'+ availability[ii]['weekday'];
							if (gametimes[dstring][hstring]) {
								gametimes[dstring][hstring] += 1;
							} else {
								gametimes[dstring][hstring] = 1;
							}
						}
						}
					}

					prevhour = -1;
					prevday = -1;
					if (availability.length > 0) {
						for (ii = 0; ii < availability.length; ii++) {

							if (currentday > 5 || (currentday < availability[ii]['weekday'] && currentday != availability[ii]['weekday'])) {							


							if (prevhour+1 != Number(availability[ii]['hour']) && prevhour != -1 && prevhour != 23 && Number(availability[ii]['hour']) != 0) {
								hstring = 'h'+ (Number(prevhour)+1);
								dstring = 'd'+ prevday;
								if (gametimes_alt[dstring][hstring]) {
									gametimes_alt[dstring][hstring] += 1;
								} else {
									gametimes_alt[dstring][hstring] = 1;
								}	
							}
							hstring = 'h'+ availability[ii]['hour'];
							dstring = 'd'+ availability[ii]['weekday'];
							if (gametimes_alt[dstring][hstring]) {
								gametimes_alt[dstring][hstring] += 1;
							} else {
								gametimes_alt[dstring][hstring] = 1;
							}
							prevhour = Number(availability[ii]['hour']);
							prevday = Number(availability[ii]['weekday']);
							}
						}

						if (currentday > 5 || (currentday < prevday && currentday != prevday)) {							

						if (prevhour != 23) {
							hstring = 'h'+ (prevhour+1);
							dstring = 'd'+ prevday;
							if (gametimes_alt[dstring][hstring]) {
								gametimes_alt[dstring][hstring] += 1;
							} else {
								gametimes_alt[dstring][hstring] = 1;
							}
						}
					}
					}
				} else {
					dmtargets = dmtargets +'> ' + user[i].toString() + " (__has no availability__)\n";
				}
			}
		}

		con.end();

		let string = "";
		let gametime2 = [];
		let gametime2_alt = [];

		for (var day of Object.keys(gametimes)) {
			for (var hour of Object.keys(gametimes[day])) {
				string = day +'-'+ hour;
				gametime2[string] = gametimes[day][hour];
			}
		};

		for (var day of Object.keys(gametimes_alt)) {
			for (var hour of Object.keys(gametimes_alt[day])) {
				string = day +'-'+ hour;
				gametime2_alt[string] = gametimes_alt[day][hour];
			}
		};

//		console.log(gametime2);
		//console.log(gametime2_alt);

		const arrayFromObject = knuthShuffle(knuthShuffle(Object.entries(gametime2)));
		const sortedArray = arrayFromObject.sort((a, b) => b[1] - a[1]);
		const sortedObject = Object.fromEntries(sortedArray);

		
		const arrayFromObject_alt = knuthShuffle(knuthShuffle(Object.entries(gametime2_alt)));
		const sortedArray_alt = arrayFromObject_alt.sort((a, b) => b[1] - a[1]);
		const sortedObject_alt = Object.fromEntries(sortedArray_alt);

		let options = 1;
		let pct = 0;
		let maxpct = 0;

		let weekdays = {
			'd1': 'Monday',
			'd2': 'Tuesday',
			'd3': 'Wednesday',
			'd4': 'Thursday',
			'd5': 'Friday',
			'd6': 'Saturday',
			'd7': 'Sunday'
		};

		//dmtargets = "";

		var text = 'Here are the 5 best possible timeslots for matchup between\n\n'+ dmtargets +'\nPlease react with corresponding emotes to vote for the best time, and the one with the most vote will be the selected time\n';
		if (addmessage != "") {
			text = addmessage +'\n\n'+ text;
		}
		let slot_text = "";

		for (var slot of Object.keys(sortedObject)) {
			if (options <= 5) {
				if (options == 1) {
					emote = "🈳";
				} else if (options == 2) {
					emote = "🈵";
				} else if (options == 3) {
					emote = "🕉️";
				} else if (options == 4) {
					emote = "🈯";
				} else {
					emote = "🈷️";
				}
				slotinfo = slot.split("-");
				hour = slotinfo[1].replace("h", "");
				day = slotinfo[0].replace("d", "");
				dayname = weekdays[slotinfo[0]];
				available = sortedObject[slot];
				pct = Math.round(available/usercnt*100,0);
				if (pct > maxpct) {
					maxpct = pct;
				}
				slot_text = slot_text + '\n**'+ emote +'** [ '+ dayname +' '+ hour +':00 UTC ] ('+ pct +'% match)';
				options++;
			}
		}

		if (maxpct < 50) {
			options = 1;
			// Less than 50%, lets go with the alt times instead
			console.log('Less than 50%, lets go with the alt times instead');

			slot_text = "";
			for (var slot of Object.keys(sortedObject_alt)) {
				if (options <= 5) {
					if (options == 1) {
						emote = "🈳";
					} else if (options == 2) {
						emote = "🈵";
					} else if (options == 3) {
						emote = "🕉️";
					} else if (options == 4) {
						emote = "🈯";
					} else {
						emote = "🈷️";
					}
					slotinfo = slot.split("-");
					hour = slotinfo[1].replace("h", "");
					day = slotinfo[0].replace("d", "");
					dayname = weekdays[slotinfo[0]];
					available = sortedObject_alt[slot];
					pct = Math.round(available/usercnt*100,0);
					if (pct > maxpct) {
						maxpct = pct;
					}
					slot_text = slot_text + '\n**'+ emote +'** [ '+ dayname +' '+ hour +':00 UTC ] ('+ pct +'% match)';
					options++;
				}
			}

		}

		var text = text + slot_text + '\n\nYou can use the /availability command to add and or update your availability at Friends of Risk, and then run the /schedule command again afterwards.';


		try {

			message = await interaction.channel.send(text);	
			try {
				await message.react("🈳");
				await message.react("🈵");
				await message.react("🈷️");
				await message.react("🕉️");
				await message.react("🈯");
			} catch (error) {
				console.error(error);
				await interaction.followUp({ content: "Error, I might not have the correct permissions to react to messages in this channel.", ephemeral: true });				
			}


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
  
