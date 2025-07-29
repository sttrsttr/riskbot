var mysql = require('mysql2');
const { mysql_host, mysql_username, mysql_password, mysql_database } = require('../riskbot_config.json');



async function laddercleanup(client) {

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

    let sql_strikeyouareout = "SELECT * FROM `"+ mysql_database +"`.`1v1ladder__participants` WHERE `strike` > 1";
    const strikeout = await new Promise((resolve, reject) => {
    con.query(sql_strikeyouareout, function (err, result) {
        if (err) reject(err);
            resolve(result);
        });
    });
    if (strikeout.length > 0) {
        // Select the first in line
        badplayer = strikeout[0];

		ladderbotlog(client, `${badplayer.username} got two strikes for not accepting any challenges on time and is now rank 0`);
        
        let sqla = "UPDATE `"+ mysql_database +"`.`1v1ladder__participants` SET `strike` = 0, `rank` = 0 WHERE `discorduserid` = "+ badplayer.discorduserid +"";
        const resulta = await new Promise((resolve, reject) => {
            con.query(sqla, function (err, result) {
            if (err) reject(err);
            resolve(result);
            });
        });

        let sqlb = "UPDATE `"+ mysql_database +"`.`1v1ladder__participants` SET `rank` = `rank`-1 WHERE `rank` > "+ badplayer.rank +"";
        const resultb = await new Promise((resolve, reject) => {
            con.query(sqlb, function (err, result) {
            if (err) reject(err);
            resolve(result);
            });
        });


    }

    let sql = "SELECT c.`guild`, c.`channelid`, c.`messageid`, c.`player1`, c.`player2`, p1.`rank` AS `player1_rank`, p2.`rank` AS `player2_rank` FROM `"+ mysql_database +"`.`1v1ladder__challenges` c INNER JOIN `"+ mysql_database +"`.`1v1ladder__participants` p1 ON p1.`discorduserid` = c.`player1` INNER JOIN `"+ mysql_database +"`.`1v1ladder__participants` p2 ON p2.`discorduserid` = c.`player2` AND c.`played` IS NULL AND c.`validto` IS NULL AND c.`deadline` < NOW()";
    const result = await new Promise((resolve, reject) => {
    con.query(sql, function (err, result) {
        if (err) reject(err);
            resolve(result);
        });
    });
    if (result.length > 0) {
        // Select the first game
        game = result[0];
        // Game was not played within deadline, lets shuffle the players

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
        
        const guild = await client.guilds.fetch(game.guild);
        const channel = await guild.channels.fetch(game.channelid);
        const messageToReact = await channel.messages.fetch(game.messageid);
        await messageToReact.reply(`It looks like this game was not played within the deadline, so <@${game.player1}> will be switching places with <@${game.player2}>. Good luck on your next adventures! 👍`);

		ladderbotlog(client, `https://discord.com/channels/${game.guild}/${game.channelid}/${game.messageid} was not played within the deadline, so the players will be switching places`);

        // Update
        let sql3 = "UPDATE `"+ mysql_database +"`.`1v1ladder__participants` SET `rank` = "+ game.player2_rank +" WHERE `discorduserid` = '"+ game.player1 +"'";
        const result3 = await new Promise((resolve, reject) => {
        con.query(sql3, function (err, result) {
            if (err) reject(err);
                resolve(result);
            });
        });

        // Update
        let sql4 = "UPDATE `"+ mysql_database +"`.`1v1ladder__participants` SET `strike` = `strike`+1, `rank` = "+ game.player1_rank +" WHERE `discorduserid` = '"+ game.player2 +"'";
        const result4 = await new Promise((resolve, reject) => {
        con.query(sql4, function (err, result) {
            if (err) reject(err);
                resolve(result);
            });
        });

        sql5 = "UPDATE `"+ mysql_database +"`.`1v1ladder__challenges` SET `validto` = NOW() WHERE `deadline` < NOW() AND (`player1` = "+ game.player1 +" OR `player1` = "+ game.player2 +") AND (`player2` = "+ game.player1 +" OR `player2` = "+ game.player2 +") AND `validto` IS NULL AND `played` IS NULL;";
        const result5 = await new Promise((resolve, reject) => {
        con.query(sql5, function (err, result) {
            if (err) reject(err);
                resolve(result);
            });
        });        
            
    } else {
        // The reaction is to something other than a game result, or its already verified
    }
    
    con.end();

} catch (error) {
    // Handle errors
    console.error("Error:", error);
}

}


module.exports = {
    laddercleanup,
};