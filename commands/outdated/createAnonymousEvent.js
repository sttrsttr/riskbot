// createAnonymousEvent.js
const { SlashCommandBuilder, ChannelType, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create-anonymous-event')
        .setDescription('Create an anonymous event with a private main channel')
        .addStringOption(option =>
            option.setName('eventname')
                .setDescription('Name of the anonymous event')
                .setRequired(true)
        ),
    async execute(interaction, client) {
        try {
            await interaction.reply({ content: 'Creating anonymous event channel...', flags: 64 });
            const guild = await client.guilds.fetch(interaction.guild.id);
            const eventName = interaction.options.getString('eventname').replace(/[^a-zA-Z0-9-_ ]/g, '').substring(0, 50);
            const botMember = guild.members.me;
            if (!botMember.permissions.has('ManageChannels')) {
                await interaction.followUp({ content: `Sorry, I don't have permission to manage channels.`, flags: 64 });
                return;
            }
            // Create private main channel
            // Restrict slash commands to the creator of the event by limiting permissions
            const channel = await guild.channels.create({
                name: eventName,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionsBitField.Flags.SendMessages],
                        allow: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: botMember.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels],
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionsBitField.Flags.UseApplicationCommands, PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.SendMessages],
                    },
                    {
                        id: guild.roles.everyone,
                        deny: [PermissionsBitField.Flags.UseApplicationCommands],
                    }
                ],
                reason: 'Anonymous event main channel',
            });

            const welcomeMessage = '## **Welcome to this anonymous event**\n\n' +
                'Add staff to your event with `/addanonymousstaff <user>`\n' +
                'Add players to your event with `/addanonymousplayer <user>`\n\n' +
                'Message all players with `/messageplayers <message>`\n\n' +
                '**Player commands available (must post inside their threads):**\n' +
                '`!name <new fake name>`\n' +
                '`!kill <who they killed>`\n' +
                '`!gamecode <ingame game code>`\n\n' +
                'Any messages sent by other players in their private threads will be relayed into this channel as well as kills.\n' +
                'Name changes and kills are also logged into the private staff thread.\n\n' +
                'Good luck and have fun!';

            // Post the welcome message
            await channel.send(welcomeMessage);

            // Create private staff thread inside the event channel
            const staffThread = await channel.threads.create({
                name: 'staff',
                type: ChannelType.PrivateThread,
                autoArchiveDuration: 10080,
            });
            await staffThread.send(`Staff thread created for this event.`);

            console.log(`Staff thread created with ID: ${staffThread.id}`);

            // Store staff thread ID for this event channel
            const { setStaffThread } = require('../modules/eventStorage');
            console.log(`Calling setStaffThread with guildId: ${guild.id}, mainChannelId: ${channel.id}, staffThreadId: ${staffThread.id}`);
            setStaffThread(guild.id, channel.id, staffThread.id);

            // Add the interaction user to the staff thread
            const { addUserToStaffThread } = require('../modules/eventManager');
            const addResult = await addUserToStaffThread(client, guild.id, staffThread.id, interaction.user.id);
            if (addResult === 'SUCCESS') {
                await staffThread.send(`${interaction.user.tag} has been added to the staff thread.`);
            } else {
                console.warn(`Failed to add ${interaction.user.tag} to the staff thread.`);
            }
            await interaction.followUp({ content: `Anonymous event channel created: <#${channel.id}>\nStaff thread created: <#${staffThread.id}>`, flags: 64 });
        } catch (error) {
            console.error(error);
            await interaction.followUp({ content: 'Error creating event channel.', flags: 64 });
        }
    }
};
