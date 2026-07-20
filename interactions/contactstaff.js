const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = async (interaction) => {

	// Open a modal so the user can type what they need help with. The submit is
	// handled by interactions/contactstaffmodal.js (matched on the modal customId).
	const modal = new ModalBuilder()
		.setCustomId('contactstaffmodal')
		.setTitle('Contact event staff');

	const input = new TextInputBuilder()
		.setCustomId('staffmessage')
		.setLabel('What do you need help with?')
		.setPlaceholder('Note: your message will be visible to everyone in the help channel.')
		.setStyle(TextInputStyle.Paragraph)
		.setRequired(true)
		.setMaxLength(1000);

	modal.addComponents(new ActionRowBuilder().addComponents(input));

	await interaction.showModal(modal);

};
