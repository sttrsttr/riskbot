const { MessageFlags } = require('discord.js');

function consoleLog(message) {
	const now = new Date();
	const isoString = now.toISOString();
	console.log(`${isoString}: ${message}`);
}

async function interactionReply(interaction, content, flags = undefined, options = {}) {
	//consoleLog(`Replying to interaction with content: ${content}`);
	if (flags === undefined) {
		flags = MessageFlags.Ephemeral
	}
	let args = {
		content: content,
		flags: flags,
		...options
	}
	if (interaction.deferred) {
		await interaction.followUp(args);
	} else {
		await interaction.reply(args);
	}
}

async function runImposterGame(interaction, { forcedImposterId1, forcedImposterId2 } = {}) {
	const author = interaction.user;
	//consoleLog(`Imposter command invoked by ${author.username} in guild ${interaction.guildId}`);
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	const host = interaction.options.getUser("host");
	const allowDev = global.config.imposter?.allowDev ?? [];
	const disallowDev = !allowDev.includes(author.id);
	const imposterCount = interaction.options.getInteger("imposters") ?? 2;

	if (forcedImposterId2 && !forcedImposterId1) {
		await interactionReply(interaction, `You must specify imposter1 before imposter2.`);
		return;
	}
	if (forcedImposterId1 && forcedImposterId2 && imposterCount === 1) {
		await interactionReply(interaction, `You cannot specify two imposters when imposters is set to 1.`);
		return;
	}
	if (forcedImposterId1 && forcedImposterId2 && forcedImposterId1 === forcedImposterId2 && disallowDev) {
		await interactionReply(interaction, `You cannot specify the same user as both imposters.`);
		return;
	}

	let users = [];
	let userIds = [];
	for (let i = 1; i <= 6; i++) {
		const user = interaction.options.getUser(`user${i}`);
		if (null === user) {
			continue;
		}
		if (user.bot && disallowDev) {
			await interactionReply(interaction, `You cannot specify a bot as a player!`);
			return;
		}
		if (host && user.id === host.id && disallowDev) {
			await interactionReply(interaction, `You cannot specify the host as a player!`);
			return;
		}
		if (userIds.includes(user.id) && disallowDev) {
			await interactionReply(interaction, `You cannot specify the same user multiple times!`);
			return;
		}
		users.push(user);
		userIds.push(user.id);
	}
	if (users.length <= imposterCount) {
		await interactionReply(interaction, `Not enough unique users identified, unable to assign imposters`);
		return;
	}
	if (forcedImposterId1 && !userIds.includes(forcedImposterId1)) {
		await interactionReply(interaction, `imposter1 must be one of the specified players.`);
		return;
	}
	if (forcedImposterId2 && !userIds.includes(forcedImposterId2)) {
		await interactionReply(interaction, `imposter2 must be one of the specified players.`);
		return;
	}

	const userCount = users.length;
	const imposter1 = forcedImposterId1 ? userIds.indexOf(forcedImposterId1) : Math.floor(Math.random() * users.length);
	let imposter2;
	if (imposterCount === 2) {
		if (forcedImposterId2) {
			// A dev's roster can contain the same real account in multiple player slots (disallowDev
			// bypasses the duplicate-player check). indexOf alone would resolve imposter1 and imposter2
			// to the same slot whenever they share a Discord ID, so skip past imposter1's slot to find a
			// distinct occurrence of that ID.
			imposter2 = userIds.indexOf(forcedImposterId2);
			while (imposter2 === imposter1) {
				imposter2 = userIds.indexOf(forcedImposterId2, imposter2 + 1);
			}
			if (imposter2 === -1) {
				await interactionReply(interaction, `imposter1 and imposter2 must be different player slots.`);
				return;
			}
		} else {
			do {
				imposter2 = Math.floor(Math.random() * users.length);
			} while (imposter1 === imposter2);
		}
	}
	const isSolo = imposter2 === undefined;
	const forcedIndices = new Set();
	if (forcedImposterId1) forcedIndices.add(imposter1);
	if (forcedImposterId2) forcedIndices.add(imposter2);
	let userSettings = [];
	for (let i = 0; i < users.length; i++) {
		let isImposter = i === imposter1 || i === imposter2;
		userSettings.push({
			user: users[i],
			role: isImposter ? "Imposter" : "Crewmate",
			isImposter: isImposter,
			wasChosen: isImposter && forcedIndices.has(i)
		});
	}
	const hostString = host ? `${host.username}` : "No host";
	if (host) {
		let fields = [
			{
				name: "Game Creator",
				value: `${author.username}`,
				inline: true,
			},
			{
				name: "Host",
				value: hostString,
				inline: true,
			},
			{
				name: "Player Count",
				value: `${userCount}`,
				inline: true,
			},
			{
				name: "Imposter Count",
				value: `${imposterCount}`,
				inline: true,
			}
		];
		let fields2 = [];
		for (let i = 0; i < users.length; i++) {
			const user = users[i];
			const userSetting = userSettings[i];
			fields2.push({
				name: `${user.username}`,
				value: userSetting.wasChosen ? `${userSetting.role} (chosen by ${author.username})` : userSetting.role,
				inline: true,
			});
		}
		let embeds = [
			{
				title: `Rigged Caps Game`,
				description: `You are the host for this game.`,
				fields: fields,
				timestamp: new Date().toISOString(),
			},
			{
				title: `Players`,
				fields: fields2,
			},
		];
		try {
			await host.send({
				content: "Rigged Caps Game Started.",
				embeds: embeds,
			});
		} catch (err) {
			const responseMessage = err.code === 50007 ?
				`Could not send DM to host! Host must enable DMs from server members and try again.` :
				`Error sending DM to host! ${err.message}`;
			//consoleLog(responseMessage);
			await interactionReply(interaction, responseMessage);
			return;
		}
	}
	for (let i = 0; i < users.length; i++) {
		const user = users[i];
		const userSetting = userSettings[i];
		let fields = [
			{
				name: "Game Creator",
				value: `${author.username}`,
				inline: true,
			},
			{
				name: "Host",
				value: hostString,
				inline: true,
			},
			{
				name: "Role",
				value: userSetting.role,
				inline: true,
			},
		];
		if (userSetting.isImposter && !isSolo) {
			const teamMate = i === imposter1 ? users[imposter2] : users[imposter1];
			fields.push({
				name: "Teammate",
				value: `${teamMate.username}`,
				inline: true,
			});
		}
		let embed = {
			title: `Rigged Caps Game`,
			description: `You have been assigned a role of **${userSetting.role}**.`,
			fields: fields,
			timestamp: new Date().toISOString(),
		};
		try {
			await user.send({
				content: "Rigged Caps Game Started.",
				embeds: [embed],
			});
		} catch (err) {
			const errorRecipient = host ? host : interaction.user;
			const responseMessage = err.code === 50007 ?
				`Could not send DM to ${user.username}! They must enable DMs from server members and try again.` :
				`Error sending DM to ${user.username}! ${err.message}`;
			//consoleLog(responseMessage);
			try {
				await errorRecipient.send(responseMessage);
			} catch (err2) {
				//consoleLog(`Also could not send error message to host/author. ${err2.message}`);
				interactionReply(interaction, `Error sending DM to ${user.username}, and could not notify the host/author!\n${err.message}\n${err2.message}`);
				return;
			}
		}
	}
	await interactionReply(interaction, `The Rigged Caps game has been started!`);
}

module.exports = { runImposterGame, interactionReply, consoleLog };
