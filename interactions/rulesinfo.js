const { resolveEventForChannel } = require('../modules/helperfunctions.js');

module.exports = async (interaction) => {

	try {

		// Works for threads under the main channel and for dedicated event channels
		const event = await resolveEventForChannel(interaction.channel);

		if (event) {

			let message = `You can view information about the group on the Friends of Risk website\n\n[Event main Page](https://friendsofrisk.com/eventmanager/${event.id}/)\n[Settings](https://friendsofrisk.com/eventmanager/${event.id}/gamesettings/)\n[Current Standings](https://friendsofrisk.com/eventmanager/${event.id}/players/)\n[Rules](${event.ruleslink})\n`;

			await interaction.reply({ content: message, components: [], flags: 64 });

		} else {
			await interaction.reply({ content: "Error, please try again later", flags: 64 });
		}
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: "Error, please try again later", flags: 64 });
	}

};
