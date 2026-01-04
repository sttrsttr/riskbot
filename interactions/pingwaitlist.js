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

        let sql = "SELECT e.`serverid`, e.`helpchannel`, e.`waitlistrole`, eg.`name`, eg.`gametime`, eg.`id` FROM `" + global.config.mysql_database + "`.`eventmanager__groups` eg INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__events` e ON r.`eventid` = e.`id` AND eg.`threadid` = '" + channelid + "' AND eg.`completed` IS NULL AND (eg.`waitlistpinged` IS NULL OR DATE_ADD(NOW(), INTERVAL -10 MINUTE) > eg.`waitlistpinged`)";
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
            await pingwaitlist(client, thread);

        }
        con.end();
    } catch (error) {
        console.error(error);
        await interaction.followUp({ content: "Error, please try again later", flags: 64 });
    }

};