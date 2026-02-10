const { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, StringSelectMenuBuilder, AllowedMentionsTypes } = require('discord.js');
const { updateSettingVoteMessage } = require('../modules/lounge_functions.js');
const { httpsPostRequest, httpsGetRequest } = require('../modules/helperfunctions.js');

module.exports = async (interaction) => {

    const userid = interaction.user.id;
	const messageid = interaction.message.id;
    const thread = interaction.channel;
    const guild = interaction.guild;
    const winner = interaction.values[0];

	try {

        await interaction.reply({ content: "Thank you for your vote", flags: 64 });

        // Get thread meta info
        const options = {
            hostname: 'friendsofrisk.com',
            path: '/m2mapi/voteloungewinner',
            method: 'POST',
            headers: {
                'X-API-KEY': global.config.for_api_key
            }
        };

        const postData = JSON.stringify({
            threadid: thread.id,
            playerid: userid,
            winner: winner
        });

        console.log(`Voted winner:`, winner);

        const output = await httpsPostRequest(options, postData);
        const threadmeta = JSON.parse(output).gamedata;

        if (threadmeta.cancelvote) {
            // Delete thread, the game is cancelled
            await thread.delete('Lounge game cancelled due to vote');
            return;
        }

        if (!threadmeta.winner) {

            const missing_votes_cnt = threadmeta.notvoted.length;

            if (missing_votes_cnt > 0) {
                // Create user mention ping for those who have not voted yet
                let notvoted_ping = '';
                for (let i = 0; i < threadmeta.notvoted.length; i++) {
                    notvoted_ping += `<@${threadmeta.notvoted[i]}> `;
                }
                await thread.send(`${notvoted_ping}\nThere are still ${missing_votes_cnt} players who have not voted for a winner yet.`);

            }

            return;
        }

        // Delete winner vote message
        const winnerVoteMessage = await thread.messages.fetch(threadmeta.winnervotemessageid);
        if (winnerVoteMessage) {
            await winnerVoteMessage.delete();
        }

        const voteMessage = await thread.send(`Winner: ${threadmeta.winnerdata.name}`);

        await thread.setLocked(true);
        await thread.setArchived(true);

	} catch (error) {
		console.error(error);
		await interaction.followUp({ content: "Error, please try again later", flags: 64 });
	}

};