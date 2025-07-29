// Load required modules and config

// Set up local webserver for API requests
const express = require('express');
const app = express();
const port = 3000;

// Set up NODE
import("dateformat");
const fs = require('node:fs');
const path = require('node:path');
const cron = require("node-cron");
const mysql = require('mysql2');

// Set up Discord.js
const { Client, Collection, Events, GatewayIntentBits, Partials, ChannelType, AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, GuildOnboardingPrompt } = require('discord.js');

// Set up riskbot and modules
const { token, mysql_host, mysql_username, mysql_password, mysql_database,guilds } = require('./riskbot_config.json');
const { swap_users, eventmanagegroupstartingnow, addThreadMember, eventmanager24hourping, eventmanager48hourping, eventmanagerwelcomethreads, eventmanagerlockthreads, lockThread, eventmanager1hourping, updatecheckinmessage, eventmanagerCheckinStart, eventmanagerCheckinStop, logEventMessage, availabilityMessage, pingstaff, pingwaitlist, pingparticipants, updateallowedChannelIds, updatechatChannelIds, signupHandler, getAllowedChannelIds, getChatChannelIds, getAnnouncementChannelsIds } = require('./modules/signuphandler.js');
//const { reactHandler } = require('./modules/reacthandler.js');

function uuidv4() {
	return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
	  (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
	);
  }  


let allowedChannelIds = getAllowedChannelIds();
let chatChannelIds = getChatChannelIds();
let announcementChannelsIds = getAnnouncementChannelsIds();

// Spawn Discord client
const client = new Client({ 
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.MessageContent],
	partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Load commands
for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	client.commands.set(command.data.name, command);
}

// Verify to console that everything is ready and run startup functions
client.once(Events.ClientReady, () => {
//	undeployCommands(client, '716784438058418197');
	refreshtournamentcalendar();
	processDMqueue();
	message_channel(guilds.RISKDEV, '1292848598337323109', "I just got restarted, feeling great!");
	eventmanager1hourping(client);
	eventmanagerCheckinStop(client);
	eventmanager48hourping(client);
	eventmanagerwelcomethreads(client);
//	countMemes(client, "465846009164070912", "522892406199156747");
});

// Eventmanger scheduled tasks
cron.schedule("0 */5 * * * *", function () {
	eventmanagerCheckinStart(client);
	eventmanagerCheckinStop(client);
	eventmanager1hourping(client);
	eventmanager24hourping(client);
	eventmanager48hourping(client);
	eventmanagegroupstartingnow(client);
	eventmanagerlockthreads(client);
	eventmanagerwelcomethreads(client);
});

// Update calendar message every 12th hour
cron.schedule("0 0 */12 * * *", function () {
	refreshtournamentcalendar();
});



// Function to remove all commands from all guilds
async function undeployCommands(client, guild = 0) {
	if (guild !== 0) {
		const guild2 = await client.guilds.fetch(guild);
		guild2.commands.set([]);
	} else {
		for (const guild in guilds) {
			console.log("Uninstalling all commands");
			const guild2 = await client.guilds.fetch(guilds[guild]);
			guild2.commands.set([]);
		}
	}

};

process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled Rejection at:', promise, 'reason:', reason);
	console.error('Stack trace:', reason.stack);
});
  
process.on('uncaughtException', (error) => {
	console.error('Uncaught Exception:', error);
	console.error('Stack trace:', error.stack);
});

// Listen for any commands
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;
	const command = client.commands.get(interaction.commandName);
	if (!command) return;
	try {
		await logcommand(interaction);
		await command.execute(interaction, client);

		if (interaction.commandName === 'eventlabs-create' || interaction.commandName === 'create-event') {
			// Refresh list of channels after new tournaments are added
			allowedChannelIds = getAllowedChannelIds();
			chatChannelIds = getChatChannelIds();	
			announcementChannelsIds = getAnnouncementChannelsIds();
		}

	} catch (error) {
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});

// Listen for event signup messages
client.on('messageCreate', message => {
    if (!message.author.bot && !message.system) {
		const content = message.content.toLowerCase();
		if (allowedChannelIds.includes(message.channel.id)) {
			if (content.includes('signup') || content.includes('sign in') || content.includes('sign up') || content.includes('singup') || content.includes('sing up') || content.includes('sign me up') || content.includes('join') || content.includes('register') || content == '✅' || content == '👍') {
				signupHandler(message, client);
			}
		} else if (announcementChannelsIds.includes(message.channel.id) && !content.includes('(noping)')) { 
			pingparticipants(message, client);
		} else if (chatChannelIds.includes(message.channel.id) || chatChannelIds.includes(message.channel.parentId)) { 
			//logEventMessage(message);
			if (content.includes('change my availability') || content.includes('update my availability') || content.includes('from my availability') || content.includes('in my availability') || content.includes('update availability') || content.includes('change availability') || content.includes('availability update') || content.includes('to my availability')) {
				availabilityMessage(message);
			} else if (content.includes('!staff')) {
				pingstaff(message, client);
			}
		}
	}
});

/*
client.on(Events.MessageReactionAdd, async (reaction) => {

	const message = await reaction.message.fetch();
	const channel = message.channel;

	if (chatChannelIds.includes(channel.id) || chatChannelIds.includes(channel.parentId)) { 
		message.type = "EMOTE";
		//logEventMessage(message);
	}
});
*/

