//////////////////////
// RISKBOT by eirik //
//////////////////////

// Set up local webserver for API requests from friendsofrisk website
const express = require('express');
const app = express();
const port = 3000;

// Set up NODE
import("dateformat");
const fs = require('node:fs');
const path = require('node:path');
const cron = require("node-cron");
const https = require('https');

// Set up Discord.js
const { Client, Collection, Events, GatewayIntentBits, Partials, ChannelType, AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, GuildOnboardingPrompt } = require('discord.js');

// Set up riskbot and modules
global.config = require('./riskbot_config.json');

/* Eventmanager tournament functions */
const {
	swap_users,
	eventmanagegroupstartingnow,
	eventmanager24hourping,
	eventmanager48hourping,
	eventmanagerwelcomethreads,
	eventmanagerlockthreads,
	lockThread,
	eventmanager1hourping,
	eventmanagerCheckinStart,
	eventmanagerCheckinStop,
	eventmanagerCheckinLateJoiners,
	eventmanagerUnscheduledPing,
	availabilityMessage,
	pingstaff,
	pingparticipants,
	updateEventChannelIds,
	updateSignupStatus,
	sendSignupMessage,
	eventmanagerunarchivecommandthreads,
	redirectCommandsMessage,
	getAllowedChannelIds,
	getChatChannelIds,
	getAnnouncementChannelsIds
} = require('./modules/signuphandler.js');

const { checkNewButNotSignedUp } = require('./modules/memberhandler.js');
const { createEventRoles, createEventChannel, getUserRoles } = require('./modules/eventCreation.js');
const { trackMessage, refreshActivityWatchlist } = require('./modules/activityTracker.js');
const { checkLiveStreams } = require('./modules/streamWatcher.js');
const { refreshtournamentcalendar } = require('./modules/eventsCalendar.js');
const { removeLoungeMember } = require('./modules/lounge_functions.js');

// Generic Riskbot helper functions
const { add_to_thread,
	countMemes,
	emptyRole,
	fetchRole,
	deleteRole,
	deleteChannel,
	deleteThread,
	removefromthread,
	create_thread,
	createRole,
	message_thread,
	message_channel
} = require('./modules/helperfunctions.js');

/* Special features for Math2Laws anonymous event thread thingy */
const { loadStorage } = require('./modules/eventStorage');
const { changeFakeName, getFakeName, playerThreadsWithListeners } = require('./modules/eventManager');
const { relayPlayerMessage, relayGameCode, relayKill } = require('./modules/eventRelay');

let allowedChannelIds = getAllowedChannelIds();
let chatChannelIds = getChatChannelIds();
let announcementChannelsIds = getAnnouncementChannelsIds();

// Spawn Discord client
const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions],
	partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Make client global for all modules/functions
global.client = client;

// Load commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Load interactions
const buttonHandlers = new Map();
const buttonsPath = path.join(__dirname, 'interactions');
fs.readdirSync(buttonsPath).forEach(file => {
	const customId = path.parse(file).name;
	const handler = require(path.join(buttonsPath, file));
	buttonHandlers.set(customId, handler);
});


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
	if (global.config.guilds.RISKDEV !== undefined) {
		message_channel(client, global.config.guilds.RISKDEV, '1292848598337323109', "I just got restarted, feeling great!");
	}

	eventmanager1hourping(client);
	eventmanagerCheckinStop(client);
	eventmanager48hourping(client);
	eventmanagerwelcomethreads(client);
	eventmanagerunarchivecommandthreads(client);
	eventmanagerUnscheduledPing(client);

	refreshActivityWatchlist();
	checkLiveStreams();

	//checkNewButNotSignedUp(client, global.config.guilds.MAIN);

	// Console log the current node and discord.js version
	console.log(`Logged in as ${client.user.tag}!`);
	console.log(`Node.js version: ${process.version}`);
	console.log(`discord.js version: ${require('discord.js').version}`);

});

