const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
	  .setName('settings1v1')
	  .setDescription('Get a random 1v1 setting')
	,
	async execute(interaction) {
	  try {

		const attachment = new AttachmentBuilder('https://friendsofrisk.com/randomsettings1v1.png'); //ex. https://i.imgur.com/random.jpg
		//message.channel.send({ content: "I sent you a photo!", files: [attachment] })
		await interaction.reply({ content: "Here are some random 1v1 settings for you", files: [attachment], ephemeral: false });

	  } catch (error) {
		console.error(error);
		await interaction.reply({ content: "Error, please try again later", ephemeral: true });
	  }
	}
  };
  