// Refresh event calendar discord message
function refreshtournamentcalendar() {
	console.log("Running calendar message refresh")

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

	let messageContent = 'Discord Tournament Calendar (upcoming events)\n\nYou can also look up these events with more information about how to signup etc on [friendsofrisk.com/calendar](https://www.friendsofrisk.com/calendar)\n\nThe Friends of Risk webpage is not affiliated with Risk: Global Domination, SMG or Hasbro, and the calendar includes unofficial tournaments not affiliated with the official Discord server.\n\n'; // Customize the message content

	var sql = "SELECT `hostserverid`, `name`, DATEDIFF(IFNULL(`signup_start_date`, '4000-01-01'), CURDATE()) AS `daystillsignup`, DATE_FORMAT(IFNULL(`start_date`, '4000-01-01'), '%M %D') AS `start_date`, DATE_FORMAT(IFNULL(`start_date`, '4000-01-01'), '%Y') AS `start_date_year`, DATE_FORMAT(IFNULL(`end_date`, '4000-01-01'), '%M %D') AS `end_date`, DATE_FORMAT(IFNULL(`signup_close_date`, '4000-01-01'), '%M %D') AS `signup_close_date`, DATE_FORMAT(IFNULL(`signup_close_date`, '4000-01-01'), '%Y') AS `signup_close_date_year`, DATE_FORMAT(IFNULL(`signup_start_date`, '4000-01-01'), '%M %D') AS `signup_start_date` , DATE_FORMAT(IFNULL(`signup_start_date`, '4000-01-01'), '%Y') AS `signup_start_date_year` FROM `"+ mysql_database +"`.`calendar__events` WHERE `validto` IS NULL AND (`signup_close_date` >= CURDATE() OR `signup_close_date` IS NULL) ORDER BY IFNULL(`signup_close_date`, '4000-01-01') ASC LIMIT 0,8";
	con.query(sql, function (err, result) {
		if (err) throw err;
		for (const event of result) {
			messageContent = messageContent + `## ${event.name}\n`;
			messageContent = messageContent + `> [${event.hostserverid}]\n`;
			if (event.start_date_year != "4000") {
				messageContent = messageContent + `> Event starts ${event.start_date}\n> Events ends ${event.end_date}\n`;
			} else {
				messageContent = messageContent + `> Dates TBA\n`;
			}
			if (event.signup_start_date_year != "4000") {
				if (event.daystillsignup > 0) {
					messageContent = messageContent + `> Signups opens ${event.signup_start_date}\n`;
				} else {
					messageContent = messageContent + `> **Open for signups**!\n`;
				}
				messageContent = messageContent + `> Signups deadline ${event.signup_close_date}\n\n`;
			} else {
				messageContent = messageContent + `> Signups dates TBA\n\n`;
			}
		}
		messageContent = messageContent + "View more information about these events on [Friends of Risk](https://www.friendsofrisk.com/calendar) (third party website)";
	});
	
	
	client.guilds.cache.forEach(guild => {

		var sql = "SELECT * FROM `"+ mysql_database +"`.`calendar__servers` WHERE `singlemessagechannel` IS NOT NULL AND `serverid` = "+ guild.id;
		con.query(sql, function (err, result) {
			if (err) throw err;
			if (result.length === 1) {
				for (const serverinfo of result) {

					const channel = guild.channels.cache.get(serverinfo.singlemessagechannel);


					if (serverinfo.messageid !== null) {
						//console.log("Have to update message "+ serverinfo.messageid);

						channel.messages.fetch(serverinfo.messageid).then(
							existingMessage => {
								if (!existingMessage) {
								  console.log('Message not found.');
								}
								// Edit the existing message
								existingMessage.edit(messageContent)
								.then(editedMessage => {
//									console.log(`Message edited in ${channel.name} (${editedMessage.guild.name})`);
								})
								.catch(error => console.error(`Error editing message: ${error}`));
							}
						)

					} else {
						if (channel) {
							// Send the message to the channel
							channel.send(messageContent)
							  .then(sentMessage => {
								//console.log(`Message sent to ${guild.name} (${sentMessage.guild.id})`);
								var sql = "UPDATE `"+ mysql_database +"`.`calendar__servers` SET `messageid` = '"+ sentMessage.id +"' WHERE `serverid` = "+ guild.id;
								con.query(sql, function (err, result) {
									if (err) throw err;
								});
							  })
							  .catch(error => console.error(`Error sending message to ${guild.name} (${guild.id}): ${error}`));
						}						  
					}
				}	
			}
		});
	});
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

	const userid = interaction.user.id;
	const channelid = interaction.message.channelId;
	const messageid = interaction.message.id;

	if (interaction.customId === 'pingwaitlist') {

			try {
				await interaction.reply({ content: "Please stand by...", ephemeral: true });

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
		
					let sql = "SELECT e.`serverid`, e.`helpchannel`, e.`waitlistrole`, eg.`name`, eg.`gametime`, eg.`id` FROM `"+ mysql_database +"`.`eventmanager__groups` eg INNER JOIN `"+ mysql_database +"`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `"+ mysql_database +"`.`eventmanager__events` e ON r.`eventid` = e.`id` AND eg.`threadid` = '"+ channelid +"' AND eg.`completed` IS NULL AND (eg.`waitlistpinged` IS NULL OR DATE_ADD(NOW(), INTERVAL -10 MINUTE) > eg.`waitlistpinged`)";
					const result = await new Promise((resolve, reject) => {
					con.query(sql, function (err, result) {
						if (err) reject(err);
						resolve(result);
					});
					});
					const group = result[0];
					if (group) {
		
						const guild = await client.guilds.resolve(group.serverid);
						const thread = await guild.channels.fetch(channelid);
						await pingwaitlist(client, thread);

					}
					con.end();
				} catch (error) {
					console.error(error);
					await interaction.followUp({ content: "Error, please try again later", ephemeral: true });				
				}
		




	} else if (interaction.customId === 'joingroupfromwaitlist') {


		try {
			await interaction.reply({ content: `Please stand by while I am checking some stuff`, ephemeral: true });		

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

			let sql = "SELECT eg.`pingmessageid`, eg.`wlqueue`, br.`noshowrole`, br.`bracketid`, e.`waitlistqueue`, e.`serverid`, e.`helpchannel`, e.`waitlistrole`, e.`waitlistbracket`, e.`participantrole`, eg.`name`, eg.`gametime`, eg.`id`, eg.`threadid`, eg.`roundid`, r.`groupmaxsize`, r.`eventid`, e.`joinbuttontogroup`, r.`bracket` FROM `"+ mysql_database +"`.`eventmanager__groups` eg INNER JOIN `"+ mysql_database +"`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `"+ mysql_database +"`.`eventmanager__events` e ON r.`eventid` = e.`id` INNER JOIN `"+ mysql_database +"`.`eventmanager__brackets` br ON br.`eventid` = e.`id` AND br.`bracketid` = r.`bracket` AND eg.`pingmessageid` = '"+ messageid +"' AND eg.`completed` IS NULL AND eg.`gametime` > DATE_ADD(NOW(), INTERVAL -11 MINUTE)";
			const result = await new Promise((resolve, reject) => {
			con.query(sql, function (err, result) {
				if (err) reject(err);
				resolve(result);
			});
			});
			const group = result[0];
			if (group) {

				sql = "SELECT 1 FROM `"+ mysql_database +"`.`eventmanager__groupmembers` WHERE `groupid` = "+ group.id +" AND `validto` IS NULL";
				const groupmembers = await new Promise((resolve, reject) => {
				con.query(sql, function (err, result) {
					if (err) reject(err);
					resolve(result);
				});
				});
			
				const guild = await client.guilds.resolve(group.serverid);
				const member = await guild.members.fetch({ user: userid, force: true });

				if ((group.waitlistbracket <= group.bracketid && member.roles.cache.has(group.waitlistrole)) || member.roles.cache.has(group.noshowrole)) {

					const guild = await client.guilds.resolve(group.serverid);
					const thread = await guild.channels.fetch(group.threadid);

					if (groupmembers.length < group.groupmaxsize) {

						if (group.joinbuttontogroup == 1) {

								thread.members.add(member);

								const welcomemsg = `<@${userid}> just joined this group!`;
								await thread.send({ content: welcomemsg, allowedMentions: { users: [userid], repliedUser: false } });
								if (member.roles.cache.has(group.waitlistrole)) {
									await member.roles.remove(group.waitlistrole);
								}
								if (member.roles.cache.has(group.noshowrole)) {
									await member.roles.remove(group.noshowrole);
								}
								await member.roles.add(group.participantrole);
								
								sql = "UPDATE `"+ mysql_database +"`.`eventmanager__groupmembers` SET `validto` = NOW() WHERE `playerid` = "+ userid +" AND `validto` IS NULL AND `roundid` = "+ group.roundid +"";
								const result3 = await new Promise((resolve, reject) => {
									con.query(sql, function (err, result) {
										if (err) reject(err);
										resolve(result);
									});
								});
		
								sql = "INSERT INTO `"+ mysql_database +"`.`eventmanager__groupmembers` VALUES (NULL,"+ group.roundid +","+ group.id +","+ userid +",NOW(),NULL,NOW())";
								const result4 = await new Promise((resolve, reject) => {
									con.query(sql, function (err, result) {
										if (err) reject(err);
										resolve(result);
									});
								});
		
								sql = "INSERT INTO `"+ mysql_database +"`.`eventmanager__playerlog` VALUES (NULL,"+ userid +","+ group.eventid +",NOW(),'Joined from waitlist','Using Discord',NULL,NULL)";
								await new Promise((resolve, reject) => {con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });	
	
								sql = "UPDATE `"+ mysql_database +"`.`eventmanager__signups` SET `waitlist` = NULL, `bracket` = "+ group.bracket +" WHERE `eventid` = "+ group.eventid +" AND `playerid` = "+ userid +"";
								await new Promise((resolve, reject) => {con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });		

								if (groupmembers.length+1 == group.groupmaxsize) {

									const pingmessage = await thread.messages.fetch(group.pingmessageid);
									const messageContent = `This group is now full`;

									thread.messages.fetch(group.pingmessageid).then(
										existingMessage => {
											if (!existingMessage) {
											  console.log('Message not found.');
											}
											// Edit the existing message
											existingMessage.edit(messageContent)
											.then(editedMessage => {
			//									console.log(`Message edited in ${channel.name} (${editedMessage.guild.name})`);
											})
											.catch(error => console.error(`Error editing message: ${error}`));
										}
									)
								}


						} else {
							await interaction.followUp({ content: `${member} would like to take this spot`, ephemeral: false });
						}


					} else {
						await interaction.followUp({ content: `I am sorry, this group is now full`, ephemeral: true });

						sql = "UPDATE `"+ mysql_database +"`.`eventmanager__groups` SET `pingmessageid` = NULL WHERE `id` = "+ group.id +"";
						const result2 = await new Promise((resolve, reject) => {
							con.query(sql, function (err, result) {
								if (err) reject(err);
								resolve(result);
							});
						});

					}

				} else {
					await interaction.followUp({ content: `You are not on the waitlist/no-show list, and cannot join this group`, ephemeral: true });		
				}
			} else {
				await interaction.followUp({ content: `It is not possible to join this group now`, ephemeral: true });		
			}
			con.end();
		} catch (error) {
			console.error(error);
			await interaction.followUp({ content: "Error, please try again later", ephemeral: true });				
		}









	} else if (interaction.customId === 'reportscores') {
		
		try {
			await interaction.reply({ content: `Please stand by...`, ephemeral: true });		

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

			let sql = "SELECT e.`serverid`, e.`helpchannel`, e.`waitlistrole`, eg.`name`, eg.`gametime`, eg.`id`, eg.`threadid`, eg.`roundid`, e.`staffrole`, e.`staffchannel`, r.`scoring`, r.`eventid` FROM `"+ mysql_database +"`.`eventmanager__groups` eg INNER JOIN `"+ mysql_database +"`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `"+ mysql_database +"`.`eventmanager__events` e ON r.`eventid` = e.`id` AND  eg.`threadid` = '"+ channelid +"' AND `completed` IS NULL";
			const result = await new Promise((resolve, reject) => {
			con.query(sql, function (err, result) {
				if (err) reject(err);
				resolve(result);
			});
			});
			const group = result[0];
			if (group) {

				const guild = await client.guilds.resolve(group.serverid);
				const thread = await guild.channels.fetch(group.threadid);
				const member = await guild.members.fetch(userid);

				if (await member.roles.cache.has(group.staffrole)) {

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
						let sql = "UPDATE `"+ mysql_database +"`.`users` SET `guid` = '"+ guid +"', `guid_validto` = DATE_ADD(NOW(), INTERVAL +1 DAY) WHERE `discordid` = '"+ userid +"'";
						const result = await new Promise((resolve, reject) => {
							con.query(sql, function (err, result) {
							if (err) reject(err);
							resolve(result);
							});
						});
						await interaction.followUp({ content: 'Click this link to add the scores for this group: <https://friendsofrisk.com/eventmanager/'+ group.eventid +'/group/'+ group.id +'>', ephemeral: true, allowedMentions: { parse: [] } });
					} else {
						await interaction.followUp({ content: `I was unable to create a link for you. Please try again later.`, ephemeral: true });
					}



				} else {

					if (group.scoring == "POINTS") {
						await interaction.followUp({ content: `Please just write the results in a message in this thread like this\n\n1st: @player1 (1 bounty)\n2nd: @player2 (2 bounties)\n3rd: @player3\n4th @player4\n\nand get the other players to verify with a checkmark, then ping event staff who will gather the results.`, ephemeral: true });		
					} else {
						await interaction.followUp({ content: `Please just write the results in a message in this thread like this\n\nWinner:\n@player1\n@player3\n@player4\n\nLosers\n$player2\n@player5\n@player6\n\nand get the other players to verify with a checkmark, then ping event staff who will gather the results.`, ephemeral: true });
					}

				}




			}
			con.end();
		} catch (error) {
			console.error(error);
			await interaction.followUp({ content: "Error, please try again later", ephemeral: true });				
		}


	} else if (interaction.customId === 'pinghelp') {


		try {
			await interaction.reply({ content: "Please stand by...", ephemeral: true });

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

			let sql = "SELECT e.`serverid`, e.`helpchannel`, e.`waitlistrole`, eg.`name`, eg.`gametime`, eg.`id`, e.`staffchannel`, e.`staffrole` FROM `"+ mysql_database +"`.`eventmanager__groups` eg INNER JOIN `"+ mysql_database +"`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `"+ mysql_database +"`.`eventmanager__events` e ON r.`eventid` = e.`id` AND eg.`threadid` = '"+ channelid +"' AND eg.`completed` IS NULL AND (eg.`staffpinged` IS NULL OR DATE_ADD(NOW(), INTERVAL -10 MINUTE) > eg.`staffpinged`)";
			const result = await new Promise((resolve, reject) => {
			con.query(sql, function (err, result) {
				if (err) reject(err);
				resolve(result);
			});
			});
			const group = result[0];
			if (group) {

				const guild = await client.guilds.resolve(group.serverid);
                const channel = await guild.channels.fetch(channelid);
				//const staffthread = await guild.channels.fetch(group.staffchannel);

				const message = `${interaction.user} have requested help from <@&${group.staffrole}>`;
				await channel.send({ content: message, allowedMentions: { repliedUser: false, roles: [group.staffrole] } });

				sql = "UPDATE `"+ mysql_database +"`.`eventmanager__groups` SET `staffpinged` = NOW() WHERE `id` = "+ group.id +"";
				const result2 = await new Promise((resolve, reject) => {
					con.query(sql, function (err, result) {
						if (err) reject(err);
						resolve(result);
					});
				});

			} else {
				await interaction.followUp({ content: "I am not able to ping the event staff for you, sorry.", ephemeral: true });				
			}
			con.end();
		} catch (error) {
			console.error(error);
			await interaction.followUp({ content: "Error, please try again later", ephemeral: true });				
		}

	} else if (interaction.customId === 'cantmakeitconfirm') {

		try {

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

			let sql = "SELECT br.`noshowrole`, e.`serverid`, e.`helpchannel`, e.`staffrole`, e.`participantrole`, e.`waitlistrole`, eg.`name`, eg.`gametime`, eg.`id`, e.`staffchannel`, e.`staffrole`, eg.`checkinmessageid`, r.`eventid` FROM `"+ mysql_database +"`.`eventmanager__groups` eg INNER JOIN `"+ mysql_database +"`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `"+ mysql_database +"`.`eventmanager__events` e ON r.`eventid` = e.`id` INNER JOIN `"+ mysql_database +"`.`eventmanager__brackets` br ON br.`eventid` = e.`id` AND br.`bracketid` = r.`bracket` AND eg.`threadid` = '"+ channelid +"' AND eg.`completed` IS NULL";
			const result = await new Promise((resolve, reject) => {
			con.query(sql, function (err, result) {
				if (err) reject(err);
				resolve(result);
			});
			});
			const group = result[0];
			if (group) {

				const guild = await client.guilds.resolve(group.serverid);
                const thread = await guild.channels.fetch(channelid);
				const member = await guild.members.fetch(userid);

				await interaction.reply({ content: "Goodbye!", ephemeral: true });				

				const welcomemsg = `<@${userid}> just left this group`;
				await thread.send({ content: welcomemsg, allowedMentions: { users: [userid], repliedUser: false } });

				await member.roles.add(group.noshowrole);

				const threadMembers = await thread.members.fetch();
				if (threadMembers.has(member.id) && !member.roles.cache.has(group.staffroleid)) {
					await thread.members.remove(`${member.id}`);
				}

				sql = "UPDATE `"+ mysql_database +"`.`eventmanager__groupmembers` SET `validto` = NOW() WHERE `groupid` = "+ group.id +" AND `validto` IS NULL AND `playerid` = "+ interaction.user.id +"";
				await new Promise((resolve, reject) => {
					con.query(sql, (err, result) => {
						if (err) return reject(err);
						resolve(result);
					});
				});

				if (group.checkinmessageid) {
					await updatecheckinmessage(thread);
				}

				sql = "INSERT INTO `"+ mysql_database +"`.`eventmanager__playerlog` VALUES (NULL,"+ userid +","+ group.eventid +",NOW(),'Left a group before start','Using Discord',NULL,NULL)";
				await new Promise((resolve, reject) => {con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });
	
			} else {
				await interaction.reply({ content: "I am not able to put you on the waitlist, sorry!", ephemeral: true });				
			}
			con.end();
		} catch (error) {
			console.error(error);
			await interaction.reply({ content: "Error, please try again later", ephemeral: true });				
		}


	} else if (interaction.customId === 'rulesinfo') {

		try {

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

			let sql = "SELECT e.`serverid`, e.`helpchannel`, e.`participantrole`, e.`waitlistrole`, e.`ruleslink`, eg.`name`, eg.`gametime`, eg.`id`, e.`staffchannel`, e.`staffrole`, eg.`checkinmessageid`, eg.`roundid`, r.`eventid` FROM `"+ mysql_database +"`.`eventmanager__groups` eg INNER JOIN `"+ mysql_database +"`.`eventmanager__groupmembers` gm ON gm.`groupid` = eg.`id` AND gm.`playerid` = "+ userid +" AND gm.`validto` IS NULL INNER JOIN `"+ mysql_database +"`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `"+ mysql_database +"`.`eventmanager__events` e ON r.`eventid` = e.`id` AND eg.`threadid` = '"+ channelid +"' AND eg.`completed` IS NULL";
			const result = await new Promise((resolve, reject) => {
			con.query(sql, function (err, result) {
				if (err) reject(err);
				resolve(result);
			});
			});
			const group = result[0];
			if (group) {

				let message = `You can view information about the group on the Friends of Risk website\n\n[Event main Page](https://friendsofrisk.com/eventmanager/${group.eventid}/)\n[All Groups This Round](https://friendsofrisk.com/eventmanager/${group.eventid}/round/${group.roundid}/)\n[Settings](https://friendsofrisk.com/eventmanager/${group.eventid}/gamesettings/)\n[Current Standings](https://friendsofrisk.com/eventmanager/${group.eventid}/players/)\n[Rules](${group.ruleslink})\n`;

				await interaction.reply({ content: message, components: [], ephemeral: true });				

			} else {
				await interaction.reply({ content: "Error, please try again later", ephemeral: true });
			}
			con.end();
		} catch (error) {
			console.error(error);
			await interaction.reply({ content: "Error, please try again later", ephemeral: true });				
		}



	} else if (interaction.customId === 'cantmakeit') {

		try {

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

			let sql = "SELECT e.`serverid`, e.`helpchannel`, e.`participantrole`, e.`waitlistrole`, eg.`name`, eg.`gametime`, eg.`id`, e.`staffchannel`, e.`staffrole`, eg.`checkinmessageid`, eg.`roundid`, r.`eventid` FROM `"+ mysql_database +"`.`eventmanager__groups` eg INNER JOIN `"+ mysql_database +"`.`eventmanager__groupmembers` gm ON gm.`groupid` = eg.`id` AND gm.`playerid` = "+ userid +" AND gm.`validto` IS NULL INNER JOIN `"+ mysql_database +"`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `"+ mysql_database +"`.`eventmanager__events` e ON r.`eventid` = e.`id` AND eg.`threadid` = '"+ channelid +"' AND eg.`completed` IS NULL";
			const result = await new Promise((resolve, reject) => {
			con.query(sql, function (err, result) {
				if (err) reject(err);
				resolve(result);
			});
			});
			const group = result[0];
			if (group) {

				let message = `We recommend trying to look for a swap into another group first. Look up the other groups at https://friendsofrisk.com/eventmanager/${group.eventid}/round/${group.roundid}/ and then ping players you would like to swap with in the help-channel: <#${group.helpchannel}>. If you just want to be put on the noshow-list instead with no guarantee that you will be able to get in a group this round, please click this button:`;

				const btn1 = new ButtonBuilder()
				.setCustomId('cantmakeitconfirm')
				.setLabel('Put me on the noshow-list')
				.setStyle(ButtonStyle.Danger);

				let components = [];
				const row = new ActionRowBuilder().addComponents(btn1);
				components.push(row);

				await interaction.reply({ content: message, components: components, ephemeral: true });				

			} else {
				await interaction.reply({ content: "Error, please try again later", ephemeral: true });
			}
			con.end();
		} catch (error) {
			console.error(error);
			await interaction.reply({ content: "Error, please try again later", ephemeral: true });				
		}

	} else if (interaction.customId === 'checkin') {

		

		try {

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

			let sql = "SELECT e.`serverid`, e.`helpchannel`, e.`waitlistrole`, eg.`name`, eg.`gametime`, eg.`id`, e.`staffchannel`, e.`staffrole`, eg.`checkinmessageid` FROM `"+ mysql_database +"`.`eventmanager__groups` eg INNER JOIN `"+ mysql_database +"`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `"+ mysql_database +"`.`eventmanager__events` e ON r.`eventid` = e.`id` AND eg.`threadid` = '"+ channelid +"' INNER JOIN `"+ mysql_database +"`.`eventmanager__groupmembers` gm ON gm.`groupid` = eg.`id` AND gm.`playerid` = "+ userid +" AND gm.`validto` IS NULL AND eg.`threadid` = "+ channelid +" AND gm.`checkedin` IS NULL AND eg.`completed` IS NULL AND eg.`checkinmessageid` IS NOT NULL";
			const result = await new Promise((resolve, reject) => {
			con.query(sql, function (err, result) {
				if (err) reject(err);
				resolve(result);
			});
			});
			const group = result[0];
			if (group) {

				const guild = await client.guilds.resolve(group.serverid);
                const thread = await guild.channels.fetch(channelid);

				sql = "UPDATE `"+ mysql_database +"`.`eventmanager__groupmembers` SET `checkedin` = NOW() WHERE `groupid` = "+ group.id +" AND `validto` IS NULL AND `playerid` = "+ userid +"";
				await new Promise((resolve, reject) => {
					con.query(sql, (err, result) => {
						if (err) return reject(err);
						resolve(result);
					});
				});
	
				await interaction.reply({ content: "You are now checked in ✅", ephemeral: true });				
				await updatecheckinmessage(thread);

			} else {
				await interaction.reply({ content: "I am not able to check you in, sorry!", ephemeral: true });				
			}
			con.end();
		} catch (error) {
			console.error(error);
			await interaction.reply({ content: "Error, please try again later", ephemeral: true });				
		}


	} else if (interaction.customId === 'availabilityupdate') {

		try {

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
					let sql = "UPDATE `"+ mysql_database +"`.`users` SET `guid` = '"+ guid +"', `guid_validto` = DATE_ADD(NOW(), INTERVAL +1 DAY) WHERE `discordid` = '"+ userid +"'";
					const result = await new Promise((resolve, reject) => {
						con.query(sql, function (err, result) {
						if (err) reject(err);
						resolve(result);
						});
					});
					await interaction.reply({ content: 'Click this link to update your availability: <https://friendsofrisk.com/register/availability/login/'+ rows[0].id +'/'+ guid +'>', ephemeral: true, allowedMentions: { parse: [] } });
				}
			con.end();
		} catch (error) {
			console.error(error);
			await interaction.reply({ content: "Error, please try again later", ephemeral: true });				
		}


		
	} else if (interaction.customId === 'availability') {

		try {

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

			let sql = "SELECT * FROM `"+ mysql_database +"`.`users` WHERE `discordid` = '"+ userid +"' LIMIT 1";
			const result = await new Promise((resolve, reject) => {
			con.query(sql, function (err, result) {
				if (err) reject(err);
				resolve(result);
			});
			});
			const rows = result;
			if (rows.length == 1) {
				let sql2 = "SELECT * FROM `"+ mysql_database +"`.`eventmanager__events` WHERE `signupchannel` = '"+ interaction.channel.id +"' LIMIT 1";
				const result2 = await new Promise((resolve, reject) => {
					con.query(sql2, function (err, result) {
						if (err) reject(err);
						resolve(result);
					});
				});
				if (result2.length == 1) {
					const guid = uuidv4().toUpperCase();
					let sql = "UPDATE `"+ mysql_database +"`.`users` SET `guid` = '"+ guid +"', `guid_validto` = DATE_ADD(NOW(), INTERVAL +1 DAY) WHERE `discordid` = '"+ userid +"'";
					const result = await new Promise((resolve, reject) => {
						con.query(sql, function (err, result) {
						if (err) reject(err);
						resolve(result);
						});
					});
					await interaction.reply({ content: 'Click this link to update your availability: <https://friendsofrisk.com/register/availability/login/'+ rows[0].id +'/'+ guid +'/eventid/'+ result2[0].id +'>', ephemeral: true, allowedMentions: { parse: [] } });
				}
			}
			con.end();
		} catch (error) {
			console.error(error);
			await interaction.reply({ content: "Error, please try again later", ephemeral: true });				
		}
    }
});




