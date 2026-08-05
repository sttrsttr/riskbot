const { SlashCommandBuilder } = require('discord.js');
const { startEvent, formatRoundLineup, getEvent, formatLabel, seedingLabel } = require('../modules/onevoneEventManager.js');
const { fetchSeedRanks } = require('../modules/onevoneSeeding.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('start')
        .setDescription('Host only: close signups and start 1v1 rounds'),

    async execute(interaction) {
        try {
            const channelId = interaction.channelId;
            const userId = interaction.user.id;
            const event = getEvent(channelId);

            if (!event) {
                await interaction.reply({ content: 'There is no active 1v1 event in this channel/thread.', flags: 64 });
                return;
            }

            let ranks = null;
            if (event.seeded) {
                // Looking up the leaderboard can outlast the 3 second interaction window.
                await interaction.deferReply({ flags: 64 });

                try {
                    ranks = await fetchSeedRanks([...event.signups]);
                } catch (error) {
                    console.error(error);
                    // Signups stay open so the host can simply run /start again.
                    await interaction.editReply({
                        content: 'Could not read the SABR 1v1 leaderboard, so the seeded bracket was not created. Signups are still open - try /start again.'
                    });
                    return;
                }
            }

            const result = startEvent(channelId, userId, ranks);
            const respond = content => (event.seeded
                ? interaction.editReply({ content })
                : interaction.reply({ content, flags: 64 }));

            if (!result.ok) {
                if (result.reason === 'not_host') {
                    await respond('Only the event host can use /start.');
                    return;
                }

                if (result.reason === 'already_started') {
                    await respond('This event has already started.');
                    return;
                }

                if (result.reason === 'not_enough_players') {
                    await respond('Need at least 2 players signed up before starting.');
                    return;
                }

                await respond('Could not start this 1v1 event.');
                return;
            }

            await respond(`Signups closed. Starting **${event.eventName}** (${formatLabel(event.format)}, ${seedingLabel(event.seeded)}) now.`);

            const lines = [];
            if (result.seeded) {
                lines.push(`Round 1 is seeded by SABR 1v1 ranking (${result.rankedCount} ranked, ${result.unrankedCount} unranked drawn last).`);
            }
            lines.push(formatRoundLineup(result.round));

            await interaction.channel.send({ content: lines.join('\n') });
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Error starting 1v1 event.', flags: 64 });
            } else {
                await interaction.reply({ content: 'Error starting 1v1 event.', flags: 64 });
            }
        }
    }
};
