var mysql = require('mysql2');

module.exports = async (interaction) => {

    const userid = interaction.user.id;
	const channelid = interaction.message.channelId;
	const messageid = interaction.message.id;

    		try {

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

			let sql = "SELECT e.`serverid`, e.`helpchannel`, e.`participantrole`, e.`waitlistrole`, e.`ruleslink`, eg.`name`, eg.`gametime`, eg.`id`, e.`staffchannel`, e.`staffrole`, eg.`checkinmessageid`, eg.`roundid`, r.`eventid` FROM `" + global.config.mysql_database + "`.`eventmanager__groups` eg INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__groupmembers` gm ON gm.`groupid` = eg.`id` AND gm.`playerid` = " + userid + " AND gm.`validto` IS NULL INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__events` e ON r.`eventid` = e.`id` AND eg.`threadid` = '" + channelid + "' AND eg.`completed` IS NULL";
			const result = await new Promise((resolve, reject) => {
				con.query(sql, function (err, result) {
					if (err) reject(err);
					resolve(result);
				});
			});
			const group = result[0];
			if (group) {

				let message = `You can view information about the group on the Friends of Risk website\n\n[Event main Page](https://friendsofrisk.com/eventmanager/${group.eventid}/)\n[All Groups This Round](https://friendsofrisk.com/eventmanager/${group.eventid}/round/${group.roundid}/)\n[Settings](https://friendsofrisk.com/eventmanager/${group.eventid}/gamesettings/)\n[Current Standings](https://friendsofrisk.com/eventmanager/${group.eventid}/players/)\n[Rules](${group.ruleslink})\n`;

				await interaction.reply({ content: message, components: [], ephemeral: true });

			} else {
				await interaction.reply({ content: "Error, please try again later", ephemeral: true });
			}
			con.end();
		} catch (error) {
			console.error(error);
			await interaction.reply({ content: "Error, please try again later", ephemeral: true });
		}

};