function processDMqueue () {
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
	
		var sql = "SELECT * FROM `"+ mysql_database +"`.`dm_queue` WHERE `validto` IS NULL AND `sent` IS NULL AND `validfrom` < NOW() ORDER BY `validfrom` ASC LIMIT 0,8";
		con.query(sql, function (err, result) {
			if (err) throw err;
			for (const message of result) {
				// Updating database BEFORE we try to send it through Discord, just because I dont want to end up in a "hammer" situation where we try to send the same message again and again and again
				var sql = "UPDATE `"+ mysql_database +"`.`dm_queue` SET `sent` = NOW() WHERE `id` = "+ message.id +"";
				con.query(sql, function (err, result2) {
					if (err) throw err;
					console.log('DM sent');
				});
				// No error handling??? Should add some...
				client.users.fetch(message.userid.toString()).then(dm => {
					try {
	
						if (message.attachment != "") {
							const attachment = new AttachmentBuilder(message.attachment);
							dm.send({ content: message.message, files: [attachment] });			
						} else {
							dm.send(message.message);
						}
	
					} catch (error) {
						console.error(error.message);
					}
				});	
			}
			con.end();
		});	
}

// Check for DM messages to send every 10th minute
cron.schedule("0 */10 * * * *", function () {

	processDMqueue();
});

