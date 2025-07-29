const { SlashCommandBuilder, ButtonBuilder , EmbedBuilder } = require('discord.js');
const {pagination, ButtonTypes, ButtonStyles} = require('@devraelfreeze/discordjs-pagination');

var mysql = require('mysql2');
const { mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');

module.exports = {
	data: new SlashCommandBuilder()
	  .setName('sabr-top')
	  .setDescription('Look up the toplist of Sabr555s ranking system')
	  .addStringOption(option =>
		option.setName('public')
			.setDescription('Show the result to everyone in the channel?')
			.setRequired(false)
			.addChoices(
				{ name: 'Yes', value: '1' },
				{ name: 'No', value: '0' })
		)
	  ,
	async execute(interaction) {
	  try {

		// Connect to SQL database
		var con = mysql.createConnection({
			host: mysql_host,
			user: mysql_username,
			password: mysql_password,
			supportBigNumbers: true,
			bigNumberStrings: true
		});  
		con.connect(function(err) {
			if (err) throw err;
		});

		// Set up variables
		const interactionUser = await interaction.guild.members.fetch(interaction.user.id);
		let errors = "I am on it!";
		const public = interaction.options.getString('public') ?? '0';

		// Fetch top 100 players
		var sql = "SELECT t1.`rank`, t1.`points`, t1.`appearances`, t2.`riskname`, t2.`id` FROM `friendsofrisk`.`tournament_ranking` t1 INNER JOIN `friendsofrisk`.`players` t2 ON t1.`playerid` = t2.`id` ORDER BY t1.`rank` LIMIT 0,99";
		const result = await new Promise((resolve, reject) => {
		  con.query(sql, function (err, result) {
			if (err) reject(err);
			resolve(result);
		  });
		});
		var rows = result;
		let cnt = 0;
		let data = "";
		let page = 0;
		let pagedata = [];
		for (const message of rows) {
			if (cnt > 9) {
				pagedata[page] = data;
				data = "";
				cnt = 0;
				page = page + 1;
			}
			data = data +"#"+ message.rank +" "+ message.riskname +" ("+ message.points +" points)\n";
			cnt = cnt + 1;
		}
		pagedata[page] = data;

		const embed1 = new EmbedBuilder()
     	.setTitle("Sabr ranking (page 1)")
    	.setDescription(pagedata[0]);

		const embed2 = new EmbedBuilder()
		.setTitle("Sabr ranking (page 2)")
    	.setDescription(pagedata[1]);

		const embed3 = new EmbedBuilder()
		.setTitle("Sabr ranking (page 3)")
    	.setDescription(pagedata[2]);

		const embed4 = new EmbedBuilder()
		.setTitle("Sabr ranking (page 4)")
    	.setDescription(pagedata[3]);

		const embed5 = new EmbedBuilder()
		.setTitle("Sabr ranking (page 5)")
    	.setDescription(pagedata[4]);

		const embed6 = new EmbedBuilder()
		.setTitle("Sabr ranking (page 6)")
    	.setDescription(pagedata[5]);

		const embed7 = new EmbedBuilder()
		.setTitle("Sabr ranking (page 7)")
    	.setDescription(pagedata[6]);

		const embed8 = new EmbedBuilder()
		.setTitle("Sabr ranking (page 8)")
    	.setDescription(pagedata[7]);

		const embed9 = new EmbedBuilder()
		.setTitle("Sabr ranking (page 9)")
    	.setDescription(pagedata[8]);

		const embed10 = new EmbedBuilder()
		.setTitle("Sabr ranking (page 10)")
    	.setDescription(pagedata[9]);

		const pages = [
			embed1,
			embed2,
			embed3,
			embed4,
			embed5,
			embed6,
			embed7,
			embed8,
			embed9,
			embed10,
		];


		con.end();
		var ephemeral_reply = false;
		if (public == '0') {
			ephemeral_reply = true;
		}
		await interaction.reply({ content: errors, ephemeral: ephemeral_reply });

		await pagination({
			embeds: pages, /** Array of embeds objects */
			author: interaction.member.user,
			interaction: interaction,
			ephemeral: true,
			time: 60000, /** 60 seconds */
			disableButtons: true, /** Remove buttons after timeout */
			fastSkip: false,
			pageTravel: false,
			buttons: [
			  {
				type: ButtonTypes.previous,
				label: 'Previous Page',
				style: ButtonStyles.Primary
			  },
			  {
				type: ButtonTypes.next,
				label: 'Next Page',
				style: ButtonStyles.Success
			  }
			]
		  });

	  } catch (error) {
		console.error(error);
		await interaction.reply({ content: "Error getting status, please try again later", ephemeral: true });
	  }
	}
  };
  