// Eventmanger scheduled tasks
cron.schedule("0 */5 * * * *", function () {
	eventmanagerCheckinStart(client);
	eventmanagerCheckinStop(client);
	eventmanagerCheckinLateJoiners();
	eventmanager1hourping(client);
	eventmanager24hourping(client);
	eventmanager48hourping(client);
	eventmanagegroupstartingnow(client);
	eventmanagerlockthreads(client);
	eventmanagerwelcomethreads(client);
});

// Create a Discord event in MAIN when a game starts while one of its players is live on Twitch.
// Runs at :02, :07, ... so it lands after the website's 5-minute Twitch check.
cron.schedule("0 2-59/5 * * * *", function () {
	checkLiveStreams();
});

// Keep each active event's #commands / signup thread unarchived (surfaced) every 6 hours
cron.schedule("0 0 */6 * * *", function () {
	eventmanagerunarchivecommandthreads(client);
});

// Update calendar message every 12th hour
cron.schedule("0 0 */12 * * *", function () {
	refreshtournamentcalendar();
	eventmanagerUnscheduledPing(client);
});

// Scan for new members that hasnt signed up for any tournaments every day at 14:00
/*
cron.schedule("0 0 14 * * *", function () {
	checkNewButNotSignedUp(client, global.config.guilds.MAIN);
});
*/

// Function to remove all commands from all guilds
async function undeployCommands(client, guild = 0) {
	if (guild !== 0) {
		const guild2 = await client.guilds.fetch(guild);
		guild2.commands.set([]);
	} else {
		for (const guild in global.config.guilds) {
			console.log("Uninstalling all commands");
			const guild2 = await client.guilds.fetch(global.config.guilds[guild]);
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
	if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
		const handler = buttonHandlers.get(interaction.customId);
		if (handler) {
			try {
				await handler(interaction);
			} catch (error) {
				if (error.code === 'InteractionAlreadyReplied') {
					console.error('Interaction already replied:', error);
					// Optionally send a follow-up if needed
					if (!interaction.replied && !interaction.deferred) {
						await interaction.followUp({ content: 'This button was already handled.', flags: 64 });
					}
				} else {
					console.error('Error in button handler:', error);
					if (!interaction.replied && !interaction.deferred) {
						await interaction.reply({ content: 'There was an error handling this button.', flags: 64 });
					}
				}
			}
		} else {
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: 'Unknown button.', flags: 64 });
			}
		}
	} else {
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
				await interaction.followUp({ content: 'There was an error while executing this command!', flags: 64 });
			} else {
				await interaction.reply({ content: 'There was an error while executing this command!', flags: 64 });
			}
		}
	}
});