// Function to log any command run
async function logcommand(interaction) {

	try {

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

		let sql = "INSERT INTO `"+ mysql_database +"`.`riskbot__log` VALUES (NULL,NOW(),"+ interaction.user.id +",'"+ interaction.commandName +"',"+ interaction.guild.id +")";
		const query = await new Promise((resolve, reject) => {
		con.query(sql, function (err, result) {
			if (err) reject(err);
				resolve(result);
			});
		});

		con.end();

	} catch (error) {
		// Handle errors
		console.error("Error:", error);
	}
			
};


//client.on("debug", console.log);
client.login(token);

// API functions
async function add_to_thread(serverid, channelid, threadid, userid) {
	try {

		const guild = await client.guilds.fetch(serverid);
        if (!guild) {
            console.log('Guild not found');
            return;
        }

		const thread = await guild.channels.fetch(threadid);
		if (thread && thread.type === ChannelType.PublicThread || thread.type === ChannelType.PrivateThread || thread.type === ChannelType.AnnouncementThread) {
			const member = await guild.members.fetch(userid);
			thread.members.add(member)
			.then(() => {
//				console.log(`Added ${member.user.tag} to the thread.`);
			})
			.catch(console.error)
		}

	} catch (error) {
		console.error(error.message);
	}
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}



