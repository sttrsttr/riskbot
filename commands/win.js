const { SlashCommandBuilder } = require('discord.js');
const { setWinner, getEvent, formatRoundLineup, finishEvent } = require('../modules/onevoneEventManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('win')
        .setDescription('Host only: report winner of a 1v1 match')
        .addUserOption(option =>
            option
                .setName('player')
                .setDescription('The player who won')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {
            const channelId = interaction.channelId;
            const userId = interaction.user.id;
            const winner = interaction.options.getUser('player', true);
            const event = getEvent(channelId);

            if (!event) {
                await interaction.reply({ content: 'There is no active 1v1 event in this channel/thread.', flags: 64 });
                return;
            }

            const result = setWinner(channelId, userId, winner.id);
            if (!result.ok) {
                if (result.reason === 'not_host') {
                    await interaction.reply({ content: 'Only the event host can use /win.', flags: 64 });
                    return;
                }

                if (result.reason === 'event_not_active') {
                    await interaction.reply({ content: 'This event is not currently in active rounds.', flags: 64 });
                    return;
                }

                if (result.reason === 'player_not_in_current_round') {
                    await interaction.reply({ content: 'That player is not in a currently editable match.', flags: 64 });
                    return;
                }

                await interaction.reply({ content: 'Could not record winner.', flags: 64 });
                return;
            }

            await interaction.reply({ content: `Recorded win for <@${winner.id}>.`, flags: 64 });

            if (result.correctedNextRound && result.eventFinished) {
                await interaction.channel.send({
                    content: `Updated previous round result for <@${winner.id}>. Event complete. Champion: <@${result.championId}>`
                });
                finishEvent(channelId);
                return;
            }

            if (result.correctedNextRound) {
                await interaction.channel.send({
                    content: `Updated previous round result for <@${winner.id}>. Next round lineup has been corrected:\n${formatRoundLineup(result.currentRound)}`
                });
                return;
            }

            if (!result.roundComplete) {
                await interaction.channel.send({ content: `<@${winner.id}> moves on.` });
                return;
            }

            if (result.eventFinished) {
                await interaction.channel.send({ content: `Event complete. Champion: <@${result.championId}>` });
                finishEvent(channelId);
                return;
            }

            await interaction.channel.send({
                content: `Round ${result.round.number} is complete.\n${formatRoundLineup(result.nextRound)}`
            });
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Error recording winner.', flags: 64 });
            } else {
                await interaction.reply({ content: 'Error recording winner.', flags: 64 });
            }
        }
    }
};