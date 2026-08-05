const { SlashCommandBuilder } = require('discord.js');
const { respondToJoinRequest } = require('../modules/onevoneEventManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Join the active 1v1 event in this channel/thread'),

    async execute(interaction) {
        try {
            await respondToJoinRequest(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Error joining 1v1 event.', flags: 64 });
            } else {
                await interaction.reply({ content: 'Error joining 1v1 event.', flags: 64 });
            }
        }
    }
};
