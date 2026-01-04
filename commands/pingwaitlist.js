const { SlashCommandBuilder} = require('@discordjs/builders')
const { Message, EmbedBuilder, ChannelType, ThreadAutoArchiveDuration } = require('discord.js');
const { guilds, mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');

var mysql = require('mysql2');


module.exports = {
    data: new SlashCommandBuilder()
    .setName('pingwaitlist')
    .setDescription('Ping waiting list')
                ,
async execute(interaction, client) {

        try{

            await interaction.reply({ content: "I am on it...", ephemeral: true });

            const parentChannel = interaction.guild?.channels.cache.get(interaction.channel?.parentId);
            const channelId = (parentChannel && parentChannel.type === 4)
                ? interaction.channelId
                : (interaction.channel?.parentId ? interaction.channel.parentId : interaction.channelId);



            // Connect to SQL database
            var con = mysql.createConnection({
                host: global.config.mysql_host,
                user: global.config.mysql_username,
                password: global.config.mysql_password,
                supportBigNumbers: true,
                bigNumberStrings: true
            });
            
            let sql;
            let result; 

            con.connect(function(err) {
                if (err) throw err;
            });

            sql = "SELECT e.* FROM `"+ global.config.mysql_database +"`.`eventmanager__events` e INNER JOIN `"+ global.config.mysql_database +"`.`eventmanager__events_status` es ON e.`id` = es.`eventid` AND es.`validto` IS NULL AND es.`status` != 'ARCHIVED' AND (e.`mainchannel` = "+ channelId +" OR e.`helpchannel` = "+ channelId +")";
            result = await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });

            if (result.length == 1) {
                const event = result[0];
                if (event) {

                    let mention;
                    let mentionroles;

                    sql = "SELECT * FROM `"+ global.config.mysql_database +"`.`eventmanager__brackets` WHERE `eventid` = "+ event.id +"";
                    brackets = await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });

                    sql = "SELECT 1 FROM `"+ global.config.mysql_database +"`.`eventmanager__events` e INNER JOIN `"+ global.config.mysql_database +"`.`eventmanager__staff` es ON e.`id` = es.`eventid` AND es.`userid` = "+ interaction.user.id +" AND e.`id` = "+ event.id +"";
                    staff = await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });
                    sql = "SELECT 1 FROM `"+ global.config.mysql_database +"`.`eventmanager__events` e INNER JOIN `"+ global.config.mysql_database +"`.`eventmanager__admins` es ON e.`id` = es.`eventid` AND es.`userid` = "+ interaction.user.id +" AND e.`id` = "+ event.id +"";
                    admin = await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });
    
                    if (staff.length > 0 || admin.length > 0) {
    
                        const guild = await client.guilds.fetch(event.serverid);
                        if (!guild) {
                            console.log('Guild not found');
                            return;
                        }

                        const channel = await guild.channels.fetch(channelId);        
                        const interactionchannel = await guild.channels.fetch(interaction.channelId);        

                        const waitlistrole = await guild.roles.fetch(event.waitlistrole);

                        if (interactionchannel.isThread() && interaction.channelId != event.helpchannel && interaction.channelId != event.textchannel) {

                            sql = "SELECT br.`noshowrole`, br.`bracketid`, br.`bracketname`, e.`serverid`, e.`helpchannel`, e.`waitlistrole`, e.`waitlistbracket`, eg.`name`, eg.`gametime`, eg.`id` FROM `"+ global.config.mysql_database +"`.`eventmanager__groups` eg INNER JOIN `"+ global.config.mysql_database +"`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `"+ global.config.mysql_database +"`.`eventmanager__events` e ON r.`eventid` = e.`id` INNER JOIN `"+ global.config.mysql_database +"`.`eventmanager__brackets` br ON br.`eventid` = e.`id` AND br.`bracketid` = r.`bracket` AND eg.`threadid` = '"+ interactionchannel.id +"' AND eg.`completed` IS NULL AND (eg.`waitlistpinged` IS NULL OR DATE_ADD(NOW(), INTERVAL -10 MINUTE) > eg.`waitlistpinged`)";
                            const groupres = await new Promise((resolve, reject) => {
                            con.query(sql, function (err, result) {
                                if (err) reject(err);
                                resolve(result);
                            });
                            });
                            const group = groupres[0];
                            if (group) {                
                                const noshowrole = await guild.roles.fetch(group.noshowrole);
                                mention = `<@&${waitlistrole.id}>, <@&${noshowrole.id}>`
                                mentionroles = [waitlistrole.id, noshowrole.id];                                
                            }

                        } else if (brackets.length < 2) {
                            const noshowrole = await guild.roles.fetch(brackets[0].noshowrole);
                            mention = `<@&${waitlistrole.id}>, <@&${noshowrole.id}>`
                            mentionroles = [waitlistrole.id, noshowrole.id];                                

                        } else {
                            mention = `<@&${waitlistrole.id}>`;
                            mentionroles = [waitlistrole.id];                                
                        }
       
                        const message = `${mention}`;
        
                        const pingmessageid = await interactionchannel.send({ content: message, components: [], allowedMentions: { roles: mentionroles, repliedUser: false } });
    
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
