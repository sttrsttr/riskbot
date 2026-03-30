const { SlashCommandBuilder } = require('@discordjs/builders')

const { httpsPostRequest, httpsGetRequest } = require('../modules/helperfunctions.js');


var mysql = require('mysql2');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addtowaitlist')
        .setDescription('Remove a player from this group and add them to the waitlist')
        .addUserOption(option =>
            option
                .setName('player')
                .setDescription('Player')
                .setRequired(true)
        )
    ,
    async execute(interaction, client) {

        try {

            await interaction.reply({ content: "I am on it...", flags: 64 });

            const threadid = interaction.channelId;
            const player = interaction.options.getMember('player');
            const guild = await client.guilds.fetch(interaction.guild.id);
            if (!guild) {
                console.log('Guild not found');
                return;
            }
            const member = await guild.members.fetch(player.id);

            // getEventGroupThread
            const options2 = {
                hostname: 'friendsofrisk.com',
                path: '/openapi/getEventGroupThread',
                method: 'POST',
            };

            const postData2 = JSON.stringify({
                threadid: interaction.channelId
            });

            const res2 = await httpsPostRequest(options2, postData2);

            const events = JSON.parse(res2);
            const event = events[0];

            if (event) {
                // Your logic for handling the event

                // Get event.groupmembers and explode by , to get a list of userids that are part of this thread/group
                const groupmembers = event.groupmembers.split(',');
                const staff = event.staffids.split(',');

                // Check if the player is part of the groupmembers and user is part of event staff
                if (groupmembers.includes(player.id) && staff.includes(interaction.user.id)) {

        			const thread = await interaction.guild.channels.fetch(interaction.channelId);

                    // Remove the player from the discord thread
                    await thread.members.remove(player.id);

                    // Send request to FoR to remove player from group and add to waitlist using the /addToWaitlist endpoint
                    const options3 = {
                        hostname: 'friendsofrisk.com',
                        path: '/m2mapi/addToWaitlist',
                        method: 'POST',
                        headers: {
        				'X-API-KEY': global.config.for_api_key
		            	}
                    };

                    const postData3 = JSON.stringify({
                        threadid: interaction.channelId,
                        eventid: event.eventid,
                        groupid: event.id,
                        playerid: player.id,
                        byuserid: interaction.user.id
                    });

                    const res3 = await httpsPostRequest(options3, postData3);

                    const result = JSON.parse(res3);

                }

            } else {
                await interaction.followUp({ content: "ERROR: I could not find any events active in this channel", flags: 64 });
            }
        } catch (err) {
            console.log(err)
        }
    }
}
