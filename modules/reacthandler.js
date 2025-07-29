var mysql = require('mysql2');
const { ladderbotlog } = require('./ladderbotlog.js');
const { guilds, mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');

async function reactHandler(client,reaction) {
    if (reaction.message.guildId == guilds.RETRYGAMES && reaction.message.author.id == "1082404402289184768") {

        if (reaction.count >= 3) {
            //console.log(reaction);
            // 3 or more reactions, lets update message.

            try {
                // Connect to SQL database
                var con = mysql.createConnection({
                    host: mysql_host,
                    user: mysql_username,
                    password: mysql_password,
                    supportBigNumbers: true,
                    bigNumberStrings: true
                });  
                con.connect(function(err) {
                    if (err) throw err;
                });

                let sql = "SELECT r.`guild`, r.`channelid`, r.`messageid`, r.`player1_score`, r.`player2_score`, r.`player1`, r.`player2`, p1.`rank` AS `player1_rank`, p2.`rank` AS `player2_rank` FROM `"+ mysql_database +"`.`1v1ladder__results` r INNER JOIN `"+ mysql_database +"`.`1v1ladder__participants` p1 ON p1.`discorduserid` = r.`player1` INNER JOIN `"+ mysql_database +"`.`1v1ladder__participants` p2 ON p2.`discorduserid` = r.`player2` AND r.`messageid` = '"+ reaction.message.id +"' AND r.`verified` IS NULL";
                const result = await new Promise((resolve, reject) => {
                con.query(sql, function (err, result) {
                    if (err) reject(err);
                        resolve(result);
                    });
                });
                if (result.length == 1) {
                    game = result[0];
                    ladderbotlog(client, `https://discord.com/channels/${game.guild}/${game.channelid}/${game.messageid} Result just got verified`);
                    // Results are verified, lets go and update the standings
                    let sql2 = "UPDATE `"+ mysql_database +"`.`1v1ladder__results` SET `verified` = NOW() WHERE `messageid` = '"+ reaction.message.id +"'";
                    const result2 = await new Promise((resolve, reject) => {
                    con.query(sql2, function (err, result) {
                        if (err) reject(err);
                            resolve(result);
                        });
                    });

                    const guild = await client.guilds.fetch(game.guild);
                    const channel = await guild.channels.fetch(game.channelid);
                    const messageToReact = await channel.messages.fetch(game.messageid);

                    sql2 = "SELECT MAX(`rank`) AS `maxrank` FROM `"+ mysql_database +"`.`1v1ladder__participants`";
                    const maxrank = await new Promise((resolve, reject) => {
                    con.query(sql2, function (err, result) {
                        if (err) reject(err);
                            resolve(result);
                        });
                    });

                    if (game.player1_rank == 0) {
                        game.player1_rank = maxrank[0].maxrank+1;
                    }
                    if (game.player2_rank == 0) {
                        game.player2_rank = maxrank[0].maxrank+1;
                    }

                    if ((game.player1_score > game.player2_score && game.player1_rank > game.player2_rank) || (game.player2_score > game.player1_score && game.player2_rank > game.player1_rank)) {
                        // Switch positions
                        try {
                            await messageToReact.reply(`I have now switched places between <@${game.player1}> and <@${game.player2}>. Keep em' coming 👍`);            
                        } catch (error) {
                            // Handle errors
                            console.error("Error:", error);
                        }
                        ladderbotlog(client, `https://discord.com/channels/${game.guild}/${game.channelid}/${game.messageid} I have now switched places between the players`);

                        // Update
                        let sql3 = "UPDATE `"+ mysql_database +"`.`1v1ladder__participants` SET `rank` = "+ game.player2_rank +" WHERE `discorduserid` = '"+ game.player1 +"'";
                        const result3 = await new Promise((resolve, reject) => {
                        con.query(sql3, function (err, result) {
                            if (err) reject(err);
                                resolve(result);
                            });
                        });

                        // Update
                        let sql4 = "UPDATE `"+ mysql_database +"`.`1v1ladder__participants` SET `rank` = "+ game.player1_rank +" WHERE `discorduserid` = '"+ game.player2 +"'";
                        const result4 = await new Promise((resolve, reject) => {
                        con.query(sql4, function (err, result) {
                            if (err) reject(err);
                                resolve(result);
                            });
                        });
                        

                    } else {
                        ladderbotlog(client, `https://discord.com/channels/${game.guild}/${game.channelid}/${game.messageid} The challenging player lost, so I didnt switch any places`);
                        await messageToReact.reply(`Good luck next time 🥲`);            
                    }

                } else {
                    // The reaction is to something other than a game result, or its already verified
                }
                
                con.end();

            } catch (error) {
                // Handle errors
                console.error("Error:", error);
            }

        }

    }

}


module.exports = {
    reactHandler,
};