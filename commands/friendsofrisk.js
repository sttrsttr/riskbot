const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
	  .setName('friendsofrisk')
	  .setDescription('Login at friendsofrisk.com')
		,
	async execute(interaction) {
	  try {

		await interaction.reply({ content: "This command is outdated. Just visit https://www.friendsofrisk.com and you can login directly from Discord there\n"+ dmtargets, ephemeral: true });

	  } catch (error) {
		console.error(error);
		await interaction.reply({ content: "Error getting status, please try again later", ephemeral: true });
	  }
	}
  };
  
