// addAnonymousPlayer.js
const { SlashCommandBuilder } = require('discord.js');
const { addPlayerToEvent } = require('../modules/eventCommands');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addanonymousplayer')
        .setDescription('Add a user as a player to the anonymous event')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to add as player')
                .setRequired(true)
        ),
    async execute(interaction, client) {
        try {
            const user = interaction.options.getUser('user');
            const guild = await client.guilds.fetch(interaction.guild.id);
            const channelId = interaction.channelId;

            // Fetch correct staff thread ID for this event channel
            const { getStaffThread } = require('../modules/eventStorage');
            const staffThreadId = getStaffThread(channelId);

            await addPlayerToEvent(client, guild.id, channelId, user.id, staffThreadId);
            await interaction.reply({ content: `Added <@${user.id}> as a player to the event.`, ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Error adding user as player.', ephemeral: true });
        }
    }
};