// Listen for messages
client.on('messageCreate', async (message) => {
	if (!message.author.bot && !message.system) {
		// Count the message for the website activity statistics before any of the
		// feature handling below, which is an if/else chain and would skip it.
		trackMessage(message);

		const contentorig = message.content.trim();
		const content = contentorig.toLowerCase();
		if (allowedChannelIds.includes(message.channel.id)) {
			// #commands / signup thread is a buttons-only panel; redirect chatter to #chat
			redirectCommandsMessage(message, client);
		} else if (announcementChannelsIds.includes(message.channel.id) && !content.includes('(noping)')) {
			pingparticipants(message, client);
		} else if (chatChannelIds.includes(message.channel.id) || chatChannelIds.includes(message.channel.parentId)) {
			if (content.includes('change my availability') || content.includes('update my availability') || content.includes('from my availability') || content.includes('in my availability') || content.includes('update availability') || content.includes('change availability') || content.includes('availability update') || content.includes('to my availability')) {
				availabilityMessage(message);
			} else if (content.includes('!staff')) {
				pingstaff(message, client);
			}
		} else if (playerThreadsWithListeners.has(message.channel.id)) {
			// Check if message is part of ongoing anonymous event threads
			const thread = message.channel;
			const mainChannelId = thread.parentId;

			let data = loadStorage();
			// Check if the mainChannelId already exists
			if (data[mainChannelId]) {
				config = data[mainChannelId];

				if (content.includes('@')) {
					await message.channel.send(`Messages with mentions are not allowed.`);
					return; // Ignore messages with mentions
				}

				const playerId = message.author.id;
				const fakeName = getFakeName(playerId) || 'Unknown';
				const player = await message.guild.members.fetch(playerId);
				const realName = player.displayName || player.user.username;
				config.playerThreads = new Map(Object.entries(config.playerThreads));

				// Handle !gamecode <code>
				if (contentorig.startsWith('!gamecode ')) {
					const code = contentorig.substring(10).trim();
					await relayGameCode(client, mainChannelId, config.playerThreads, code, thread.id);
					return;
				}


				// Handle !kill <fake player name>
				if (contentorig.startsWith('!kill ')) {
					const victimFakeName = contentorig.substring(6).trim();
					await relayKill(client, mainChannelId, config.playerThreads, config.staffThreadId, victimFakeName, fakeName, realName);
					return;
				}

				// Handle !name <new name>
				if (contentorig.startsWith('!name ')) {
					const newName = contentorig.substring(6).trim();
					const nameRegex = /^[a-zA-Z0-9 ]+$/; // Allow only a-z, 0-9, and spaces
					if (!nameRegex.test(newName)) {
						await message.channel.send('Invalid name. Only letters, numbers, and spaces are allowed.');
						return;
					}
					await changeFakeName(playerId, newName, config.staffThreadId, message.guild);
					await message.channel.send(`Your name has been changed to: ${newName}`);
					return;
				}

				// Ignore commands (messages starting with '!') when relaying to the main channel
				if (contentorig.startsWith('!')) return;


				// Relay all messages to main channel with fake name
				try {
					// Relay all messages to main channel with fake name
					await relayPlayerMessage(client, config.guildId, mainChannelId, playerId, contentorig);
				} catch (error) {
					console.error("Error while relaying message:", error);
				}

			}



		}
	}
});



// Function to log any command run
async function logcommand(interaction) {

	try {

		// Store the message ID via API
		const options = {
			hostname: 'friendsofrisk.com',
			path: '/m2mapi/logCommand',
			method: 'POST',
			headers: {
				'X-API-KEY': global.config.for_api_key
			}
		};

		const postData = JSON.stringify({
			command: interaction.commandName,
			serverid: interaction.guild.id,
			userid: interaction.user.id
		});

		const req = https.request(options, (res) => { });
		req.write(postData);
		req.end();

	} catch (error) {
		// Handle errors
		console.error("Error:", error);
	}

};

client.login(global.config.token);





///////////////////////////////
//                           //
// LOCAL WEBSERVER GOES HERE //
//                           //
///////////////////////////////

// Middleware to parse JSON bodies
app.use(express.json());

// Middleware to parse URL-encoded bodies (for form submissions)
app.use(express.urlencoded({ extended: true }));

// API Endpoint for messaging
app.post('/api/updateeventchannelIds', async (req, res) => {
	await updateEventChannelIds();
	allowedChannelIds = getAllowedChannelIds();
	chatChannelIds = getChatChannelIds();
	announcementChannelsIds = getAnnouncementChannelsIds();
	res.header("Content-Type", 'application/json');
	res.send(JSON.stringify('success', null, 4));
})

// API Endpoint for counting meme scores
app.post('/api/countmemes', async (req, res) => {
	try {
		let post = req.body;
		let output = await countMemes(client, post.serverid, post.channelid, post.startdate);
		res.header("Content-Type", 'application/json');
		res.send(JSON.stringify(output, null, 4));
	} catch (error) {
		console.error('Error in counting memes:', error);
		res.status(500).send({ error: "An error occurred during counting memes" });
	}
});

