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
	
				let sql = "SELECT * FROM `" + global.config.mysql_database + "`.`users` WHERE `discordid` = '" + userid + "' LIMIT 1";
				const result = await new Promise((resolve, reject) => {
					con.query(sql, function (err, result) {
						if (err) reject(err);
						resolve(result);
					});
				});
				const rows = result;
				if (rows.length == 1) {
					let sql2 = "SELECT * FROM `" + global.config.mysql_database + "`.`eventmanager__events` WHERE `signupchannel` = '" + interaction.channel.id + "' LIMIT 1";
					const result2 = await new Promise((resolve, reject) => {
						con.query(sql2, function (err, result) {
							if (err) reject(err);
							resolve(result);
						});
					});
					if (result2.length == 1) {
						const guid = uuidv4().toUpperCase();
						let sql = "UPDATE `" + global.config.mysql_database + "`.`users` SET `guid` = '" + guid + "', `guid_validto` = DATE_ADD(NOW(), INTERVAL +1 DAY) WHERE `discordid` = '" + userid + "'";
						const result = await new Promise((resolve, reject) => {
							con.query(sql, function (err, result) {
								if (err) reject(err);
								resolve(result);
							});
						});
						await interaction.reply({ content: 'Click this link to update your availability: <https://friendsofrisk.com/register/availability/login/' + rows[0].id + '/' + guid + '/eventid/' + result2[0].id + '>', flags: 64, allowedMentions: { parse: [] } });
					}
				}
				con.end();
			} catch (error) {
				console.error(error);
				await interaction.reply({ content: "Error, please try again later", flags: 64 });
			}
	

};