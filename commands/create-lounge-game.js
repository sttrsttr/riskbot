// createAnonymousEvent.js
const { SlashCommandBuilder, ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, AttachmentBuilder, EmbedBuilder, ButtonStyle } = require('discord.js');
const { addLoungeMember } = require('../modules/lounge_functions.js');
const { httpsPostRequest, httpsGetRequest } = require('../modules/helperfunctions.js');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('create-lounge-game')
        .setDescription('Create an lounge game lobby')
        .addIntegerOption(option =>
            option.setName('player_count')
                .setDescription('Number of players for the lounge game')
                .setRequired(true)
                .addChoices(
                    { name: '4 players', value: 4 },
                    { name: '5 players', value: 5 },
                    { name: '6 players', value: 6 },
                )
        )
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of lounge game')
                .setRequired(true)
                .addChoices(
                    { name: 'Competitive', value: 'Competitive' },
                    { name: 'Relaxed', value: 'Relaxed' },
                )
        )
        .addIntegerOption(option =>
            option.setName('min_elo_limit')
                .setDescription('Minimum ELO requirement (default 0)')
                .setRequired(false)
                .addChoices(
                    { name: '0', value: 0 },
                    { name: '950', value: 950 },
                    { name: '1000', value: 1000 },
                    { name: '1001', value: 1001 },
                    { name: '1050', value: 1050 },
                    { name: '1100', value: 1100 },
                    { name: '1150', value: 1150 },
                    { name: '1200', value: 1200 },
                )
        )

    ,
    async execute(interaction, client) {
        try {
            await interaction.reply({ content: 'Alright, setting it up for you', flags: 64 });

            const interactionUser = await interaction.guild.members.fetch(interaction.user.id);
            const player_count = interaction.options.getInteger('player_count');
            const type = interaction.options.getString('type');
            const min_elo_limit = interaction.options.getInteger('min_elo_limit') || 0;

            const nickname = interactionUser.nickname || interactionUser.user.globalName || interactionUser.user.username;

            // Get info about the player from FoR API to verify that their ELO is above the threshold

            const options1 = {
                hostname: 'friendsofrisk.com',
                path: '/m2mapi/getuser',
                method: 'POST',
                headers: {
                    'X-API-KEY': global.config.for_api_key
                }
            };

            const postData1 = JSON.stringify({
                discordid: interaction.user.id,
            });

            const postres = await httpsPostRequest(options1, postData1);
            const foruser = JSON.parse(postres);

            // Convert the ELO from float to integer
            const current_elo = foruser.data.ffa_elo_score ? Math.floor(foruser.data.ffa_elo_score) : 0;

            if (current_elo < min_elo_limit) {
                await interaction.followUp({ content: `Sorry, your current ELO of ${current_elo} is below the minimum requirement of ${min_elo_limit} to create this lounge game.`, flags: 64 });
                return;
            }

            const guild = await client.guilds.fetch(interaction.guild.id);
            const channel = await guild.channels.fetch(interaction.channelId);
            const botMember = guild.members.me;
            if (!botMember.permissions.has('ManageChannels')) {
                await interaction.followUp({ content: `Sorry, I don't have permission to manage channels.`, flags: 64 });
                return;
            }

            // Create a thread
            const thread = await channel.threads.create({
                name: nickname + '-' + type + '-' + player_count + 'p-lounge-game',
                type: ChannelType.PrivateThread,
                autoArchiveDuration: 10080,
            });

            let pingrole;

            if (type == "Competitive") {
                pingrole = global.config.competitive_lounge_role;
            } else {
                pingrole = global.config.relaxed_lounge_role;
            }

            // Message the channel about the created thread, with a button to join the thread yourself that you can click on
            const joinmessage = await channel.send({ content: `New ${type} Lounge game created.\n<@&${pingrole}>` });

            const welcomemessage = await thread.send({ content: `Welcome to this new lounge thread` });

            const options2 = {
                hostname: 'friendsofrisk.com',
                path: '/m2mapi/createloungegame',
                method: 'POST',
                headers: {
                    'X-API-KEY': global.config.for_api_key
                }
            };

            const postData2 = JSON.stringify({
                serverid: guild.id,
                channelid: channel.id,
                threadid: thread.id,
                joinmessageid: joinmessage.id,
                welcomemessageid: welcomemessage.id,
                player: interaction.user.id,
                lobby_type: type,
                elolimit: min_elo_limit,
                lobbysize: player_count,
            });

            const output = await httpsPostRequest(options2, postData2);

            // Add the interaction user to the staff thread
            await addLoungeMember(guild, thread, interaction.user.id);
        } catch (error) {
            console.error(error);
            await interaction.followUp({ content: 'Error creating thread.', flags: 64 });
        }
    }
};