// API Endpoint for deleting a role
app.post('/api/emptyrole', async (req, res) => {
	console.error('Error, function not allowed due to member intent missing');
	res.status(500).send({ error: "Not allowed to empty role due to missing member intent" });
});

// API Endpoint for deleting a role
app.post('/api/fetchrole', async (req, res) => {
	try {
		let post = req.body;
		let output = await fetchRole(client, post.serverid, post.roleid);;
		res.header("Content-Type", 'application/json');
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
		let output = await deleteRole(client, post.serverid, post.roleid);;
		res.header("Content-Type", 'application/json');
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
		let output = await createRole(client, post.serverid, post.rolename);;
		res.header("Content-Type", 'application/json');
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
		let output = await deleteChannel(client, post.serverid, post.channelid);;
		res.header("Content-Type", 'application/json');
		res.send(JSON.stringify(output, null, 4));
	} catch (error) {
		console.error('Error in thread creation:', error);
		res.status(500).send({ error: "An error occurred during thread creation" });
	}
});


// API Endpoint for deleting a deleteloungegame
app.post('/api/deleteloungegame', async (req, res) => {
	try {
		let post = req.body;

		if (post.serverid === undefined || post.channelid === undefined || post.threadid === undefined || post.joinmessageid === undefined) {
			throw new Error('Missing required parameters');
		}

		let output = await deleteThread(client, post.serverid, post.channelid, post.threadid);;

		const channel = await client.channels.fetch(post.channelid);
		if (!channel) throw new Error('Channel not found');
		const message = await channel.messages.fetch(post.joinmessageid);
		if (!message) throw new Error('Message not found');
		await message.delete();

		res.header("Content-Type", 'application/json');
		res.send(JSON.stringify(output, null, 4));
	} catch (error) {
		console.error('Error in thread closing:', error);
		res.status(500).send({ error: "An error occurred during thread deletion" });
	}
});

// API Endpoint for deleting a thread
app.post('/api/deletethread', async (req, res) => {
	try {
		let post = req.body;
		let output = await deleteThread(client, post.serverid, post.channelid, post.threadid);;
		res.header("Content-Type", 'application/json');
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
		res.header("Content-Type", 'application/json');
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
		let output = await message_channel(client, post.server, post.channel, post.message);
		res.header("Content-Type", 'application/json');
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
		res.header("Content-Type", 'application/json');
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
		res.header("Content-Type", 'application/json');
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
		let output = await create_thread(client, post.server, post.channel, post.threadname, post.users, post.staffrole, post.message);
		res.header("Content-Type", 'application/json');
		res.send(JSON.stringify(output, null, 4));
	} catch (error) {
		console.error('Error in thread creation:', error);
		res.status(500).send({ error: "An error occurred during thread creation" });
	}

});

// API Endpoint for messaging a thread
// Optional body fields: ping (default true) - mention the users, embed (default true) - wrap
// the message in an embed instead of plain text, title - custom title for the embed
app.post('/api/messagethread', async (req, res) => {
	try {
		let post = req.body;
		let output = await message_thread(client, post.server, post.channel, post.thread, post.message, post.users, { ping: post.ping, embed: post.embed, title: post.title });
		res.header("Content-Type", 'application/json');
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
		let output = await add_to_thread(client, post.serverid, post.channelid, post.threadid, post.userid);
		res.header("Content-Type", 'application/json');
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
		let output = await removefromthread(client, post.serverid, post.channelid, post.threadid, post.userid);
		res.header("Content-Type", 'application/json');
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
		res.header("Content-Type", 'application/json');
		res.send(JSON.stringify(output, null, 4));
	} catch (error) {
		console.error('Error in thread creation:', error);
		res.status(500).send({ error: "An error occurred during thread creation" });
	}

})

// Helper for the event API endpoints: returns the names of required fields missing from the body
function missingParams(body, required) {
	return required.filter(name => body[name] === undefined || body[name] === '');
}