// Function to log any command run
async function countMemes(client, serverid, channelid) {

	const guild = await client.guilds.fetch(serverid);
	if (!guild) {
		console.log('Guild not found');
		return;
	}

	const channel = await guild.channels.fetch(channelid);

	const START_DATE = new Date('2025-01-20'); // Change to your desired start date

	let lastMessageId = null;
    let imageMessages = [];

    while (true) {
        const messages = await channel.messages.fetch({ limit: 100, before: lastMessageId });
        if (messages.size === 0) break;

        messages.forEach((message) => {
            if (message.createdAt < START_DATE) return;

            let imageLinks = [];
            if (message.attachments.size > 0) {
                imageLinks = [...message.attachments.values()].map(attachment => attachment.url);
            }
            if (message.embeds.length > 0) {
                imageLinks.push(...message.embeds.filter(embed => embed.image).map(embed => embed.image.url));
            }

            if (imageLinks.length > 0) {
                const reactionCount = message.reactions.cache.reduce((sum, reaction) => sum + reaction.count, 0);
                imageMessages.push({ 
                    messageId: message.id, 
                    author: message.author.tag, 
                    authorid: message.author.id, 
                    images: imageLinks, 
                    reactions: reactionCount 
                });
            }
        });

        lastMessageId = messages.last()?.id;
        if (!lastMessageId || messages.last().createdAt < START_DATE) break;
    }

    return imageMessages;
			
};




