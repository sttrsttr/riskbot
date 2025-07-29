const { SlashCommandBuilder, ButtonBuilder , EmbedBuilder } = require('discord.js');
const {pagination, ButtonTypes, ButtonStyles} = require('@devraelfreeze/discordjs-pagination');

var mysql = require('mysql2');
const { ladderbotlog } = require('../modules/ladderbotlog.js');
const { mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');

module.exports = {
	data: new SlashCommandBuilder()
	  .setName('ladder-show')
	  .setDescription('Look up the toplist of the 1v1-ladder')
	  .addStringOption(option =>
		option.setName('public')
			.setDescription('Show the result to everyone in the channel?')
			.setRequired(true)
			.addChoices(
				{ name: 'Yes', value: '1' },
				{ name: 'No', value: '0' })
		)
	  ,
	async execute(interaction, client) {
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

		ladderbotlog(client, `${interaction.user.username} is the servers karen and wants to look up the rankings.`);

	
		// Fetch top 100 players
		var sql = "SELECT `nickname`, `rank` FROM `"+ mysql_database +"`.`1v1ladder__participants` WHERE `rank` > 0 ORDER BY `rank` ASC LIMIT 0,99";
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
			if (cnt > 15) {
				pagedata[page] = data;
				data = "";
				cnt = 0;
				page = page + 1;
			}
			data = data +"#"+ message.rank +" "+ message.nickname +"\n";
			cnt = cnt + 1;
		}
		pagedata[page] = data;
		const pages = [];

		const embed1 = new EmbedBuilder()
     	.setTitle("Ladder (page 1)")
    	.setDescription(pagedata[0]);
		pages.push(embed1);

		if (pagedata[1]) {
			const embed2 = new EmbedBuilder()
			.setTitle("Ladder (page 2)")
			.setDescription(pagedata[1]);	
			pages.push(embed2);
		}

		if (pagedata[2]) {
			const embed3 = new EmbedBuilder()
			.setTitle("Ladder (page 3)")
			.setDescription(pagedata[2]);	
			pages.push(embed3);
		}

		if (pagedata[3]) {
			const embed4 = new EmbedBuilder()
			.setTitle("Ladder (page 4)")
			.setDescription(pagedata[3]);	
			pages.push(embed4);
		}

		if (pagedata[4]) {
			const embed5 = new EmbedBuilder()
			.setTitle("Ladder (page 5)")
			.setDescription(pagedata[4]);	
			pages.push(embed5);
		}

		if (pagedata[5]) {
			const embed6 = new EmbedBuilder()
			.setTitle("Ladder (page 6)")
			.setDescription(pagedata[5]);	
			pages.push(embed6);
		}

		if (pagedata[6]) {
			const embed7 = new EmbedBuilder()
			.setTitle("Ladder (page 7)")
			.setDescription(pagedata[6]);	
			pages.push(embed7);
		}


		con.end();
		var ephemeral_reply = false;
		if (public == '0') {
			ephemeral_reply = true;
		}
		await interaction.reply({ content: errors, ephemeral: ephemeral_reply });

		if (pagedata.length > 1) {
			let config = {
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
			  };	
			  await pagination(config);
		} else {
			let config = {
				embeds: pages, /** Array of embeds objects */
				author: interaction.member.user,
				interaction: interaction,
				ephemeral: true,
				time: 60000, /** 60 seconds */
				disableButtons: true, /** Remove buttons after timeout */
				fastSkip: false,
				pageTravel: false,
				buttons: []
			  };	
			  await pagination(config);
		}


	  } catch (error) {
		console.error(error);
		ladderbotlog(client, `${interaction.user.username} made me crash 😵‍💫`);
		await interaction.reply({ content: "Error getting status, please try again later", ephemeral: true });
	  }
	}
  };
  
