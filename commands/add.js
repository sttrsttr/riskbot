const { SlashCommandBuilder } = require('discord.js');
const { getEvent, joinEvent, buildJoinRow, JOIN_BUTTON_LABELS } = require('../modules/onevoneEventManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Host only: add a player to the 1v1 event')
        .addUserOption(option =>
            option
                .setName('player')
                .setDescription('The player to add')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {
            const channelId = interaction.channelId;
            const userId = interaction.user.id;
            const target = interaction.options.getUser('player', true);
            const event = getEvent(channelId);

            if (!event) {
                await interaction.reply({ content: 'There is no active 1v1 event in this channel/thread.', flags: 64 });
                return;
            }

            if (event.hostId !== userId) {
                await interaction.reply({ content: 'Only the event host can use /add.', flags: 64 });
                return;
            }

            const result = joinEvent(channelId, target.id);
            if (!result.ok) {
                if (result.reason === 'signup_closed') {
                    await interaction.reply({
                        content: 'Signups are closed and the bracket is already running, so players can no longer be added.',
                        flags: 64
                    });
                    return;
                }

                if (result.reason === 'already_joined') {
                    await interaction.reply({ content: `<@${target.id}> is already signed up for this event.`, flags: 64 });
                    return;
                }

                await interaction.reply({ content: 'Could not add that player to this 1v1 event.', flags: 64 });
                return;
            }

            await interaction.reply({
                content: `Added <@${target.id}> to **${event.eventName}**. Total signed up: ${result.count}.`,
                flags: 64
            });

            await interaction.channel.send({
                content: `<@${target.id}> was added to the 1v1 event by <@${userId}>. (${result.count} signed up)`,
                components: [buildJoinRow(JOIN_BUTTON_LABELS.alsoJoin)]
            });
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Error adding player to 1v1 event.', flags: 64 });
            } else {
                await interaction.reply({ content: 'Error adding player to 1v1 event.', flags: 64 });
            }
        }
    }
};
