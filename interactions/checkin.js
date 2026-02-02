const { updatecheckinmessage } = require('../modules/signuphandler.js');

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

			let sql = "SELECT e.`serverid`, e.`helpchannel`, e.`waitlistrole`, eg.`name`, eg.`gametime`, eg.`id`, e.`staffchannel`, e.`staffrole`, eg.`checkinmessageid` FROM `" + global.config.mysql_database + "`.`eventmanager__groups` eg INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__events` e ON r.`eventid` = e.`id` AND eg.`threadid` = '" + channelid + "' INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__groupmembers` gm ON gm.`groupid` = eg.`id` AND gm.`playerid` = " + userid + " AND gm.`validto` IS NULL AND eg.`threadid` = " + channelid + " AND gm.`checkedin` IS NULL AND eg.`completed` IS NULL AND eg.`checkinmessageid` IS NOT NULL";
			const result = await new Promise((resolve, reject) => {
				con.query(sql, function (err, result) {
					if (err) reject(err);
					resolve(result);
				});
			});
			const group = result[0];
			if (group) {

				const guild = await client.guilds.resolve(group.serverid);
				const thread = await guild.channels.fetch(channelid);

				sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__groupmembers` SET `checkedin` = NOW() WHERE `groupid` = " + group.id + " AND `validto` IS NULL AND `playerid` = " + userid + "";
				await new Promise((resolve, reject) => {
					con.query(sql, (err, result) => {
						if (err) return reject(err);
						resolve(result);
					});
				});

				await interaction.reply({ content: "You are now checked in ✅", flags: 64 });
				await updatecheckinmessage(thread);

			} else {
				await interaction.reply({ content: "I am not able to check you in, sorry!", flags: 64 });
			}
			con.end();
		} catch (error) {
			console.error(error);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: "Error, please try again later", flags: 64 });
			} else {
				await interaction.followUp({ content: "There was an error, please try again later", flags: 64 });
			}
		}

};