// API functions - removes all members from that role
async function emptyRole(serverid, roleid) {
	try {

        const guild = await client.guilds.fetch(serverid);
        if (!guild) {
            console.log('Guild not found');
            return;
        }
		const role = await guild.roles.fetch(roleid);
        if (!role) {
            console.log('Role not found');
            return;
        }

		const members = await guild.members.fetch();
		const membersWithRole = members.filter(member => member.roles.cache.has(role.id)); 
		for (const member of membersWithRole.values()) {
			try {
				await member.roles.remove(role);
				await sleep(2000);
			} catch (error) {
				console.error(`Failed to remove role from ${member.user.tag}:`, error);
			}
		}

	} catch (error) {
		console.error(error.message);
	}
}


async function fetchRole(serverid, roleid) {
    try {
        const guild = await client.guilds.fetch(serverid);
        if (!guild) {
            console.log('Guild not found');
            return null;
        }

        const role = await guild.roles.fetch(roleid);
        if (!role) {
            console.log('Role not found');
            return null;
        }

        const members = await guild.members.fetch();
        const memberIds = members
            .filter(member => member.roles.cache.has(role.id));

        return {
            roleName: role.name,
            memberIds: memberIds
        };

    } catch (error) {
        console.error(error.message);
        return null;
    }
}



// API functions
async function deleteRole(serverid, roleid) {
	try {

        const guild = await client.guilds.fetch(serverid);
        if (!guild) {
            console.log('Guild not found');
            return;
        }
		const role = await guild.roles.fetch(roleid);
        if (!role) {
            console.log('Role not found');
            return;
        }
		await guild.roles.delete(role);

	} catch (error) {
		console.error(error.message);
	}
}


async function deleteChannel(serverid, channelid) {
	try {

        const guild = await client.guilds.fetch(serverid);
        if (!guild) {
            console.log('Guild not found');
            return;
        }
        const channel = await guild.channels.fetch(channelid);
		await guild.channels.delete(channel);

	} catch (error) {
		console.error(error.message);
	}
}


async function deleteThread(serverid, channelid, threadid) {
    try {
        // Fetch the guild (server)
        const guild = await client.guilds.fetch(serverid);
        if (!guild) {
            console.log('Guild not found');
            return;
        }

        // Fetch the channel the thread belongs to
        const channel = await guild.channels.fetch(channelid);
        if (!channel) {
            console.log('Channel not found');
            return;
        }

        // Fetch the thread within the channel
        const thread = await channel.threads.fetch(threadid);
        if (!thread) {
            console.log('Thread not found');
            return;
        }

        // Lock and archive the thread (optional)
        await thread.setLocked(true);
        await thread.setArchived(true);

        // Delete the thread
        await thread.delete();
        console.log(`Thread ${threadid} has been deleted successfully.`);

    } catch (error) {
        console.error(`Error deleting thread: ${error.message}`);
    }
}






async function removefromthread(server, channelid, threadid, userid) {
	try {

        const guild = await client.guilds.fetch(server);
        if (!guild) {
            console.log('Guild not found');
            return;
        }
        const channel = await guild.channels.fetch(channelid);
        if (!channel) {
            console.log('Channel not found');
            return;
        }

		const user = await guild.members.fetch(userid);
		if (!user) {
            console.log('User not found');
            return;
        }
		const thread = await channel.threads.fetch(threadid);
		if (!thread) {
            console.log('Thread not found');
            return;
        }
		const threadMembers = await thread.members.fetch();
		if (threadMembers.has(user.id)) {
	        await thread.members.remove(`${user.id}`);
		}
		return "SUCCESS";

    } catch (error) {
        console.error('Error fetching guild or channel:', error);
    }

};



