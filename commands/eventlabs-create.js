// Load required modules and config
const { SlashCommandBuilder, ChannelType, PermissionsBitField } = require('discord.js');
const { guilds, mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');
const { updateEventChannelIds } = require('../modules/signuphandler.js');

var mysql = require('mysql2');

// Register command
module.exports = {
	data: new SlashCommandBuilder()
	.setName('eventlabs-create')
	.setDescription('Create an eventlabs event')
	.addStringOption(option =>
		option.setName('eventname')
		.setDescription('Event name')
		.setRequired(true))
	,
async execute(interaction, client) {
	try {

		await interaction.reply({ content: "Please stand by while I do my stuff...", ephemeral: true });
	
		const interactionUser = await interaction.guild.members.fetch(interaction.user.id);
		const eventname = interaction.options.getString('eventname').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50);

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
			console.log("Connected to MySQL server!");
		});

		var errors = "Woups, this didnt work as intented";

			try {

				let sql = "SELECT 1 FROM `"+ global.config.mysql_database +"`.`eventmanager__events` e INNER JOIN `"+ global.config.mysql_database +"`.`eventmanager__events_status` es ON e.`id` = es.`eventid` AND es.`validto` IS NULL AND es.`status` != 'ARCHIVED' AND e.`owner` = "+ interaction.user.id +" AND e.`type` = 'EVENTLABS'";
				let result = await new Promise((resolve, reject) => {
					con.query(sql, function (err, result) {
						if (err) reject(err);
						resolve(result);
					});
				});
				if (result.length < 5) {
					const eventlabsserverid = global.config.guilds.MAIN;
					const eventlabscategory = "1286780709100589080";
	
					const guild = await client.guilds.fetch(eventlabsserverid);
					if (!guild) {
						console.log('Guild not found');
						return;
					}

					const botMember = guild.members.me;
	
					const category = await guild.channels.fetch(eventlabscategory);
					if (!category || category.type !== ChannelType.GuildCategory) {
						console.log('Category not found or not a category');
						return;
					}
	
					sql = "INSERT INTO `"+ global.config.mysql_database +"`.`eventmanager__events` VALUES (NULL,'EVENTLABS','"+ eventname +"',"+ interaction.user.id +",NOW(),NULL,NULL,"+ eventlabsserverid +",1,'CLOSED',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,1,0,0,0,1,0,0,0,1)";
					result = await new Promise((resolve, reject) => {
						con.query(sql, function (err, result) {
							if (err) reject(err);
							resolve(result);
						});
					});
					const eventid = result.insertId;
	
					let sql_round = "INSERT INTO `"+ global.config.mysql_database +"`.`eventmanager__rounds` VALUES (NULL,"+ eventid +",1,1,'Round 1','DRAFT',6,4,'POINTS','WAITLIST',0,1,NULL,NULL,NULL,NULL,NULL,'This is your groups thread for this round, where you can confirm that everyone is ready, share lobby code before joinging the game and posting the results afterwards.\n## Your game is scheduled ##COUNTDOWN## at ##GAMETIME## (your local timezone)\nThe settings you are playing are shown in the attached images. If you have any question please click the buttons below or ask your fellow participants.\n## When the game is finished\nJust write the results in this thread and event staff will pick it up')";
					let result_round = await new Promise((resolve, reject) => {
						con.query(sql_round, function (err, result) {
							if (err) reject(err);
							resolve(result);
						});
					});


					const channelName = "📢 "+eventname.substring(0, 50) +"-(E"+eventid+")";
					const noshowRoleName = "E"+eventid+"-noshow-bracket1";
					const participantRoleName = "E"+eventid+"-participant";
					const waitlistRoleName = "E"+eventid+"-waitlist";
					const staffRoleName = "E"+eventid+"-staff";
	
					const noshowRole = await guild.roles.create({
						name: noshowRoleName, // Replace with your desired role name
						reason: 'Role created for those noshowing',
						mentionable: false // Ensure role is not pingable
					});
	
					const staffRole = await guild.roles.create({
						name: staffRoleName, // Replace with your desired role name
						reason: 'Role created to be eventlabs staff',
						mentionable: false // Ensure role is not pingable
					});
	
					const participantRole = await guild.roles.create({
						name: participantRoleName, // Replace with your desired role name
						reason: 'Role created to be eventlabs participant',
						mentionable: false // Ensure role is not pingable
					});
	
					const waitlistRole = await guild.roles.create({
						name: waitlistRoleName, // Replace with your desired role name
						reason: 'Role created for waitlist players in event',
						mentionable: false // Ensure role is not pingable
					});

					let sql_bracket = "INSERT INTO `"+ global.config.mysql_database +"`.`eventmanager__brackets` VALUES (NULL,"+ eventid +",1,'"+ noshowRole.id +"','Bracket 1')";
					let result_bracket = await new Promise((resolve, reject) => {
						con.query(sql_bracket, function (err, result) {
							if (err) reject(err);
							resolve(result);
						});
					});

					sql = "INSERT INTO `"+ global.config.mysql_database +"`.`eventmanager__events_status` VALUES (NULL,"+ eventid +",NOW(),NULL,'OPEN')";
					result_status = await new Promise((resolve, reject) => {
						con.query(sql, function (err, result) {
							if (err) reject(err);
							resolve(result);
						});
					});
	
	
					await interactionUser.roles.add(staffRole);
	
					sql = "INSERT INTO `"+ global.config.mysql_database +"`.`eventmanager__admins` VALUES ("+ eventid +","+ interaction.user.id +")";
					result = await new Promise((resolve, reject) => {
						con.query(sql, function (err, result) {
							if (err) reject(err);
							resolve(result);
						});
					});
	
					const newChannel = await guild.channels.create({
						name: channelName,
						icon: "📢",
						type: ChannelType.GuildText, // You can change this to GuildVoice if you want a voice channel
						parent: category.id,
						permissionOverwrites: [
							{
								id: guild.id,
								allow: [
									PermissionsBitField.Flags.ViewChannel,
									PermissionsBitField.Flags.ReadMessageHistory,
									PermissionsBitField.Flags.AttachFiles,
									PermissionsBitField.Flags.AddReactions
								],
								deny: [
									PermissionsBitField.Flags.SendMessages // Prevent @everyone from sending messages
								]
							},
							{
								id: botMember.roles.botRole.id, // Set full permissions for the bot's role
								allow: [
									PermissionsBitField.Flags.ViewChannel,
									PermissionsBitField.Flags.SendMessages,
									PermissionsBitField.Flags.ManageChannels,
									PermissionsBitField.Flags.ManageMessages,
									PermissionsBitField.Flags.EmbedLinks,
									PermissionsBitField.Flags.ReadMessageHistory,
									PermissionsBitField.Flags.ManageThreads,
									PermissionsBitField.Flags.AttachFiles,
									PermissionsBitField.Flags.AddReactions
								],
							},
							{
								id: interaction.user.id, // Set the permissions for the newly created role
								allow: [
									PermissionsBitField.Flags.ViewChannel,
									PermissionsBitField.Flags.SendMessages,
									PermissionsBitField.Flags.ManageChannels,
									PermissionsBitField.Flags.ManageMessages,
									PermissionsBitField.Flags.EmbedLinks,
									PermissionsBitField.Flags.ReadMessageHistory,
									PermissionsBitField.Flags.ManageThreads,
									PermissionsBitField.Flags.AttachFiles,
									PermissionsBitField.Flags.AddReactions
								],
							},
							{
								id: staffRole.id, // Set the permissions for the newly created role
								allow: [
									PermissionsBitField.Flags.ViewChannel,
									PermissionsBitField.Flags.ManageChannels,
									PermissionsBitField.Flags.ManageMessages,
									PermissionsBitField.Flags.EmbedLinks,
									PermissionsBitField.Flags.ReadMessageHistory,
									PermissionsBitField.Flags.ManageThreads,
									PermissionsBitField.Flags.AttachFiles,
									PermissionsBitField.Flags.AddReactions
								],
							},
							// Add more permission overwrites if needed
						],
						defaultAutoArchiveDuration: 10080,
						reason: 'Eventlabs event channel', // Optional
					});
	
					const signupchannel = await newChannel.threads.create({
						name: "📝 signup",
						icon: "📝",
						type: ChannelType.PublicThread,
						autoArchiveDuration: 10080,
					});
	
					const textchannel = await newChannel.threads.create({
						name: "🗣️ chat",
						icon: "🗣️",
						type: ChannelType.PublicThread,
						autoArchiveDuration: 10080,
					});
	
					const helpchannel = await newChannel.threads.create({
						name: "👋 help",
						icon: "👋",
						type: ChannelType.PublicThread,
						autoArchiveDuration: 10080,
					});
	
					const staffchannel = await newChannel.threads.create({
						name: "🛂 staff",
						icon: "🛂",
						type: ChannelType.PrivateThread,
						autoArchiveDuration: 10080,
					});

					staffchannel.members.add(botMember.id);
					staffchannel.members.add(interactionUser.id);	

					await staffchannel.send(`This will be your staff thread, where only event staff will have access`);
					await signupchannel.send(`### Signups are currently closed. Please check back later.`);
	
					sql = "UPDATE `"+ global.config.mysql_database +"`.`eventmanager__events` SET `signupchannel` = "+ signupchannel.id +",`mainchannel` = "+ newChannel.id +",`helpchannel` = "+ helpchannel.id +",`textchannel` = "+ textchannel.id +",`staffchannel` = "+ staffchannel.id +",`participantrole` = "+ participantRole.id +",`staffrole` = "+ staffRole.id +",`waitlistrole` = "+ waitlistRole.id +" WHERE `id` = "+ eventid +"";
					result = await new Promise((resolve, reject) => {
						con.query(sql, function (err, result) {
							if (err) reject(err);
							resolve(result);
						});
					});
	
					let welcomemsg = await newChannel.send(`Welcome to ${eventname}\n\nYou will find any announcements regarding this event in here.\n\nEvent webpage (rules, signups, groups, standings, rounds, settings will be published here): https://friendsofrisk.com/eventmanager/${eventid}\n\n[Signup thread](https://discord.com/channels/${guild.id}/${signupchannel.id})\n[Chat thread](https://discord.com/channels/${guild.id}/${textchannel.id})\n[Help thread](https://discord.com/channels/${guild.id}/${helpchannel.id})\n\nGood luck!`);
					await welcomemsg.pin();
	
					errors = `Your event is created and ready to accept signups from players messaging 'signup' in https://discord.com/channels/${guild.id}/${signupchannel.id}. You can manage your event at https://friendsofrisk.com/eventmanager/${eventid}`;
	
					await updateEventChannelIds();
	
				} else {
					await interaction.followUp({ content: "Sorry, you already have an eventlabs event not archived yet. Please archive that one before you start a new one", ephemeral: true });

				}



			} catch (error) {
				console.error(error);
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({ content: "Error, please try again later", ephemeral: true });
				} else {
					await interaction.reply({ content: "Error, please try again later", ephemeral: true });
				}
			}
	
		con.end();

		await interaction.followUp({ content: errors, ephemeral: true });

	} catch (error) {
		console.error(error);
		await interaction.reply({ content: "Error, please try again later", ephemeral: true });
		}	
	}
};
