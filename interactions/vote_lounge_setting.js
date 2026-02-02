const { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, StringSelectMenuBuilder } = require('discord.js');
const { updateSettingVoteMessage } = require('../modules/lounge_functions.js');
const { httpsPostRequest, httpsGetRequest } = require('../modules/helperfunctions.js');

module.exports = async (interaction) => {

    const userid = interaction.user.id;
	const messageid = interaction.message.id;
    const thread = interaction.channel;
    const guild = interaction.guild;
    const settingid = interaction.values[0];

	try {

        await interaction.reply({ content: "Thank you for your vote", flags: 64 });

        // Get thread meta info
        const options = {
            hostname: 'friendsofrisk.com',
            path: '/m2mapi/voteloungesetting',
            method: 'POST',
            headers: {
                'X-API-KEY': global.config.for_api_key
            }
        };

        const postData = JSON.stringify({
            threadid: thread.id,
            playerid: userid,
            settingid: settingid
        });

        const output = await httpsPostRequest(options, postData);
        const threadmeta = JSON.parse(output).gamedata;

        if (threadmeta.cancelvote) {
            // Delete thread, the game is cancelled
            await thread.delete('Lounge game cancelled due to vote');
            return;
        }

        if (threadmeta.reshufflevote) {
            // Fetch settings again
            await updateSettingVoteMessage(guild, thread, threadmeta);
            return;
        }

        const missing_votes_cnt = threadmeta.notvoted.length;

        if (missing_votes_cnt > 0) {
            // Create user mention ping for those who have not voted yet
            let notvoted_ping = '';
            for (let i = 0; i < threadmeta.notvoted.length; i++) {
                notvoted_ping += `<@${threadmeta.notvoted[i]}> `;
            }
            await thread.send(`${notvoted_ping}\nThere are still ${missing_votes_cnt} players who have not voted yet.`);
            return;
            
        }

        // Delete setting vote message
        const settingVoteMessage = await thread.messages.fetch(threadmeta.settingvotemessageid);
        if (settingVoteMessage) {
            await settingVoteMessage.delete();
        }

        // All players have voted, finalize the setting
        const settingEmbed = new EmbedBuilder()
            .setTitle(`Settings are chosen!`)
            .setDescription('The settings you are playing is now locked in:')
        .setColor(0x00AE86);

        const settingOptions = [];

        for (const player of threadmeta.players) {

            const discorduser = await guild.members.fetch(player);
            const name = discorduser.nickname || discorduser.user.globalName || discorduser.user.username;

            settingOptions.push({
                label: name,
                description: name + " won the game",
                value: player,
            });
        }

        settingOptions.push({
            label: 'Game is cancelled',
            description: 'The game has been cancelled',
            value: '-9',
        });

        const settinglink = `https://friendsofrisk.com/setting/${threadmeta.settingid}.png`;

        settingEmbed.setImage(settinglink);

        const row = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('vote_lounge_winner')
                .setPlaceholder('Vote for the outcome of the game')
                .addOptions(settingOptions)
        );

        const voteMessage = await thread.send({ embeds: [settingEmbed], components: [row] });

        // Update vote message ID in database
        const options4 = {
            hostname: 'friendsofrisk.com',
            path: '/m2mapi/updateloungegame',
            method: 'POST',
            headers: {
                'X-API-KEY': global.config.for_api_key
            }
        };

        const postData4 = JSON.stringify({
            threadid: thread.id,
            winnervotemessageid: voteMessage.id
        });

        const output4 = await httpsPostRequest(options4, postData4);





	} catch (error) {
		console.error(error);
		await interaction.reply({ content: "Error, please try again later", flags: 64 });
	}

};