// API Endpoint for creating the standard event roles (staff, participant, waitlist, noshow)
app.post('/api/createeventroles', async (req, res) => {
	try {
		let post = req.body;
		const missing = missingParams(post, ['serverid', 'eventid']);
		if (missing.length > 0) {
			console.error('createeventroles missing parameters:', missing, '- received keys:', Object.keys(post));
			return res.status(400).send({ error: "Missing required parameters: " + missing.join(', '), received: Object.keys(post) });
		}
		let output = await createEventRoles(client, post.serverid, post.eventid, post.ownerid);
		res.header("Content-Type", 'application/json');
		res.send(JSON.stringify(output, null, 4));
	} catch (error) {
		console.error('Error in event role creation:', error);
		res.status(500).send({ error: "An error occurred during event role creation" });
	}
});

// API Endpoint for creating the event channel with its public threads, staff thread and signup/welcome messages
app.post('/api/createeventchannel', async (req, res) => {
	try {
		let post = req.body;
		const missing = missingParams(post, ['serverid', 'eventid', 'eventname', 'staffroleid']);
		if (missing.length > 0) {
			console.error('createeventchannel missing parameters:', missing, '- received keys:', Object.keys(post));
			return res.status(400).send({ error: "Missing required parameters: " + missing.join(', '), received: Object.keys(post) });
		}
		let output = await createEventChannel(client, post.serverid, post.eventid, post.eventname, post.ownerid, post.staffroleid, post.categoryid);
		res.header("Content-Type", 'application/json');
		res.send(JSON.stringify(output, null, 4));
	} catch (error) {
		console.error('Error in event channel creation:', error);
		res.status(500).send({ error: "An error occurred during event channel creation" });
	}
});

// API Endpoint for checking which roles a specific user has
app.post('/api/getuserroles', async (req, res) => {
	try {
		let post = req.body;
		const missing = missingParams(post, ['serverid', 'userid']);
		if (missing.length > 0) {
			console.error('getuserroles missing parameters:', missing, '- received keys:', Object.keys(post));
			return res.status(400).send({ error: "Missing required parameters: " + missing.join(', '), received: Object.keys(post) });
		}
		let output = await getUserRoles(client, post.serverid, post.userid);
		res.header("Content-Type", 'application/json');
		res.send(JSON.stringify(output, null, 4));
	} catch (error) {
		console.error('Error in fetching user roles:', error);
		res.status(500).send({ error: "An error occurred during fetching user roles" });
	}
});

// API Endpoint for updating the signup status of an event
app.post('/api/updatesignupstatus', async (req, res) => {
	try {
		let post = req.body;
		let output = await updateSignupStatus(client, post.eventid, post.status);
		res.header("Content-Type", 'application/json');
		res.send(JSON.stringify(output, null, 4));
	} catch (error) {
		console.error('Error in updating signup status:', error);
		res.status(500).send({ error: "An error occurred during signup status update" });
	}
})

// API Endpoint for posting a fresh commands/self-service message (signup buttons) into the
// event's signup thread - used by the website after the signup channel id was repointed.
// Returns { signupmessageid } which the website stores on the event.
app.post('/api/sendsignupmessage', async (req, res) => {
	try {
		let post = req.body;
		const missing = missingParams(post, ['eventid']);
		if (missing.length > 0) {
			console.error('sendsignupmessage missing parameters:', missing, '- received keys:', Object.keys(post));
			return res.status(400).send({ error: "Missing required parameters: " + missing.join(', '), received: Object.keys(post) });
		}
		let output = await sendSignupMessage(client, post.eventid);
		res.header("Content-Type", 'application/json');
		res.send(JSON.stringify(output, null, 4));
	} catch (error) {
		console.error('Error in sending signup message:', error);
		res.status(500).send({ error: "An error occurred while sending the signup message" });
	}
});

app.listen(port, () => {
	console.log(`Riskbot API listening on port localhost:${port}`)
})

