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

			let sql = "SELECT e.`serverid`, e.`helpchannel`, e.`participantrole`, e.`waitlistrole`, eg.`name`, eg.`gametime`, eg.`id`, e.`staffchannel`, e.`staffrole`, eg.`checkinmessageid`, eg.`roundid`, r.`eventid` FROM `" + global.config.mysql_database + "`.`eventmanager__groups` eg INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__groupmembers` gm ON gm.`groupid` = eg.`id` AND gm.`playerid` = " + userid + " AND gm.`validto` IS NULL INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__events` e ON r.`eventid` = e.`id` AND eg.`threadid` = '" + channelid + "' AND eg.`completed` IS NULL";
			const result = await new Promise((resolve, reject) => {
				con.query(sql, function (err, result) {
					if (err) reject(err);
					resolve(result);
				});
			});
			const group = result[0];
			if (group) {

				let message = `We recommend trying to look for a swap into another group first. Look up the other groups at https://friendsofrisk.com/eventmanager/${group.eventid}/round/${group.roundid}/ and then ping players you would like to swap with in the help-channel: <#${group.helpchannel}>. If you just want to be put on the noshow-list instead with no guarantee that you will be able to get in a group this round, please click this button:`;

				const btn1 = new ButtonBuilder()
					.setCustomId('cantmakeitconfirm')
					.setLabel('Put me on the noshow-list')
					.setStyle(ButtonStyle.Danger);

				let components = [];
				const row = new ActionRowBuilder().addComponents(btn1);
				components.push(row);

				await interaction.reply({ content: message, components: components, flags: 64 });

			} else {
				await interaction.reply({ content: "Error, please try again later", flags: 64 });
			}
			con.end();
		} catch (error) {
			console.error(error);
			await interaction.reply({ content: "Error, please try again later", flags: 64 });
		}

};