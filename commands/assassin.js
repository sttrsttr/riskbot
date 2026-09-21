const { SlashCommandBuilder } = require('discord.js');
const { httpsPostRequest } = require('../modules/helperfunctions.js');

function discordName(member) {
	return member.displayName || member.user.globalName || member.user.username;
}

// Look up a users Friends of Risk profile by their Discord id.
// Returns the FoR name, or null if the user is not registered / the API failed.
async function getForName(member) {
	try {
		const options = {
			hostname: 'friendsofrisk.com',
			path: '/m2mapi/getuser',
			method: 'POST',
			headers: {
				'X-API-KEY': global.config.for_api_key
			}
		};

		const postData = JSON.stringify({ discordid: member.id });
		const response = JSON.parse(await httpsPostRequest(options, postData));

		if (response.status !== 'success' || !response.data || Array.isArray(response.data)) {
			// API returns "data": [] with "User not found" for unknown users
			return null;
		}

		return response.data.name ? String(response.data.name) : null;
	} catch (error) {
		console.error(`assassin: getuser failed for ${member.id}:`, error);
		return null;
	}
}

// Build the name shown to other players: FoR name first, Discord name in parentheses if it differs
function displayLabel(player) {
	if (player.forName && player.forName.toLowerCase() !== player.discordName.toLowerCase()) {
		return `${player.forName} (Discord: ${player.discordName})`;
	}
	return player.forName || player.discordName;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('assassin')
		.setDescription('Assign assassin target to specified users')
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
			.setRequired(true)
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
		,
		async execute(interaction) {

			// The API lookups can take a moment, so acknowledge the interaction right away
			await interaction.deferReply({ flags: 64 });

			const interactionUser = await interaction.guild.members.fetch(interaction.user.id);

			let errors = "Assasination assignment executed.";

			// Collect the unique members given as options
			const members = [];
			for (let n = 1; n <= 6; n++) {
				const member = interaction.options.getMember('user' + n);
				if (member && member.user && !members.some(m => m.id === member.id)) {
					members.push(member);
				}
			}

			// Fetch everyones Friends of Risk name in parallel
			const players = await Promise.all(members.map(async (member) => ({
				member: member,
				discordName: discordName(member),
				forName: await getForName(member),
			})));

			let dmtargets = "";
			for (const player of players) {
				dmtargets += displayLabel(player) + "\n";
				if (!player.forName) {
					errors += `\n${player.discordName} was not found on Friends of Risk, using their Discord name instead.`;
				}
			}

			await interaction.editReply({ content: "I am on it... I will send the players their targets in DM:\n" + dmtargets });

			if (players.length > 2) {

				// Assign targets as a single random cycle: shuffle the players and let each
				// player target the next one. Nobody gets themselves, everyone is targeted once.
				const order = players.map((_, index) => index);
				for (let i = order.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					[order[i], order[j]] = [order[j], order[i]];
				}

				for (let k = 0; k < order.length; k++) {
					const assassin = players[order[k]];
					const target = players[order[(k + 1) % order.length]];
					const targetname = displayLabel(target);

					await assassin.member.send(`I've been asked by ${interactionUser.displayName} to assign you a target for an upcoming Assassin game.\n\n Your target for the game will be **${targetname}**\n\nThe name shown is their Friends of Risk name. If their Discord name differs it is shown in parentheses.\n\nBest of luck!`)
						.catch(() => errors = errors + `\n${displayLabel(assassin)} does not accept DMs. Unable to tell them their target :(`);
					console.log(displayLabel(assassin) + " ==|;:;:;:;> " + targetname);
				}

			} else {
				errors = errors + '\n\nERROR: Not enough unique users identified, unable to assign targets to everyone';
			}

			await interaction.followUp({ content: errors, flags: 64 });
		}
};
