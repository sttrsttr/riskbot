var mysql = require('mysql2');

module.exports = async (interaction) => {

    const userid = interaction.user.id;
	const channelid = interaction.message.channelId;
	const messageid = interaction.message.id;


            try {
                await interaction.reply({ content: `Please stand by while I am checking some stuff`, flags: 64 });
    
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
    
                let sql = "SELECT eg.`pingmessageid`, eg.`wlqueue`, br.`noshowrole`, br.`bracketid`, e.`waitlistqueue`, e.`serverid`, e.`helpchannel`, e.`waitlistrole`, e.`waitlistbracket`, e.`participantrole`, eg.`name`, eg.`gametime`, eg.`id`, eg.`threadid`, eg.`roundid`, r.`groupmaxsize`, r.`eventid`, e.`joinbuttontogroup`, r.`bracket` FROM `" + global.config.mysql_database + "`.`eventmanager__groups` eg INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__events` e ON r.`eventid` = e.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__brackets` br ON br.`eventid` = e.`id` AND br.`bracketid` = r.`bracket` AND eg.`pingmessageid` = '" + messageid + "' AND eg.`completed` IS NULL AND eg.`gametime` > DATE_ADD(NOW(), INTERVAL -11 MINUTE)";
                const result = await new Promise((resolve, reject) => {
                    con.query(sql, function (err, result) {
                        if (err) reject(err);
                        resolve(result);
                    });
                });
                const group = result[0];
                if (group) {
    
                    sql = "SELECT 1 FROM `" + global.config.mysql_database + "`.`eventmanager__groupmembers` WHERE `groupid` = " + group.id + " AND `validto` IS NULL";
                    const groupmembers = await new Promise((resolve, reject) => {
                        con.query(sql, function (err, result) {
                            if (err) reject(err);
                            resolve(result);
                        });
                    });
    
                    const guild = await client.guilds.resolve(group.serverid);
                    const member = await guild.members.fetch({ user: userid, force: true });
    
                    if ((group.waitlistbracket <= group.bracketid && member.roles.cache.has(group.waitlistrole)) || member.roles.cache.has(group.noshowrole)) {
    
                        const guild = await client.guilds.resolve(group.serverid);
                        const thread = await guild.channels.fetch(group.threadid);
    
                        if (groupmembers.length < group.groupmaxsize) {
    
                            if (group.joinbuttontogroup == 1) {
    
                                thread.members.add(member);
    
                                const welcomemsg = `<@${userid}> just joined this group!`;
                                await thread.send({ content: welcomemsg, allowedMentions: { users: [userid], repliedUser: false } });
                                if (member.roles.cache.has(group.waitlistrole)) {
                                    await member.roles.remove(group.waitlistrole);
                                }
                                if (member.roles.cache.has(group.noshowrole)) {
                                    await member.roles.remove(group.noshowrole);
                                }
                                await member.roles.add(group.participantrole);
    
                                sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__groupmembers` SET `validto` = NOW() WHERE `playerid` = " + userid + " AND `validto` IS NULL AND `roundid` = " + group.roundid + "";
                                const result3 = await new Promise((resolve, reject) => {
                                    con.query(sql, function (err, result) {
                                        if (err) reject(err);
                                        resolve(result);
                                    });
                                });
    
                                sql = "INSERT INTO `" + global.config.mysql_database + "`.`eventmanager__groupmembers` VALUES (NULL," + group.roundid + "," + group.id + "," + userid + ",NOW(),NULL,NOW(),NULL)";
                                const result4 = await new Promise((resolve, reject) => {
                                    con.query(sql, function (err, result) {
                                        if (err) reject(err);
                                        resolve(result);
                                    });
                                });
    
                                sql = "INSERT INTO `" + global.config.mysql_database + "`.`eventmanager__playerlog` VALUES (NULL," + userid + "," + group.eventid + ",NOW(),'Joined from waitlist','Using Discord',NULL,NULL)";
                                await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });
    
                                sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__signups` SET `waitlist` = NULL, `bracket` = " + group.bracket + " WHERE `eventid` = " + group.eventid + " AND `playerid` = " + userid + "";
                                await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });
    
                                if (groupmembers.length + 1 == group.groupmaxsize) {
    
                                    const pingmessage = await thread.messages.fetch(group.pingmessageid);
                                    const messageContent = `This group is now full`;
    
                                    thread.messages.fetch(group.pingmessageid).then(
                                        existingMessage => {
                                            if (!existingMessage) {
                                                console.log('Message not found.');
                                            }
                                            // Edit the existing message
                                            existingMessage.edit(messageContent)
                                                .then(editedMessage => {
                                                    //									console.log(`Message edited in ${channel.name} (${editedMessage.guild.name})`);
                                                })
                                                .catch(error => console.error(`Error editing message: ${error}`));
                                        }
                                    )
                                }
    
    
                            } else {
                                await interaction.followUp({ content: `${member} would like to take this spot`, flags: 0 });
                            }
    
    
                        } else {
                            await interaction.followUp({ content: `I am sorry, this group is now full`, flags: 64 });
    
                            sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__groups` SET `pingmessageid` = NULL WHERE `id` = " + group.id + "";
                            const result2 = await new Promise((resolve, reject) => {
                                con.query(sql, function (err, result) {
                                    if (err) reject(err);
                                    resolve(result);
                                });
                            });
    
                        }
    
                    } else {
                        await interaction.followUp({ content: `You are not on the waitlist/no-show list, and cannot join this group`, flags: 64 });
                    }
                } else {
                    await interaction.followUp({ content: `It is not possible to join this group now`, flags: 64 });
                }
                con.end();
            } catch (error) {
                console.error(error);
                await interaction.followUp({ content: "Error, please try again later", flags: 64 });
            }
    
    

};