const { SlashCommandBuilder, quote } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
	  .setName('getuserinfo')
	  .setDescription('Show a users info from Friends of Risk')
	.addUserOption(option =>
		option
		.setName('user')
		.setDescription('user')
		.setRequired(true)
	)
	,
	async execute(interaction) {
	  try {

		const optionUser = interaction.options.getMember('user');

		await interaction.reply({ content: "I am on it...  connecting to Friends of Risk now", flags: 64 });

		try {

			const response = await fetch('https://friendsofrisk.com/api/getuser', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-API-KEY': 'AAAAB3NzaC1yc2EAAAADAQABAAABAQCjYnUwSJEdy8sZMH2E8cNh6q0oYNeAiQjkiTdG6R70ltGHXmGLnzkj0NGrNEiMAjrj4c9f'
				},
				body: JSON.stringify({ discordid: optionUser.id })
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			if (!data) {
				await interaction.followUp({ content: "User not found or no data available.", flags: 64 });
				return;
			}

			console.log(data);

			let replymessage = `**FoR Information for ${optionUser.user.username}**\n`;
			replymessage += `**ELO rank:** ${data.data.ffa_elo_rank}\n`;
			replymessage += `**ELO score:** ${data.data.ffa_elo_score}\n`;

			await interaction.followUp({ content: replymessage, flags: 64 });				

		} catch (error) {
			console.error(error);
			await interaction.followUp({ content: "Error, I might not have the correct permissions to send messages to this channel.", flags: 64 });				
		}


	  } catch (error) {
		console.error(error);
		await interaction.reply({ content: "Error, please try again later", flags: 64 });
	  }
	}
  };
  
