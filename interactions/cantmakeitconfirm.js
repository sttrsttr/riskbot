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

			let sql = "SELECT br.`noshowrole`, e.`serverid`, e.`helpchannel`, e.`staffrole`, e.`participantrole`, e.`waitlistrole`, eg.`name`, eg.`gametime`, eg.`id`, e.`staffchannel`, e.`staffrole`, eg.`checkinmessageid`, r.`eventid` FROM `" + global.config.mysql_database + "`.`eventmanager__groups` eg INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__events` e ON r.`eventid` = e.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__brackets` br ON br.`eventid` = e.`id` AND br.`bracketid` = r.`bracket` AND eg.`threadid` = '" + channelid + "' AND eg.`completed` IS NULL";
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
				const member = await guild.members.fetch(userid);

				await interaction.reply({ content: "Goodbye!", flags: 64 });

				const welcomemsg = `<@${userid}> just left this group`;
				await thread.send({ content: welcomemsg, allowedMentions: { users: [userid], repliedUser: false } });

				await member.roles.add(group.noshowrole);

				const threadMembers = await thread.members.fetch();
				if (threadMembers.has(member.id) && !member.roles.cache.has(group.staffroleid)) {
					await thread.members.remove(`${member.id}`);
				}

				sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__groupmembers` SET `validto` = NOW() WHERE `groupid` = " + group.id + " AND `validto` IS NULL AND `playerid` = " + interaction.user.id + "";
				await new Promise((resolve, reject) => {
					con.query(sql, (err, result) => {
						if (err) return reject(err);
						resolve(result);
					});
				});

				if (group.checkinmessageid) {
					await updatecheckinmessage(thread);
				}

				sql = "INSERT INTO `" + global.config.mysql_database + "`.`eventmanager__playerlog` VALUES (NULL," + userid + "," + group.eventid + ",NOW(),'Left a group before start','Using Discord',NULL,NULL)";
				await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });

			} else {
				await interaction.reply({ content: "I am not able to put you on the waitlist, sorry!", flags: 64 });
			}
			con.end();
		} catch (error) {
			console.error(error);
			await interaction.reply({ content: "Error, please try again later", flags: 64 });
		}

};