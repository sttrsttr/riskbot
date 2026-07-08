// addAnonymousStaff.js
const { SlashCommandBuilder } = require('discord.js');
const { addUserToStaffThread } = require('../modules/eventManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addanonymousstaff')
        .setDescription('Add a user to the anonymous event staff thread')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to add as staff')
                .setRequired(true)
        ),
    async execute(interaction, client) {
        try {
            const user = interaction.options.getUser('user');
            const guild = await client.guilds.fetch(interaction.guild.id);
            // Get staff thread ID for this event channel
            const { getStaffThread } = require('../modules/eventStorage');
            const staffThreadId = getStaffThread(interaction.channelId);
            if (!staffThreadId) {
                await interaction.reply({ content: 'Staff thread not found for this event channel.', flags: 64 });
                return;
            }
            await addUserToStaffThread(client, guild.id, staffThreadId, user.id);
            await interaction.reply({ content: `Added <@${user.id}> to the staff thread.`, flags: 64 });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Error adding user to staff thread.', flags: 64 });
        }
    }
};
