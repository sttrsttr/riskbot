const { SlashCommandBuilder } = require('discord.js');
const { getEvent, finishEvent } = require('../modules/onevoneEventManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('finish')
        .setDescription('Host only: finish the active 1v1 event in this channel/thread'),

    async execute(interaction) {
        try {
            const channelId = interaction.channelId;
            const userId = interaction.user.id;
            const event = getEvent(channelId);

            if (!event) {
                await interaction.reply({ content: 'There is no active 1v1 event in this channel/thread.', flags: 64 });
                return;
            }

            if (event.hostId !== userId) {
                await interaction.reply({ content: 'Only the event host can use /finish.', flags: 64 });
                return;
            }

            finishEvent(channelId);
            await interaction.reply({ content: `Finished **${event.eventName}**.`, flags: 64 });
            await interaction.channel.send({ content: `1v1 event ${event.eventName} has been finished by <@${userId}>.` });
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Error finishing 1v1 event.', flags: 64 });
            } else {
                await interaction.reply({ content: 'Error finishing 1v1 event.', flags: 64 });
            }
        }
    }
};