var mysql = require('mysql2');

module.exports = async (interaction) => {

    const userid = interaction.user.id;
	const channelid = interaction.message.channelId;
	const messageid = interaction.message.id;

    		try {
			await interaction.reply({ content: "Please stand by...", flags: 64 });

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

			let sql = "SELECT e.`serverid`, e.`helpchannel`, e.`waitlistrole`, eg.`name`, eg.`gametime`, eg.`id`, e.`staffchannel`, e.`staffrole` FROM `" + global.config.mysql_database + "`.`eventmanager__groups` eg INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__events` e ON r.`eventid` = e.`id` AND eg.`threadid` = '" + channelid + "' AND eg.`completed` IS NULL AND (eg.`staffpinged` IS NULL OR DATE_ADD(NOW(), INTERVAL -10 MINUTE) > eg.`staffpinged`)";
			const result = await new Promise((resolve, reject) => {
				con.query(sql, function (err, result) {
					if (err) reject(err);
					resolve(result);
				});
			});
			const group = result[0];
			if (group) {

				const guild = await client.guilds.resolve(group.serverid);
				const channel = await guild.channels.fetch(channelid);
				//const staffthread = await guild.channels.fetch(group.staffchannel);

				const message = `${interaction.user} have requested help from <@&${group.staffrole}>`;
				await channel.send({ content: message, allowedMentions: { repliedUser: false, roles: [group.staffrole] } });

				sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__groups` SET `staffpinged` = NOW() WHERE `id` = " + group.id + "";
				const result2 = await new Promise((resolve, reject) => {
					con.query(sql, function (err, result) {
						if (err) reject(err);
						resolve(result);
					});
				});

			} else {
				await interaction.followUp({ content: "I am not able to ping the event staff for you, sorry.", flags: 64 });
			}
			con.end();
		} catch (error) {
			console.error(error);
			await interaction.followUp({ content: "Error, please try again later", flags: 64 });
		}

};