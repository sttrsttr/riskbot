const { SlashCommandBuilder } = require('discord.js');
var mysql = require('mysql2');
const { mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');

module.exports = {
	data: new SlashCommandBuilder()
	  .setName('sabr-rank')
	  .setDescription('Look up any players stats in the Sabr555s ranking system')
	  .addStringOption(option =>
		option.setName('playername')
			.setDescription('Name of the player you want to look up')
			.setRequired(true)
		)
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
		let errors = "";
		let foundres = false;
		const searchstring = interaction.options.getString('playername') ?? 'INVALID_SEARCH_STRING';
		const public = interaction.options.getString('public') ?? '0';
		let single = false;

		// Search for players in the database containing the searchstring
		let sql = "SELECT t1.`rank`, t1.`points`, t1.`appearances`, t2.`riskname`, t2.`id` FROM `friendsofrisk`.`tournament_ranking` t1 INNER JOIN `friendsofrisk`.`players` t2 ON t1.`playerid` = t2.`id` AND UPPER(t2.`riskname`) LIKE '%"+ searchstring.toUpperCase() +"%'";
		const result = await new Promise((resolve, reject) => {
		  con.query(sql, function (err, result) {
			if (err) reject(err);
			resolve(result);
		  });
		});
		const rows = result;
		if (rows.length > 1) {
			// We found more than 5 results for players containing this search string.
			// Lets try to look for an exact match instead, to see if we can get "Tim" and not "Cooltim".
			let sql = "SELECT t1.`rank`, t1.`points`, t1.`appearances`, t2.`riskname`, t2.`id` FROM `friendsofrisk`.`tournament_ranking` t1 INNER JOIN `friendsofrisk`.`players` t2 ON t1.`playerid` = t2.`id` AND UPPER(t2.`riskname`) = '"+ searchstring.toUpperCase() +"'";
			const result2 = await new Promise((resolve, reject) => {
			  con.query(sql, function (err, result2) {
				if (err) reject(err);
				resolve(result2);
			  });
			});
			const rows2 = result2;
			foundres = true;
			if (rows2.length == 1) {
				// We found an exact match. We will print it out later in the code.
				const singlerow = rows2;



			// We found only one match
			for (const message of singlerow) {
				errors = errors +"_"+ message.riskname +"_ is currently ranked #"+ message.rank +" with a total of "+ message.points +" points.\n";

				errors = errors +"\nView the profile with tournament history and badges here: https://friendsofrisk.com/ranking/"+ message.id;

/*
				// Lets look for tournament history as well
				let sql = "SELECT t.`id`, t.`name`, t.`completed`, r.`result`, p.`points`, CASE WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -4 MONTH) THEN ROUND(p.`points`, 0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -5 MONTH) THEN ROUND(p.`points`*0.95,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -6 MONTH) THEN ROUND(p.`points`*0.90, 0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -7 MONTH) THEN ROUND(p.`points`*0.85,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -8 MONTH) THEN ROUND(p.`points`*0.80,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -9 MONTH) THEN ROUND(p.`points`*0.75,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -10 MONTH) THEN ROUND(p.`points`*0.70,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -11 MONTH) THEN ROUND(p.`points`*0.65,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -12 MONTH) THEN ROUND(p.`points`*0.60,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -13 MONTH) THEN ROUND(p.`points`*0.55,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -14 MONTH) THEN ROUND(p.`points`*0.50,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -15 MONTH) THEN ROUND(p.`points`*0.45,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -16 MONTH) THEN ROUND(p.`points`*0.40, 0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -17 MONTH) THEN ROUND(p.`points`*0.35,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -18 MONTH) THEN ROUND(p.`points`*0.30,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -19 MONTH) THEN ROUND(p.`points`*0.25,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -20 MONTH) THEN ROUND(p.`points`*0.20,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -21 MONTH) THEN ROUND(p.`points`*0.15,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -22 MONTH) THEN ROUND(p.`points`*0.10,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -23 MONTH) THEN ROUND(p.`points`*0.05,0) ELSE 0 END AS `newpoints` FROM `friendsofrisk`.`players` pl INNER JOIN `friendsofrisk`.`results` r ON r.`playerid` = pl.`id` INNER JOIN `friendsofrisk`.`ranktournaments` t ON t.`id` = r.`tournamentid` INNER JOIN `friendsofrisk`.`ranktournament__points` p ON r.`tournamentid` = p.`tournamentid` AND r.`result` = p.`result` AND pl.`id` = '"+ message.id +"' ORDER BY t.`completed` DESC";				
				const result3 = await new Promise((resolve, reject) => {
				con.query(sql, function (err, result3) {
					if (err) reject(err);
					resolve(result3);
				});
				});
				const rows3 = result3;
				if (rows3.length > 0) {
					errors = errors +"\n__Tournament history__:\n\nPlacement | Points | Points after decay | Tournament";
					for (const message of rows3) {
						var mresult = message.result.toString();
						var mpoints = message.points.toString();
						var mnewpoints = message.newpoints.toString();
						var mname = message.name;
						errors = errors +"\n"+ mresult.padEnd(18) +" "+ mpoints.padEnd(15) +" "+ mnewpoints.padEnd(24) +" "+ mname;
					}	
				} else {
					errors  = errors + "\nUnable to look up tournament history for this player. I am so sorry";
				}
	*/
			}










				single = true;
			} else if (rows.length <= 5) {
				// 5 or less hits, just show their rank and points, no tournament history.
				for (const message of rows) {
					errors = errors +"_"+ message.riskname +"_ is currently ranked #"+ message.rank +" with a total of "+ message.points +" points.\n";
					foundres = true;
				}	
			} else {
				// Too many results to display
				errors = "More than 5 players matched your search, please try to be more specific";
			}
		} else if (rows.length == 1) {
			// We found an exact match. We will print it out later in the code.
			const singlerow = rows;




			// We found only one match
			for (const message of singlerow) {
				errors = errors +"_"+ message.riskname +"_ is currently ranked #"+ message.rank +" with a total of "+ message.points +" points.\n";

				errors = errors +"\nView the profile with tournament history and badges here: https://friendsofrisk.com/ranking/"+ message.id;

				/*
				// Lets look for tournament history as well
				let sql = "SELECT t.`id`, t.`name`, t.`completed`, r.`result`, p.`points`, CASE WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -4 MONTH) THEN ROUND(p.`points`, 0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -5 MONTH) THEN ROUND(p.`points`*0.95,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -6 MONTH) THEN ROUND(p.`points`*0.90, 0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -7 MONTH) THEN ROUND(p.`points`*0.85,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -8 MONTH) THEN ROUND(p.`points`*0.80,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -9 MONTH) THEN ROUND(p.`points`*0.75,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -10 MONTH) THEN ROUND(p.`points`*0.70,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -11 MONTH) THEN ROUND(p.`points`*0.65,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -12 MONTH) THEN ROUND(p.`points`*0.60,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -13 MONTH) THEN ROUND(p.`points`*0.55,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -14 MONTH) THEN ROUND(p.`points`*0.50,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -15 MONTH) THEN ROUND(p.`points`*0.45,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -16 MONTH) THEN ROUND(p.`points`*0.40, 0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -17 MONTH) THEN ROUND(p.`points`*0.35,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -18 MONTH) THEN ROUND(p.`points`*0.30,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -19 MONTH) THEN ROUND(p.`points`*0.25,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -20 MONTH) THEN ROUND(p.`points`*0.20,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -21 MONTH) THEN ROUND(p.`points`*0.15,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -22 MONTH) THEN ROUND(p.`points`*0.10,0) WHEN t.`completed` > DATE_ADD(NOW(),INTERVAL -23 MONTH) THEN ROUND(p.`points`*0.05,0) ELSE 0 END AS `newpoints` FROM `friendsofrisk`.`players` pl INNER JOIN `friendsofrisk`.`results` r ON r.`playerid` = pl.`id` INNER JOIN `friendsofrisk`.`ranktournaments` t ON t.`id` = r.`tournamentid` INNER JOIN `friendsofrisk`.`ranktournament__points` p ON r.`tournamentid` = p.`tournamentid` AND r.`result` = p.`result` AND pl.`id` = '"+ message.id +"' ORDER BY t.`completed` DESC";				
				const result3 = await new Promise((resolve, reject) => {
				con.query(sql, function (err, result3) {
					if (err) reject(err);
					resolve(result3);
				});
				});
				const rows3 = result3;
				if (rows3.length > 0) {
					errors = errors +"\n__Tournament history__:\n\nPlacement | Points | Points after decay | Tournament";
					for (const message of rows3) {
						var mresult = message.result.toString();
						var mpoints = message.points.toString();
						var mnewpoints = message.newpoints.toString();
						var mname = message.name;
						errors = errors +"\n"+ mresult.padEnd(18) +" "+ mpoints.padEnd(15) +" "+ mnewpoints.padEnd(24) +" "+ mname;
					}	
				} else {
					errors  = errors + "\nUnable to look up tournament history for this player. I am so sorry";
				}
					*/
			}








			foundres = true;
			single = true;
		} else {
			// No hits
			foundres = false;
		}

		if (single === true) {
		}

		con.end();

		if (foundres) {
			var ephemeral_reply = false;
			if (public == '0') {
				ephemeral_reply = true;
			}	
			await interaction.reply({ content: errors, ephemeral: ephemeral_reply });
		} else {
			await interaction.reply({ content: 'Unable to find this players ranking. Maybe the ranking name is spelled differently or they are not represented on the Sabr555 ranking list', ephemeral: true });
		}

	  } catch (error) {
		console.error(error);
		await interaction.reply({ content: "Error getting status, please try again later", ephemeral: true });
	  }
	}
  };
  
