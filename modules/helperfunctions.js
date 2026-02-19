const https = require('https');

const { Client, Collection, Events, GatewayIntentBits, Partials, ChannelType, AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, GuildOnboardingPrompt } = require('discord.js');

function httpsPostRequest(options, postData) {
	return new Promise((resolve, reject) => {
		const req = https.request(options, (res) => {
			let data = '';
			res.on('data', chunk => data += chunk);
			res.on('end', () => resolve(data));
		});
		req.on('error', reject);
		req.write(postData);
		req.end();
	});
}

function httpsGetRequest(options) {
	return new Promise((resolve, reject) => {
		const req = https.request(options, (res) => {
			let data = '';
			res.on('data', chunk => data += chunk);
			res.on('end', () => resolve(data));
		});
		req.on('error', reject);
		req.end();
	});
}


// API functions
async function add_to_thread(client, serverid, channelid, threadid, userid) {
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
async function countMemes(client, serverid, channelid, startdate) {

	const guild = await client.guilds.fetch(serverid);
	if (!guild) {
		console.log('Guild not found');
		return;
	}

	const channel = await guild.channels.fetch(channelid);

	const START_DATE = new Date(startdate); // Change to your desired start date

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
async function emptyRole(client, serverid, roleid) {
	try {

		const guild = await client.guilds.fetch(serverid);
		if (!guild) {
			console.log('Guild not found');
			return;
		}
		const role = await guild.roles.fetch(roleid);
		if (!role) {
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


async function fetchRole(client, serverid, roleid) {
	try {
		const guild = await client.guilds.fetch(serverid);
		if (!guild) {
			console.log('Guild not found');
			return null;
		}

		const role = await guild.roles.fetch(roleid);
		if (!role) {
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
async function deleteRole(client, serverid, roleid) {
	try {

		const guild = await client.guilds.fetch(serverid);
		if (!guild) {
			console.log('Guild not found');
			return;
		}
		const role = await guild.roles.fetch(roleid);
		if (!role) {
			return;
		}
		await guild.roles.delete(role);

	} catch (error) {
		console.error(error.message);
	}
}


async function deleteChannel(client, serverid, channelid) {
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


async function deleteThread(client, serverid, channelid, threadid) {
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






async function removefromthread(client, server, channelid, threadid, userid) {
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
async function create_thread(client, tserver, tchannel, threadname, tusers, tstaffrole, tmessage) {

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
			console.error("Thread creation failed for group " + threadname);
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
async function createRole(client, tserver, trolename) {

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
async function message_thread(client, msgserver, msgchannel, msgthread, msg, tusers) {

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
async function message_channel(client, msgserver, msgchannel, msg) {

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



module.exports = {
	add_to_thread,
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
	message_channel,
	httpsPostRequest,
	httpsGetRequest
};