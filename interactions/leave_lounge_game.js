const { removeLoungeMember } = require('../modules/lounge_functions.js');

module.exports = async (interaction) => {

    const userid = interaction.user.id;
	const threadid = interaction.message.channelId;
	const messageid = interaction.message.id;

	await interaction.reply({ content: "Alright my friend!", flags: 64 });

	try {

        const thread = await interaction.guild.channels.fetch(threadid);			
        const removememberresult = await removeLoungeMember(interaction.guild, thread, userid);	

	} catch (error) {
		console.error(error);
		await interaction.followup({ content: "Error, please try again later", flags: 64 });
	}

};