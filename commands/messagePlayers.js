const { SlashCommandBuilder } = require('discord.js');
const { loadStorage } = require('../modules/eventStorage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('messageplayers')
        .setDescription('Send a message to all player threads in the event')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send to all player threads')
                .setRequired(true)
        ),
    async execute(interaction) {
        try {
            const message = interaction.options.getString('message');
            const channelId = interaction.channelId;

            // Load event storage
            const eventStorage = loadStorage();
            const eventData = eventStorage[channelId];

            if (!eventData || !eventData.playerThreads) {
                await interaction.reply({ content: 'No player threads found for this event.', ephemeral: true });
                return;
            }

            const playerThreadIds = Object.values(eventData.playerThreads);
            const guild = interaction.guild;

            for (const threadId of playerThreadIds) {
                const thread = await guild.channels.fetch(threadId);
                if (thread) {
                    await thread.send(message);
                }
            }

            await interaction.reply({ content: 'Message sent to all player threads.', ephemeral: true });
        } catch (error) {
            console.error('Error sending message to player threads:', error);
            await interaction.reply({ content: 'An error occurred while sending the message.', ephemeral: true });
        }
    }
};