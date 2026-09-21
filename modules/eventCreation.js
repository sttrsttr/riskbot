// Event creation functions for the website API
// Mirrors the Discord-side work of /create-event and /eventlabs-create.
// Database writes are done by the caller (website) using the ids returned here.

const { ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');


// Creates the four standard event roles and optionally assigns the staff role to the event owner.
// Returns the role ids so the caller can store them on the event.
async function createEventRoles(client, serverid, eventid, ownerid) {

	const guild = await client.guilds.fetch(serverid);
	if (!guild) {
		console.log('Guild not found');
		return null;
	}

	const botMember = guild.members.me;
	if (!botMember || !botMember.permissions.has('ManageRoles')) {
		return { error: "Bot is missing the ManageRoles permission in this server" };
	}

	const noshowRole = await guild.roles.create({
		name: "E" + eventid + "-noshow-bracket1",
		reason: 'Role created for those noshowing',
		mentionable: false
	});

	const staffRole = await guild.roles.create({
		name: "E" + eventid + "-staff",
		reason: 'Role created to be event staff',
		mentionable: false
	});

	const participantRole = await guild.roles.create({
		name: "E" + eventid + "-participant",
		reason: 'Role created to be event participant',
		mentionable: false
	});

	const waitlistRole = await guild.roles.create({
		name: "E" + eventid + "-waitlist",
		reason: 'Role created for waitlist players in event',
		mentionable: false
	});

	// Give the event owner the staff role right away
	if (ownerid) {
		try {
			const owner = await guild.members.fetch(ownerid);
			await owner.roles.add(staffRole);
		} catch (error) {
			if (error.code !== 10007) throw error; // 10007 = Unknown Member, owner not in server
		}
	}

	return {
		staffroleid: staffRole.id,
		participantroleid: participantRole.id,
		waitlistroleid: waitlistRole.id,
		noshowroleid: noshowRole.id
	};

}


// Creates the event channel with the standard permission setup, the three public threads
// (commands, chat, help), the private staff thread, the signup message with buttons and
// the pinned welcome message. Pass categoryid to place the channel under a category
// (eventlabs style, which also puts the event id in the channel name).
// Returns all channel/thread/message ids so the caller can store them on the event.
async function createEventChannel(client, serverid, eventid, eventname, ownerid, staffroleid, categoryid) {

	const guild = await client.guilds.fetch(serverid);
	if (!guild) {
		console.log('Guild not found');
		return null;
	}

	const botMember = guild.members.me;
	if (!botMember) {
		console.log('Bot is not a member of the guild');
		return null;
	}

	const cleanname = String(eventname).replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50);

	let channelname = cleanname;
	let category = null;
	if (categoryid) {
		category = await guild.channels.fetch(categoryid);
		if (!category || category.type !== ChannelType.GuildCategory) {
			return { error: "Category not found or not a category" };
		}
		channelname = "📢 " + cleanname + "-(E" + eventid + ")";
	}

	const staffPermissions = [
		PermissionsBitField.Flags.ViewChannel,
		PermissionsBitField.Flags.EmbedLinks,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.PinMessages,
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ManageChannels,
		PermissionsBitField.Flags.ManageMessages,
		PermissionsBitField.Flags.ManageThreads,
		PermissionsBitField.Flags.MentionEveryone,
		PermissionsBitField.Flags.AttachFiles,
		PermissionsBitField.Flags.AddReactions
	];

	const permissionOverwrites = [
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
			id: botMember.roles.botRole.id,
			allow: staffPermissions
		},
		{
			id: staffroleid,
			allow: staffPermissions
		}
	];

	if (ownerid) {
		permissionOverwrites.push({
			id: ownerid,
			allow: staffPermissions
		});
	}

	const channel = await guild.channels.create({
		name: channelname,
		type: ChannelType.GuildText,
		parent: category ? category.id : null,
		permissionOverwrites: permissionOverwrites,
		defaultAutoArchiveDuration: 10080,
		reason: 'Event channel'
	});

	const signupchannel = await channel.threads.create({
		name: "📝 commands",
		type: ChannelType.PublicThread,
		autoArchiveDuration: 10080,
	});

	const textchannel = await channel.threads.create({
		name: "🗣️ chat",
		type: ChannelType.PublicThread,
		autoArchiveDuration: 10080,
	});

	const helpchannel = await channel.threads.create({
		name: "👋 help",
		type: ChannelType.PublicThread,
		autoArchiveDuration: 10080,
	});

	const staffchannel = await channel.threads.create({
		name: "🛂 staff",
		type: ChannelType.PrivateThread,
		autoArchiveDuration: 10080,
	});

	await staffchannel.members.add(botMember.id);
	if (ownerid) {
		try {
			await staffchannel.members.add(ownerid);
		} catch (error) {
			if (error.code !== 10007) throw error; // owner not in server
		}
	}

	await staffchannel.send(`This will be your staff thread, where only event staff will have access`);

	const availability = new ButtonBuilder()
		.setCustomId('availability')
		.setLabel('Set up your availability')
		.setStyle(ButtonStyle.Primary);

	const rules = new ButtonBuilder()
		.setCustomId('rulesinfo')
		.setLabel('Rules and info')
		.setStyle(ButtonStyle.Primary);

	const contactstaff = new ButtonBuilder()
		.setCustomId('contactstaff')
		.setLabel('Contact staff')
		.setStyle(ButtonStyle.Danger);

	const row = new ActionRowBuilder()
		.addComponents(availability, rules, contactstaff);

	const signupmessage = await signupchannel.send({ content: `# Self service channel\n\nPlease use the buttons below to interact with this event.\n\n## Signup status: CLOSED`, components: [row] });

	let welcomemsg = await channel.send(`Welcome to ${cleanname}\n\nYou will find any announcements regarding this event in here.\n\nEvent webpage (rules, signups, groups, standings, rounds, settings will be published here): https://friendsofrisk.com/eventmanager/${eventid}\n\nSignup: https://discord.com/channels/${guild.id}/${signupchannel.id}\nChat: https://discord.com/channels/${guild.id}/${textchannel.id}\nHelp thread: https://discord.com/channels/${guild.id}/${helpchannel.id}\n\nGood luck!`);
	await welcomemsg.pin();

	return {
		mainchannelid: channel.id,
		signupchannelid: signupchannel.id,
		textchannelid: textchannel.id,
		helpchannelid: helpchannel.id,
		staffchannelid: staffchannel.id,
		signupmessageid: signupmessage.id
	};

}


// Returns the roles a specific user has in a server
async function getUserRoles(client, serverid, userid) {

	const guild = await client.guilds.fetch(serverid);
	if (!guild) {
		console.log('Guild not found');
		return null;
	}

	let member;
	try {
		member = await guild.members.fetch(userid);
	} catch (error) {
		// 10007: Unknown Member (user exists but is not in this server)
		// 10013: Unknown User (no Discord user with this id at all)
		if (error.code === 10007 || error.code === 10013) {
			return { userid: userid, found: false, roles: [] };
		}
		throw error;
	}

	const roles = member.roles.cache
		.filter(role => role.id !== guild.id) // skip @everyone
		.map(role => ({ id: role.id, name: role.name }));

	return { userid: userid, found: true, roles: roles };

}


module.exports = {
	createEventRoles,
	createEventChannel,
	getUserRoles
};
