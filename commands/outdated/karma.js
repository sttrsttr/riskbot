
const { SlashCommandBuilder } = require('discord.js');
var mysql = require('mysql2');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('karma')
		.setDescription('Add or remove karma points from a player')
		.addStringOption(option =>
			option.setName('action')
				.setDescription('Action')
				.setRequired(true)
				.addChoices(
					{ name: 'Infraction (-40)', value: 'infraction40' },
					{ name: 'Infraction (-25)', value: 'infraction25' },
					{ name: 'Infraction (-20)', value: 'infraction20' },
					{ name: 'Infraction (-15)', value: 'infraction15' },
					{ name: 'Infraction (-10)', value: 'infraction10' },
					{ name: 'Infraction (-5)', value: 'infraction5' },
					{ name: 'Manually correcting karma (+5)', value: 'back5' },
					{ name: 'Manually correcting karma (+10)', value: 'back10' },
					{ name: 'Manually correcting karma (+15)', value: 'back15' },
					{ name: 'Manually correcting karma (+20)', value: 'back20' },
					{ name: 'Manually correcting karma (+25)', value: 'back25' },
					{ name: 'Manually correcting karma (+40)', value: 'back40' }
				)
			)	
			.addUserOption(option =>
			option
			.setName('user')
			.setDescription('user')
			.setRequired(true)
		)
		.addStringOption(option =>
			option.setName('comment')
			.setDescription('Comment/reference')
			.setRequired(true))
		,
		async execute(interaction, client) {


			const points = {
				'infraction40': -40,
				'infraction25': -25,
				'infraction20': -20,
				'infraction15': -15,
				'infraction10': -10,
				'infraction5': -5,
				'back5': 5,
				'back10': 10,
				'back15': 15,
				'back20': 20,
				'back25': 25,
				'back40': 40,
			}

			try {

					
				const interactionUser = await interaction.guild.members.fetch(interaction.user.id);
				const action = interaction.options.getString('action');
				const user = interaction.options.getMember('user');
				let score = parseInt(points[action]);
				await interaction.reply({ content: "Adding karma points to database now!", flags: 64 });
				const comment = interaction.options.getString('comment').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 500);
				const guild = await client.guilds.resolve(interaction.guild.id);


				// Connect to SQL database
				var con = mysql.createConnection({
					host: global.config.mysql_host,
					user: global.config.mysql_username,
					password: global.config.mysql_password,
					supportBigNumbers: true,
					bigNumberStrings: true
				});
				
				con.connect(function(err) {
					if (err) throw err;
				});

				let sql = "SELECT SUM(`points`) AS `sum` FROM `"+ global.config.mysql_database +"`.`karmapoints` WHERE `playerid` = "+ user.id +"";
				let result = await new Promise((resolve, reject) => {
					con.query(sql, function (err, result) {
						if (err) reject(err);
						resolve(result);
					});
				});

				let sum = 0;

				if (result[0].sum) {
					// Existing
					sum = parseInt(result[0].sum);
				}

				if (sum+score > 0) {
					score = score-(sum+score);
				}

				sql = "INSERT INTO `"+ global.config.mysql_database +"`.`karmapoints` VALUES (NULL,"+ user.id +",NOW(),"+ score +","+ interactionUser.id +",'"+ action +"','"+ comment +"')";
				result = await new Promise((resolve, reject) => {
					con.query(sql, function (err, result) {
						if (err) reject(err);
						resolve(result);
					});
				});
				if (result) {
					const text = `${interaction.user} just added ${action} (${score} points) to ${user} with comment *${comment}*. View status here: https://friendsofrisk.com/karma/`;

					const karmachannelid = '1306309227152674856';
					const channel = guild.channels.cache.get(karmachannelid);

					await channel.send(text);	
				}
				
			} catch (error) {
				console.error(error);
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({ content: "Error, please try again later", flags: 64 });
				} else {
					await interaction.reply({ content: "Error, please try again later", flags: 64 });
				}
			}
		
			con.end();

		}
};
