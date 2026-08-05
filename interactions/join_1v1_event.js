const { respondToJoinRequest } = require('../modules/onevoneEventManager.js');

module.exports = async (interaction) => {

	try {

		await respondToJoinRequest(interaction);

	} catch (error) {
		console.error(error);
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({ content: 'Error joining 1v1 event.', flags: 64 });
		}
	}

};
