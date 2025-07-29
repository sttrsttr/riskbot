const { SlashCommandBuilder, quote } = require('discord.js');
var mysql = require('mysql2');
const { mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');

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

		await interaction.reply({ content: "I am on it...  connecting to Friends of Risk now", ephemeral: true });

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
				await interaction.followUp({ content: "User not found or no data available.", ephemeral: true });
				return;
			}

			console.log(data);

			let replymessage = `**FoR Information for ${optionUser.user.username}**\n`;
			replymessage += `**ELO rank:** ${data.data.ffa_elo_rank}\n`;
			replymessage += `**ELO score:** ${data.data.ffa_elo_score}\n`;

			await interaction.followUp({ content: replymessage, ephemeral: true });				

		} catch (error) {
			console.error(error);
			await interaction.followUp({ content: "Error, I might not have the correct permissions to send messages to this channel.", ephemeral: true });				
		}


	  } catch (error) {
		console.error(error);
		await interaction.reply({ content: "Error, please try again later", ephemeral: true });
	  }
	}
  };
  