// API functions
async function create_thread(tserver, tchannel, threadname, tusers, tstaffrole, tmessage) {

	try {


	    const guild = await client.guilds.fetch(tserver);
        if (!guild) {
            console.log('Guild not found');
            return;
        }

        const channel = await guild.channels.fetch(tchannel);
        if (!channel) {
            console.log('Channel not found');
            return;
        }

		const staffrole = await guild.roles.fetch(tstaffrole);

		const thread = await channel.threads.create({
            name: threadname,
			type: ChannelType.PrivateThread,
            autoArchiveDuration: 10080,
			permissionOverwrites: [
				{
					id: staffrole, // ID of the role
					allow: ['ViewChannel', 'SendMessages', 'ManageMessages', 'ManageThreads'],
				}
			],
        });

		if (!thread) {
			console.error("Thread creation failed for group "+ threadname);
			return;
		}

		const firstmessage = await thread.send({ content: `<@&${staffrole.id}> can all relax, I will be this groups host this round ❤️`, embeds: [], components: [], files: [], allowedMentions: { roles: [staffrole.id], users: [], repliedUser: false } });

		
		// Usage
		/*
		// Get all members with the role
		const roleMembers = staffrole.members;

		async function addMembersToThread(guild, thread, members) {
			for (const member of members) {
				try {
					await addThreadMember(guild, thread, member)
					console.log(`Added ${member.user.tag} to the thread`);
				} catch (error) {
					console.error(`Failed to add ${member.user.tag} to the thread:`, error);
				}
			}
		}

		const staffMembers = staffrole.members;
		await addMembersToThread(guild, thread, staffMembers);
		*/
		
		return thread;

    } catch (error) {
        console.error('Error fetching guild or channel:', error);
    }

}






// API functions
async function createRole (tserver, trolename) {

	try {

	    const guild = await client.guilds.fetch(tserver);
        if (!guild) {
            console.log('Guild not found');
            return;
        }

		const role = await guild.roles.create({
			name: trolename, // Replace with your desired role name
			reason: 'Role created by Riskbot',
		});

		if (!role) {
			console.error("Role creation failed");
			return;
		}
		
		return role;

    } catch (error) {
        console.error('Error fetching guild or channel:', error);
    }

}







// API functions
async function message_thread(msgserver, msgchannel, msgthread, msg, tusers) {

    try {

		//tusers = [...new Set(tusers)];

        const guild = await client.guilds.fetch(msgserver);
        if (!guild) {
            console.log('Guild not found');
            return;
        }

        const channel = await guild.channels.fetch(msgthread);
        if (!channel) {
            console.log('channel not found');
            return;
        }


		let attachments = [];
		let components = [];
		let messagetext = "";
	
		if (typeof msg === 'object' && msg !== null && !Array.isArray(msg)) {

			messagetext = msg.message;
			if (msg.attachments.length > 0) {

				msg.attachments.forEach(attachment => {
					const attachment1 = new AttachmentBuilder(attachment); // Assuming you want to use the attachment's URL
					attachments.push(attachment1);
				});
			}

			if (msg.buttons == 1) {

				const btn1 = new ButtonBuilder()
				.setCustomId('pinghelp')
				.setLabel('Ping event staff')
				.setStyle(ButtonStyle.Danger);

				const btn2 = new ButtonBuilder()
				.setCustomId('cantmakeit')
				.setLabel('I cannot make it')
				.setStyle(ButtonStyle.Danger);

				const btn3 = new ButtonBuilder()
				.setCustomId('rulesinfo')
				.setLabel('Rules&info')
				.setStyle(ButtonStyle.Primary);

				const row = new ActionRowBuilder().addComponents(btn1).addComponents(btn2).addComponents(btn3);

				components.push(row);

			}

		} else {
			messagetext = msg;
		}


		// Add each user in tusers to the thread using Promise.all
		let userPings = "";
        for (const userid of tusers) {
			userPings += `<@${userid}> `;
		}

		//console.log(tusers);
		//console.log(`Userpings:`, userPings);
		
		const embed = new EmbedBuilder()
        .setTitle(`Important message!`)
        .setDescription(messagetext)
        .setTimestamp();

		const message = await channel.send({ content: userPings, embeds: embed ? [embed] : [], components: components, files: attachments, allowedMentions: { users: tusers, repliedUser: false } });

		return message;

    } catch (error) {
        console.error('Error fetching guild or channel:', error);
    }
}


// API functions
async function message_channel(msgserver, msgchannel, msg) {

    try {
        const guild = await client.guilds.fetch(msgserver);
        if (!guild) {
            console.log('Guild not found');
            return;
        }

        const channel = await guild.channels.fetch(msgchannel);
        if (!channel) {
            console.log('Channel not found');
            return;
        }

        let message = await channel.send(msg);
		return message;
    } catch (error) {
        console.error('Error fetching guild or channel:', error);
    }
}

/////////////////////////
//                     //
// WEBSERVER GOES HERE //
//                     //
/////////////////////////

// Middleware to parse JSON bodies
app.use(express.json());

// Middleware to parse URL-encoded bodies (for form submissions)
app.use(express.urlencoded({ extended: true }));

// API Endpoint for messaging
app.post('/api/updateallowedchannelids', async (req, res) => {
	await updateallowedChannelIds();
	await updatechatChannelIds();
	allowedChannelIds = getAllowedChannelIds();
	chatChannelIds = getChatChannelIds();
	announcementChannelsIds = getAnnouncementChannelsIds();
	res.header("Content-Type",'application/json');
	res.send(JSON.stringify('success', null, 4));	
})


// API Endpoint for counting meme scores
app.post('/api/countmemes', async (req, res) => {
	try {
		let post = req.body;
		let output = await countMemes(client, post.serverid, post.channelid);
		res.header("Content-Type",'application/json');
		res.send(JSON.stringify(output, null, 4));	
    } catch (error) {
        console.error('Error in counting memes:', error);
        res.status(500).send({ error: "An error occurred during counting memes" });
    }
});


// API Endpoint for deleting a role
app.post('/api/emptyrole', async (req, res) => {
	try {
		let post = req.body;
		let output = await emptyRole(post.serverid, post.roleid);;
		res.header("Content-Type",'application/json');
		res.send(JSON.stringify(output, null, 4));	
    } catch (error) {
        console.error('Error in emptying role:', error);
        res.status(500).send({ error: "An error occurred during emptying role" });
    }
});


// API Endpoint for deleting a role
app.post('/api/fetchrole', async (req, res) => {
	try {
		let post = req.body;
		let output = await fetchRole(post.serverid, post.roleid);;
		res.header("Content-Type",'application/json');
		res.send(JSON.stringify(output, null, 4));	
    } catch (error) {
        console.error('Error in fetching role:', error);
        res.status(500).send({ error: "An error occurred during fetching role" });
    }
});




