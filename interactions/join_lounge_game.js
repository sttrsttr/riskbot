const { addLoungeMember } = require('../modules/lounge_functions.js');
const { httpsPostRequest, httpsGetRequest } = require('../modules/helperfunctions.js');

module.exports = async (interaction) => {

    const userid = interaction.user.id;
	const messageid = interaction.message.id;

    const randommessages = [
        "I hope this works...",
        "Alright my friend! Let's do this...",
        "Joining the lounge game...",
        "Trying to join the lounge game...",
        "Connecting to the lounge game...",
        "Entering the lounge game..."
    ];

    const randommessage = randommessages[Math.floor(Math.random() * randommessages.length)];

    await interaction.reply({ content: randommessage, flags: 64 });

	try {

			// Get thread meta info
            const options = {
                hostname: 'friendsofrisk.com',
                path: '/m2mapi/getloungegame',
                method: 'POST',
                headers: {
                    'X-API-KEY': global.config.for_api_key
                }
            };

            const postData = JSON.stringify({
                joinmessageid: messageid,
                playerid: userid
            });

            const output = await httpsPostRequest(options, postData);
            const results = JSON.parse(output);

            const threadmeta = results.gamedata

            if (results.status != 'success') {
                await interaction.followUp({ content: `Error, you are not unable to join this game (${results.message})`, flags: 64 });
                return;
            }

			const thread = await interaction.guild.channels.fetch(threadmeta.threadid);
			
			// Verify that there still are free spots
			if (threadmeta.playercount < threadmeta.lobbysize) {

				// Add the player to the lounge game
				const addmemberresult = await addLoungeMember(interaction.guild, thread, userid);	

			}

	} catch (error) {
		console.error(error);
		await interaction.followUp({ content: "Error, please try again later", flags: 64 });
	}

};