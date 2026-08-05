const { SlashCommandBuilder } = require('discord.js');
const {
    createEvent,
    EVENT_FORMATS,
    JOIN_BUTTON_LABELS,
    formatLabel,
    seedingLabel,
    buildJoinRow
} = require('../modules/onevoneEventManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('start-1v1-event')
        .setDescription('Create a new 1v1 event in this channel/thread')
        .addStringOption(option =>
            option
                .setName('name')
                .setDescription('Name of the 1v1 event')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('format')
                .setDescription('Bracket format')
                .setRequired(true)
                .addChoices(
                    { name: 'Single elimination', value: EVENT_FORMATS.SINGLE },
                    { name: 'Double elimination', value: EVENT_FORMATS.DOUBLE }
                )
        )
        .addStringOption(option =>
            option
                .setName('seeding')
                .setDescription('Seed round 1 from the SABR 1v1 leaderboard?')
                .setRequired(true)
                .addChoices(
                    { name: 'Yes - seed by SABR 1v1 ranking', value: 'yes' },
                    { name: 'No - random draw', value: 'no' }
                )
        ),

    async execute(interaction) {
        try {
            const eventName = interaction.options.getString('name').trim();
            const format = interaction.options.getString('format', true);
            const seeded = interaction.options.getString('seeding', true) === 'yes';
            const channelId = interaction.channelId;
            const hostId = interaction.user.id;

            const created = createEvent(channelId, hostId, eventName, format, seeded);
            if (!created.ok) {
                if (created.reason === 'invalid_format') {
                    await interaction.reply({
                        content: 'Unknown format. Pick single or double elimination.',
                        flags: 64
                    });
                    return;
                }

                await interaction.reply({
                    content: 'A 1v1 event is already running in this channel/thread. Finish it before creating a new one.',
                    flags: 64
                });
                return;
            }

            const eventDetails = `${formatLabel(format)}, ${seedingLabel(seeded)}`;

            await interaction.reply({
                content: [
                    `You are now hosting **${eventName}** (${eventDetails}) in this channel.`,
                    'Available commands:',
                    '- `/add <player>` to add a player manually during signups',
                    '- `/start` to close signups and generate Round 1',
                    '- `/finish` to end the event at any time',
                    '- `/win <player>` to report a match winner'
                ].join('\n'),
                flags: 64
            });

            await interaction.channel.send({
                content: `1v1 event ${eventName} (${eventDetails}) is now started by <@${hostId}>. Click the button below or use /join to play.`,
                components: [buildJoinRow(JOIN_BUTTON_LABELS.signup)]
            });
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Error creating 1v1 event.', flags: 64 });
            } else {
                await interaction.reply({ content: 'Error creating 1v1 event.', flags: 64 });
            }
        }
    }
};