// API Endpoint for deleting a role
app.post('/api/deleterole', async (req, res) => {
	try {
		let post = req.body;
		let output = await deleteRole(post.serverid, post.roleid);;
		res.header("Content-Type",'application/json');
		res.send(JSON.stringify(output, null, 4));	
    } catch (error) {
        console.error('Error in thread creation:', error);
        res.status(500).send({ error: "An error occurred during thread creation" });
    }
});

// API Endpoint for deleting a role
app.post('/api/createrole', async (req, res) => {
	try {
		let post = req.body;
		let output = await createRole(post.serverid, post.rolename);;
		res.header("Content-Type",'application/json');
		res.send(JSON.stringify(output, null, 4));	
    } catch (error) {
        console.error('Error in role creation:', error);
        res.status(500).send({ error: "An error occurred during role creation" });
    }
});


// API Endpoint for deleting a channel
app.post('/api/deletechannel', async (req, res) => {
	try {
		let post = req.body;
		let output = await deleteChannel(post.serverid, post.channelid);;
		res.header("Content-Type",'application/json');
		res.send(JSON.stringify(output, null, 4));	
    } catch (error) {
        console.error('Error in thread creation:', error);
        res.status(500).send({ error: "An error occurred during thread creation" });
    }
});

// API Endpoint for deleting a thread
app.post('/api/deletethread', async (req, res) => {
	try {
		let post = req.body;
		let output = await deleteThread(post.serverid, post.channelid, post.threadid);;
		res.header("Content-Type",'application/json');
		res.send(JSON.stringify(output, null, 4));	
    } catch (error) {
        console.error('Error in thread closing:', error);
        res.status(500).send({ error: "An error occurred during thread deletion" });
    }
});

// API Endpoint for locking a thread
app.post('/api/lockthread', async (req, res) => {
	try {
		let post = req.body;
		let output = await lockThread(client, post.serverid, post.channelid, post.threadid);;
		res.header("Content-Type",'application/json');
		res.send(JSON.stringify(output, null, 4));	
    } catch (error) {
        console.error('Error in thread locking:', error);
        res.status(500).send({ error: "An error occurred during thread locking" });
    }
});


// API Endpoint for messaging
app.post('/api/message', async (req, res) => {
	try {
		let post = req.body;
		let output = await message_channel(post.server, post.channel, post.message);
		res.header("Content-Type",'application/json');
		res.send(JSON.stringify(output, null, 4));	
    } catch (error) {
        console.error('Error in message creation:', error);
        res.status(500).send({ error: "An error occurred during message creation" });
    }
});




// API Endpoint for adding roles
app.post('/api/addrole', async (req, res) => {
	try {
		let output = "OK";
		let post = req.body;
		const guild = await client.guilds.resolve(post.serverid);
		// Try to fetch the member, but catch the error if they don't exist
		let member;
		try {
			member = await guild.members.fetch(post.userid);
		} catch (error) {
			if (error.code === 10007) { // Discord API Error Code 10007: Unknown Member
				console.log('Member not found in the server');
				output = "Failed: Member not found";
			} else {
				throw error; // Rethrow any other error
			}
		}
		if (member) {
			const role = await guild.roles.fetch(post.roleid);
			if (role) {
				await member.roles.add(role);
			}	
		}
		res.header("Content-Type",'application/json');
		res.send(JSON.stringify(output, null, 4));	
    } catch (error) {
        console.error('Error in adding role:', error);
        res.status(500).send({ error: "An error occurred when adding role" });
    }
});


// API Endpoint for removing roles
app.post('/api/removerole', async (req, res) => {
	try {
		let post = req.body;
		let output = "OK";
		const guild = await client.guilds.resolve(post.serverid);
		// Try to fetch the member, but catch the error if they don't exist
		let member;
		try {
			member = await guild.members.fetch(post.userid);
		} catch (error) {
			if (error.code === 10007) { // Discord API Error Code 10007: Unknown Member
				console.log('Member not found in the server');
				output = "Failed: Member not found";
			} else {
				throw error; // Rethrow any other error
			}
		}
		if (member) {
			const role = await guild.roles.fetch(post.roleid);
			if (role) {
				await member.roles.remove(role);
			} else {
				output = "Failed";
			}	
		}
		res.header("Content-Type",'application/json');
		res.send(JSON.stringify(output, null, 4));	
    } catch (error) {
        console.error('Error in removing role:', error);
        res.status(500).send({ error: "An error occurred when removing role" });
    }
})


// API Endpoint for creating threads
app.post('/api/createthread', async (req, res) => {
	try {
		//console.log(req.body);
		let post = req.body;
		let output = await create_thread(post.server, post.channel, post.threadname, post.users, post.staffrole, post.message);
		res.header("Content-Type",'application/json');
		res.send(JSON.stringify(output, null, 4));
	} catch (error) {
		console.error('Error in thread creation:', error);
		res.status(500).send({ error: "An error occurred during thread creation" });
	}

});

// API Endpoint for messaging
app.post('/api/messagethread', async (req, res) => {
	try {
		let post = req.body;
		let output = await message_thread(post.server, post.channel, post.thread, post.message, post.users);
		res.header("Content-Type",'application/json');
		res.send(JSON.stringify(output, null, 4));	
    } catch (error) {
        console.error('Error in message creation:', error);
        res.status(500).send({ error: "An error occurred during message creation" });
    }
});



// API Endpoint for removing someone from a thread
app.post('/api/addtothread', async (req, res) => {
	try {
		//console.log(req.body);
		let post = req.body;
		let output = await add_to_thread(post.serverid, post.channelid, post.threadid, post.userid);
		res.header("Content-Type",'application/json');
		res.send(JSON.stringify(output, null, 4));
	} catch (error) {
		console.error('Error in thread creation:', error);
		res.status(500).send({ error: "An error occurred during removal from thread" });
	}

})


// API Endpoint for removing someone from a thread
app.post('/api/removefromthread', async (req, res) => {
	try {
		//console.log(req.body);
		let post = req.body;
		let output = await removefromthread(post.serverid, post.channelid, post.threadid, post.userid);
		res.header("Content-Type",'application/json');
		res.send(JSON.stringify(output, null, 4));
	} catch (error) {
		console.error('Error in thread creation:', error);
		res.status(500).send({ error: "An error occurred during removal from thread" });
	}

})


// API Endpoint for swapping users
app.post('/api/swapusers', async (req, res) => {
	try {
		//console.log(req.body);
		let post = req.body;
		let output = await swap_users(client, post.server, post.channel, post.thread_a, post.user_a, post.thread_b, post.user_b, post.message, post.staffroleid);
		res.header("Content-Type",'application/json');
		res.send(JSON.stringify(output, null, 4));
	} catch (error) {
		console.error('Error in thread creation:', error);
		res.status(500).send({ error: "An error occurred during thread creation" });
	}

})

app.listen(port, () => {
	console.log(`Riskbot API listening on port localhost:${port}`)
})

