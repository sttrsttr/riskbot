const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
	  .setName('settings')
	  .setDescription('Get a random setting')
	,
	async execute(interaction) {
	  try {

		const attachment = new AttachmentBuilder('https://friendsofrisk.com/randomsettings.png'); //ex. https://i.imgur.com/random.jpg
		//message.channel.send({ content: "I sent you a photo!", files: [attachment] })
		await interaction.reply({ content: "Here are some random settings for you", files: [attachment], ephemeral: false });

	  } catch (error) {
		console.error(error);
		await interaction.reply({ content: "Error, please try again later", ephemeral: true });
	  }
	}
  };
  
