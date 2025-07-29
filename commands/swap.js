const { SlashCommandBuilder} = require('@discordjs/builders')
const { Message, EmbedBuilder, ChannelType, ThreadAutoArchiveDuration } = require('discord.js');
const { guilds, mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');
const { swap_users } = require('../modules/signuphandler.js');

var mysql = require('mysql2');


module.exports = {
    data: new SlashCommandBuilder()
    .setName('swap')
    .setDescription('Swap player groups')
    .addUserOption(
        option =>
            option.setName('playera')
                .setDescription('Player A (initiating)')
                .setRequired(true))
    .addUserOption(
        option =>
            option.setName('playerb')
                .setDescription('Player B (accepting)')
                .setRequired(true))
                ,
async execute(interaction, client) {

        try{

            await interaction.reply({ content: "I am on it...", ephemeral: true });

            const parentChannel = interaction.guild?.channels.cache.get(interaction.channel?.parentId);
            const channelId = (parentChannel && parentChannel.type === 4)
                ? interaction.channelId
                : (interaction.channel?.parentId ? interaction.channel.parentId : interaction.channelId);

            const user1 = interaction.options.getUser('playera');
            const user2 = interaction.options.getUser('playerb');


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

            sql = "SELECT e.* FROM `"+ mysql_database +"`.`eventmanager__events` e INNER JOIN `"+ mysql_database +"`.`eventmanager__events_status` es ON e.`id` = es.`eventid` AND es.`validto` IS NULL AND es.`status` != 'ARCHIVED' AND (e.`mainchannel` = "+ channelId +" OR e.`helpchannel` = "+ channelId +")";
            result = await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });

            if (result.length == 1) {
                const event = result[0];
                if (event) {

                    sql = "SELECT 1 FROM `"+ mysql_database +"`.`eventmanager__events` e INNER JOIN `"+ mysql_database +"`.`eventmanager__staff` es ON e.`id` = es.`eventid` AND es.`userid` = "+ interaction.user.id +" AND e.`id` = "+ event.id +"";
                    staff = await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });
                    sql = "SELECT 1 FROM `"+ mysql_database +"`.`eventmanager__events` e INNER JOIN `"+ mysql_database +"`.`eventmanager__admins` es ON e.`id` = es.`eventid` AND es.`userid` = "+ interaction.user.id +" AND e.`id` = "+ event.id +"";
                    admin = await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });
    
                    if (staff.length > 0 || admin.length > 0) {
    
                        const guild = await client.guilds.fetch(event.serverid);
                        if (!guild) {
                            console.log('Guild not found');
                            return;
                        }
    
                        sql = "SELECT gm.`playerid` AS `from_player`, gm2.`playerid` AS `to_player`, g.`id` AS `from_group_id`, g.`name` AS `from_group_name`, g.`threadid` AS `from_group_threadid`, g2.`id` AS `to_group_id`, g2.`name` AS `to_group_name`, g2.`threadid` AS `to_group_threadid`, g.`roundid` FROM `"+ mysql_database +"`.`eventmanager__events` e INNER JOIN `"+ mysql_database +"`.`eventmanager__rounds` er ON e.`id` = er.`eventid` INNER JOIN `"+ mysql_database +"`.`eventmanager__groups` g ON er.`id` = g.`roundid` AND e.`id` = "+ event.id +" INNER JOIN `"+ mysql_database +"`.`eventmanager__groupmembers` gm ON gm.`groupid` = g.`id` AND gm.`playerid` = "+ user1.id +" AND gm.`validto` IS NULL AND g.`completed` IS NULL INNER JOIN `"+ mysql_database +"`.`eventmanager__groups` g2 ON er.`id` = g2.`roundid` AND g2.`roundid` = g.`roundid` INNER JOIN `"+ mysql_database +"`.`eventmanager__groupmembers` gm2 ON gm2.`groupid` = g2.`id` AND gm2.`playerid` = "+ user2.id +" AND gm2.`validto` IS NULL AND g2.`completed` IS NULL AND g.`id` != g2.`id` AND gm.`playerid` != gm2.`playerid`";
                        groups = await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });
                            
                        if (groups.length != 1) {
                            await interaction.followUp({ content: "ERROR: I could not find both players groups, please use the website to swap manually", ephemeral: true });
                        } else {

                            const swap = groups[0];

                            sql = "UPDATE `"+ mysql_database +"`.`eventmanager__groupmembers` gm INNER JOIN `"+ mysql_database +"`.`eventmanager__groups` g ON gm.`groupid` = g.`id` INNER JOIN `"+ mysql_database +"`.`eventmanager__rounds` er ON er.`id` = gm.`roundid` AND er.`eventid` = "+ event.id +" SET gm.`validto` = NOW() WHERE gm.`validto` IS NULL AND g.`completed` IS NULL AND gm.`playerid` = "+ swap.from_player +"";
                            await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });
                            sql = "INSERT INTO `"+ mysql_database +"`.`eventmanager__groupmembers` VALUES (NULL,"+ swap.roundid +", "+ swap.to_group_id +", "+ swap.from_player +", NOW(), NULL, NULL)";
                            await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });
            

                            sql = "INSERT INTO `"+ mysql_database +"`.`eventmanager__playerlog` VALUES (NULL,"+ swap.from_player +","+ event.id +",NOW(),'Initiated a swap into another group','Swap-command by staff',NULL,NULL)";
                            await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });

                            sql = "INSERT INTO `"+ mysql_database +"`.`eventmanager__playerlog` VALUES (NULL,"+ swap.to_player +","+ event.id +",NOW(),'Swapped with another player','Swap-command by staff',NULL,NULL)";
                            await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });

                            sql = "UPDATE `"+ mysql_database +"`.`eventmanager__groupmembers` gm INNER JOIN `"+ mysql_database +"`.`eventmanager__groups` g ON gm.`groupid` = g.`id` INNER JOIN `"+ mysql_database +"`.`eventmanager__rounds` er ON er.`id` = gm.`roundid` AND er.`eventid` = "+ event.id +" SET gm.`validto` = NOW() WHERE gm.`validto` IS NULL AND g.`completed` IS NULL AND gm.`playerid` = "+ swap.to_player +"";
                            await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });

                            sql = "INSERT INTO `"+ mysql_database +"`.`eventmanager__groupmembers` VALUES (NULL,"+ swap.roundid +", "+ swap.from_group_id +", "+ swap.to_player +", NOW(), NULL, NULL)";
                            await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });

                            let message = "Swap executed between <@"+ swap.from_player +"> and <@"+ swap.to_player +">";
                            swap_users(client, event.serverid, event.mainchannel, swap.from_group_threadid, swap.from_player, swap.to_group_threadid, swap.to_player, message, event.staffrole);


                        }
    
    
                    } else {
                        await interaction.followUp({ content: "ERROR: You are not staff in this event, so you are not allowed to swap players", ephemeral: true });
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
