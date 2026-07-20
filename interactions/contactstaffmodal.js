const { httpsPostRequest } = require('../modules/helperfunctions.js');

module.exports = async (interaction) => {

	try {

		await interaction.reply({ content: "Sending your request to the event staff...", flags: 64 });

		const message = interaction.fields.getTextInputValue('staffmessage');

		// The button lives in the #commands thread; its parent is the event main
		// channel, which is what getEvent resolves on.
		const mainchannelid = interaction.channel?.parentId || interaction.channelId;

		// getEvent
		const res = await httpsPostRequest(
			{ hostname: 'friendsofrisk.com', path: '/openapi/getEvent', method: 'POST' },
			JSON.stringify({ mainchannelid: mainchannelid })
		);
		const events = JSON.parse(res);
		const event = events[0];

		if (!event) {
			await interaction.followUp({ content: "ERROR: I could not find any event active in this channel", flags: 64 });
			return;
		}

		// Log/rate-limit the ping the same way the /staff command does
		const pingRes = await httpsPostRequest(
			{ hostname: 'friendsofrisk.com', path: '/m2mapi/addPingLog', method: 'POST', headers: { 'X-API-KEY': global.config.for_api_key } },
			JSON.stringify({ command: 'pingstaff', userid: interaction.user.id, channelid: mainchannelid })
		);
		const pingData = JSON.parse(pingRes);

		if (pingData.status === 'success') {
			const guild = await client.guilds.fetch(event.serverid);
			const helpthread = await guild.channels.fetch(event.helpchannel);
			await helpthread.send({
				content: `<@${interaction.user.id}> needs help with: "${message}"\n\n<@&${event.staffrole}>`,
				allowedMentions: { users: [interaction.user.id], roles: [event.staffrole], repliedUser: false }
			});
			await interaction.followUp({ content: "Your request has been sent to the event staff in the help thread. They will get back to you as soon as possible.", flags: 64 });
		} else {
			await interaction.followUp({ content: "You have contacted staff recently. Please wait a little while before trying again.", flags: 64 });
		}

	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: "Error, please try again later", flags: 64 });
		} else {
			await interaction.reply({ content: "Error, please try again later", flags: 64 });
		}
	}

};
