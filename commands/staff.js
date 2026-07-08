const { SlashCommandBuilder } = require('@discordjs/builders')

const { httpsPostRequest, httpsGetRequest } = require('../modules/helperfunctions.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff')
        .setDescription('Get hold of staff members for this event')
    .addStringOption(option =>
		option.setName('message')
		.setDescription('Reason to contact staff')
		.setRequired(true))
    ,
    async execute(interaction, client) {

        try {

            const message = interaction.options.getString('message');
            await interaction.reply({ content: "I will get hold of the staff members for this event...", flags: 64 });

            let channelId = interaction.channelId;

            // Check if channel is a thread and get the parent channel ID if it is
            const channel = await client.channels.fetch(channelId);
            if (channel.isThread()) {
                channelId = channel.parentId;
            }

            const guild = await client.guilds.fetch(interaction.guild.id);
            if (!guild) {
                console.log('Guild not found');
                return;
            }

            // getEventGroupThread
            const options2 = {
                hostname: 'friendsofrisk.com',
                path: '/openapi/getEvent',
                method: 'POST',
            };

            const postData2 = JSON.stringify({
                mainchannelid: channelId
            });

            const res2 = await httpsPostRequest(options2, postData2);
            const events = JSON.parse(res2);
            const event = events[0];

            if (event) {
                // Your logic for handling the event

                const options4 = {
                    hostname: 'friendsofrisk.com',
                    path: '/m2mapi/addPingLog',
                    method: 'POST',
                    headers: {
                        'X-API-KEY': global.config.for_api_key
                    }
                };

                const postData4 = JSON.stringify({
                    command: 'pingstaff',
                    userid: interaction.user.id,
                    channelid: channelId,
                });

                const output4 = await httpsPostRequest(options4, postData4);

                // Check if output status == success
                const outputData4 = JSON.parse(output4);
                if (outputData4.status === 'success') {
                    const role = await guild.roles.fetch(event.staffrole);
                    await channel.send(`<@${interaction.user.id}> need helps with "${message}" <@&${role.id}>`);
                }

            } else {
                await interaction.followUp({ content: "ERROR: I could not find any events active in this channel", flags: 64 });
            }
        } catch (err) {
            console.log(err)
        }
    }
}
