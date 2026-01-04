var mysql = require('mysql2');

module.exports = async (interaction) => {

    const userid = interaction.user.id;
	const channelid = interaction.message.channelId;
	const messageid = interaction.message.id;

    		try {
			await interaction.reply({ content: `Please stand by...`, ephemeral: true });

			// Connect to SQL database
			var con = mysql.createConnection({
				host: global.config.mysql_host,
				user: global.config.mysql_username,
				password: global.config.mysql_password,
				supportBigNumbers: true,
				bigNumberStrings: true
			});
			con.connect(function (err) {
				if (err) throw err;
			});

			let sql = "SELECT e.`serverid`, e.`helpchannel`, e.`waitlistrole`, eg.`name`, eg.`gametime`, eg.`id`, eg.`threadid`, eg.`roundid`, e.`staffrole`, e.`staffchannel`, r.`scoring`, r.`eventid` FROM `" + global.config.mysql_database + "`.`eventmanager__groups` eg INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__events` e ON r.`eventid` = e.`id` AND  eg.`threadid` = '" + channelid + "' AND `completed` IS NULL";
			const result = await new Promise((resolve, reject) => {
				con.query(sql, function (err, result) {
					if (err) reject(err);
					resolve(result);
				});
			});
			const group = result[0];
			if (group) {

				const guild = await client.guilds.resolve(group.serverid);
				const thread = await guild.channels.fetch(group.threadid);
				const member = await guild.members.fetch(userid);

				if (await member.roles.cache.has(group.staffrole)) {

					let sql = "SELECT * FROM `" + global.config.mysql_database + "`.`users` WHERE `discordid` = '" + userid + "' LIMIT 1";
					const result = await new Promise((resolve, reject) => {
						con.query(sql, function (err, result) {
							if (err) reject(err);
							resolve(result);
						});
					});
					const rows = result;
					if (rows.length == 1) {
						const guid = uuidv4().toUpperCase();
						let sql = "UPDATE `" + global.config.mysql_database + "`.`users` SET `guid` = '" + guid + "', `guid_validto` = DATE_ADD(NOW(), INTERVAL +1 DAY) WHERE `discordid` = '" + userid + "'";
						const result = await new Promise((resolve, reject) => {
							con.query(sql, function (err, result) {
								if (err) reject(err);
								resolve(result);
							});
						});
						await interaction.followUp({ content: 'Click this link to add the scores for this group: <https://friendsofrisk.com/eventmanager/' + group.eventid + '/group/' + group.id + '>', ephemeral: true, allowedMentions: { parse: [] } });
					} else {
						await interaction.followUp({ content: `I was unable to create a link for you. Please try again later.`, ephemeral: true });
					}



				} else {

					if (group.scoring == "POINTS") {
						await interaction.followUp({ content: `Please just write the results in a message in this thread like this\n\n1st: @player1 (1 bounty)\n2nd: @player2 (2 bounties)\n3rd: @player3\n4th @player4\n\nand get the other players to verify with a checkmark, then ping event staff who will gather the results.`, ephemeral: true });
					} else {
						await interaction.followUp({ content: `Please just write the results in a message in this thread like this\n\nWinner:\n@player1\n@player3\n@player4\n\nLosers\n$player2\n@player5\n@player6\n\nand get the other players to verify with a checkmark, then ping event staff who will gather the results.`, ephemeral: true });
					}

				}




			}
			con.end();
		} catch (error) {
			console.error(error);
			await interaction.followUp({ content: "Error, please try again later", ephemeral: true });
		}


};