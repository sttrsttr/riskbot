const { SlashCommandBuilder} = require('@discordjs/builders')
const { Message, EmbedBuilder, ChannelType, ThreadAutoArchiveDuration } = require('discord.js');
const { guilds, mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');

var mysql = require('mysql2');


module.exports = {
    data: new SlashCommandBuilder()
    .setName('addtogroup')
    .setDescription('Add a player to this group')
    .addUserOption(option =>
        option
        .setName('player')
        .setDescription('Player')
        .setRequired(true)
    )
                ,
async execute(interaction, client) {

        try{

            await interaction.reply({ content: "I am on it...", ephemeral: true });

            const threadid = interaction.channelId;
            const player = interaction.options.getMember('player');
            const guild = await client.guilds.fetch(interaction.guild.id);
            if (!guild) {
                console.log('Guild not found');
                return;
            }
            const member = await guild.members.fetch(player.id);

            // Connect to SQL database
            var con = mysql.createConnection({
                host: mysql_host,
                user: mysql_username,
                password: mysql_password,
                supportBigNumbers: true,
                bigNumberStrings: true
            });
            
            let sql;
            let result; 

            con.connect(function(err) {
                if (err) throw err;
            });


			sql = "SELECT eg.`pingmessageid`, eg.`wlqueue`, br.`noshowrole`, br.`bracketid`, e.`waitlistqueue`, e.`serverid`, e.`helpchannel`, e.`waitlistrole`, e.`waitlistbracket`, e.`participantrole`, eg.`name`, eg.`gametime`, eg.`id`, eg.`threadid`, eg.`roundid`, r.`groupmaxsize`, r.`eventid`, e.`joinbuttontogroup`, r.`bracket` FROM `"+ mysql_database +"`.`eventmanager__groups` eg INNER JOIN `"+ mysql_database +"`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `"+ mysql_database +"`.`eventmanager__events` e ON r.`eventid` = e.`id` INNER JOIN `"+ mysql_database +"`.`eventmanager__brackets` br ON br.`eventid` = e.`id` AND br.`bracketid` = r.`bracket` AND eg.`threadid` = '"+ threadid +"' AND eg.`completed` IS NULL";
            result = await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });

            if (result.length == 1) {
                const group = result[0];
                if (group) {

                    sql = "SELECT 1 FROM `"+ mysql_database +"`.`eventmanager__events` e INNER JOIN `"+ mysql_database +"`.`eventmanager__staff` es ON e.`id` = es.`eventid` AND es.`userid` = "+ interaction.user.id +" AND e.`id` = "+ group.eventid +"";
                    staff = await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });
                    sql = "SELECT 1 FROM `"+ mysql_database +"`.`eventmanager__events` e INNER JOIN `"+ mysql_database +"`.`eventmanager__admins` es ON e.`id` = es.`eventid` AND es.`userid` = "+ interaction.user.id +" AND e.`id` = "+ group.eventid +"";
                    admin = await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });
    
                    if (staff.length > 0 || admin.length > 0) {

                        sql = "SELECT * FROM `"+ mysql_database +"`.`eventmanager__signups` WHERE `eventid` = '"+ group.eventid +"' AND `playerid` = '"+ player.id +"' AND `validto` IS NULL";
                        signups = await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });

                        if (signups.length == 1) {
                            const signup = signups[0];
                            if (signup) {
                                if (signup.bracket == group.bracketid) {
                                    sql = "SELECT * FROM `"+ mysql_database +"`.`eventmanager__games` WHERE `roundid` = '"+ group.roundid +"' AND `playerid` = '"+ player.id +"' AND `validto` IS NULL";
                                    games = await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });
                                    if (games.length == 0) {

                                        const thread = await guild.channels.fetch(threadid);

                                        sql = "SELECT g.* FROM `"+ mysql_database +"`.`eventmanager__groups` g INNER JOIN `"+ mysql_database +"`.`eventmanager__groupmembers` gm ON gm.`groupid` = g.`id` AND g.`roundid` = '"+ group.roundid +"' AND gm.`playerid` = '"+ player.id +"' AND gm.`validto` IS NULL";
                                        currentgroups = await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });

                                        if (currentgroups.length == 1) {
                                            const currentgroup = currentgroups[0];
                                            if (currentgroup) {
                                                sql = "UPDATE `"+ mysql_database +"`.`eventmanager__groupmembers` SET `validto` = NOW() WHERE `validto` IS NULL AND `playerid` = "+ player.id +" AND `groupid` = "+ currentgroup.id +"";
                                                await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });
                    
                                                const currentthread = await guild.channels.fetch(currentgroup.threadid);
                                
                                                const welcomemsg = `<@${player.id}> just left this group`;
                                                await currentthread.send({ content: welcomemsg, allowedMentions: { users: [player.id], repliedUser: false } });
                                
                                                const threadMembers = await currentthread.members.fetch();
                                                if (threadMembers.has(member.id) && !member.roles.cache.has(group.staffroleid)) {
                                                    await currentthread.members.remove(`${member.id}`);
                                                }        
                                            }
                                        }

                                        sql = "INSERT INTO `"+ mysql_database +"`.`eventmanager__groupmembers` VALUES (NULL,"+ group.roundid +", "+ group.id +", "+ player.id +", NOW(), NULL, NULL)";
                                        await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });

                                        thread.members.add(member);

                                        const welcomemsg = `<@${member.id}> just joined this group!`;
                                        await thread.send({ content: welcomemsg, allowedMentions: { users: [member.id], repliedUser: false } });
                                        if (member.roles.cache.has(group.waitlistrole)) {
                                            await member.roles.remove(group.waitlistrole);
                                        }
                                        if (member.roles.cache.has(group.noshowrole)) {
                                            await member.roles.remove(group.noshowrole);
                                        }
                                        await member.roles.add(group.participantrole);

                                    } else {
                                        await interaction.followUp({ content: "ERROR: This player has already played this round", ephemeral: true });
                                    }                                                
                                } else {
                                    await interaction.followUp({ content: "ERROR: This player is not in the same bracket as this group", ephemeral: true });
                                }
                            } else {
                                await interaction.followUp({ content: "ERROR: This player is not in this tournament", ephemeral: true });
                            }
                        } else {
                            await interaction.followUp({ content: "ERROR: This player is not in this tournament", ephemeral: true });
                        }
                                    
    
                    } else {
                        await interaction.followUp({ content: "ERROR: You are not staff in this event, so you are not allowed to ping waitlist", ephemeral: true });
                    }
    
                }

            } else {
                await interaction.followUp({ content: "ERROR: I could not find any events active in this channel", ephemeral: true });
            }
        }catch(err){
            console.log(err)
        }
    }
}
