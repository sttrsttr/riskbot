const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
const https = require('https');

const { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, RESTJSONErrorCodes } = require('discord.js');
const { httpsPostRequest, httpsGetRequest } = require('./helperfunctions.js');
const inspirationalQuotes = JSON.parse(fs.readFileSync(path.join(__dirname, 'inspirationalQuotes.json'), 'utf8'));
const welcomeMessages = JSON.parse(fs.readFileSync(path.join(__dirname, 'welcomeMessages.json'), 'utf8'));

const UNSCHEDULED_GAMETIME = '4000-01-01 00:00:00';
const UNSCHEDULED_GAMETIME_PREFIX = '4000-01-01';

// Players start out with this karma score and infractions bring it down.
const KARMA_STARTING_SCORE = 100;
// Below this karma score a player may only sign up for events that already
// have KARMA_MIN_PARTICIPANTS participants signed up.
const KARMA_SIGNUP_MINIMUM = 50;
const KARMA_MIN_PARTICIPANTS = 100;

// Function to get a random welcome message
function getRandomWelcomeMessage() {
    const randomIndex = Math.floor(Math.random() * inspirationalQuotes.length);
    return inspirationalQuotes[randomIndex];
}

// Function to get a random welcome message
function getRandomQuote() {
    const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
    return welcomeMessages[randomIndex];
}

function uuidv4() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

function isUnscheduledGametime(gametime) {
    if (!gametime) return false;
    return String(gametime).startsWith(UNSCHEDULED_GAMETIME_PREFIX);
}

function getDiscordTimestamp(gametime) {
    return Math.floor(new Date(gametime).getTime() / 1000);
}

let allowedChannelIds = [];
let chatChannelIds = [];
let announcementChannelsIds = [];

// Fetch a guild member, returning null when Discord says the member is not in the
// guild (10007 Unknown Member, typically because they left) instead of throwing.
// Any other API error is rethrown so it is not silently swallowed.
async function fetchMemberOrNull(guild, userid) {
    try {
        return await guild.members.fetch(userid);
    } catch (error) {
        if (error.code === RESTJSONErrorCodes.UnknownMember || error.code === RESTJSONErrorCodes.UnknownUser) {
            console.log(`Member ${userid} is not in guild ${guild.id} any more`);
            return null;
        }
        throw error;
    }
}

// Fetch a thread, returning null if it is gone instead of throwing.
async function fetchThreadOrNull(channel, threadid) {
    try {
        return await channel.threads.fetch(threadid);
    } catch (error) {
        if (error.code === RESTJSONErrorCodes.UnknownChannel) {
            console.log(`Thread ${threadid} no longer exists in channel ${channel.id}`);
            return null;
        }
        throw error;
    }
}

// API function for swapping users after everything else is handled backend wise
async function swap_users(client, tserver, tchannel, tthread_a, tuser_a, tthread_b, tuser_b, tmessage, staffroleid) {

    try {

        const guild = await client.guilds.fetch(tserver);
        if (!guild) {
            console.log('Guild not found');
            return "GUILD_NOT_FOUND";
        }

        const channel = await guild.channels.fetch(tchannel);
        if (!channel) {
            console.log('Channel not found');
            return "CHANNEL_NOT_FOUND";
        }

        // A player may have left the server between the database swap and this call.
        // Do not abort the whole swap for that - the threads must still be brought in
        // line with the database, and staff need to be told what could not be done.
        const user1 = await fetchMemberOrNull(guild, tuser_a);
        const user2 = await fetchMemberOrNull(guild, tuser_b);

        const thread1 = await fetchThreadOrNull(channel, tthread_a);
        const thread2 = await fetchThreadOrNull(channel, tthread_b);

        if (!thread1 && !thread2) {
            console.log(`Neither thread ${tthread_a} nor ${tthread_b} could be fetched`);
            return "THREAD_NOT_FOUND";
        }

        let notes = '';
        if (!user1) {
            notes += `\n\n⚠️ <@${tuser_a}> is no longer a member of this server, so they could not be added to their new group thread.`;
        }
        if (!user2) {
            notes += `\n\n⚠️ <@${tuser_b}> is no longer a member of this server, so they could not be added to their new group thread.`;
        }
        if (!thread1) {
            notes += `\n\n⚠️ The thread for the group <@${tuser_a}> came from could not be found.`;
        }
        if (!thread2) {
            notes += `\n\n⚠️ The thread for the group <@${tuser_b}> came from could not be found.`;
        }

        const allowedMentions = { users: [tuser_a, tuser_b], repliedUser: false };

        // Add each player to the other group's thread. Each side is independent so one
        // failure does not leave the other half of the swap undone.
        if (thread1 && user2) {
            await thread1.members.add(user2.id).catch(err => {
                console.error(`Could not add ${user2.id} to thread ${tthread_a}: ${err.message}`);
                notes += `\n\n⚠️ Could not add <@${user2.id}> to this thread, please add them manually.`;
            });
        }
        if (thread2 && user1) {
            await thread2.members.add(user1.id).catch(err => {
                console.error(`Could not add ${user1.id} to thread ${tthread_b}: ${err.message}`);
                notes += `\n\n⚠️ Could not add <@${user1.id}> to this thread, please add them manually.`;
            });
        }

        if (thread1) {
            await thread1.send({ content: tmessage + notes, allowedMentions: allowedMentions })
                .catch(err => console.error(`Could not post swap message in thread ${tthread_a}: ${err.message}`));
        }
        if (thread2) {
            await thread2.send({ content: tmessage + notes, allowedMentions: allowedMentions })
                .catch(err => console.error(`Could not post swap message in thread ${tthread_b}: ${err.message}`));
        }

        // Remove the players from their old threads. Members who left the guild are
        // removed from threads by Discord already, so only do this for members we found.
        if (thread1 && user1 && !user1.roles.cache.has(staffroleid)) {
            await thread1.members.remove(user1.id)
                .catch(err => console.error(`Could not remove ${user1.id} from thread ${tthread_a}: ${err.message}`));
        }
        if (thread2 && user2 && !user2.roles.cache.has(staffroleid)) {
            await thread2.members.remove(user2.id)
                .catch(err => console.error(`Could not remove ${user2.id} from thread ${tthread_b}: ${err.message}`));
        }

        if (!user1 || !user2) {
            return "MEMBER_NOT_FOUND";
        }
        if (!thread1 || !thread2) {
            return "THREAD_NOT_FOUND";
        }

        return "SUCCESS";

    } catch (error) {
        console.error('Error fetching guild or channel:', error);
        return "ERROR";
    }

}

async function updateEventChannelIds() {
    try {

        // Reset the array
        chatChannelIds = [];
        announcementChannelsIds = [];
        allowedChannelIds = [];

        https.get('https://friendsofrisk.com/openapi/getEvents', (resp) => {
            let data = '';
            resp.on('data', (chunk) => {
                data += chunk;
            });
            resp.on('end', () => {
                const result = JSON.parse(data);
                // Process the result
                for (const event of result) {
                    allowedChannelIds.push(event.signupchannel);
                    announcementChannelsIds.push(event.mainchannel);
                    chatChannelIds.push(event.textchannel);
                    chatChannelIds.push(event.helpchannel);
                    chatChannelIds.push(event.mainchannel);
                }
            });
        }).on("error", (err) => {
            console.error("Error fetching calendar data: " + err.message);
        });


    } catch (error) {
        // Handle errors
        console.error("Error:", error);
    }
}



async function pingparticipants(message, client) {

    try {

        const options1 = {
            hostname: 'friendsofrisk.com',
            path: '/openapi/getChannelPingLog',
            method: 'POST',
        };

        const postData1 = JSON.stringify({
            channelid: message.channel.id,
            command: 'pingparticipants'
        });

        const res1 = await httpsPostRequest(options1, postData1);

        const history = JSON.parse(res1);
        if (history.length == 0) {

            const options2 = {
                hostname: 'friendsofrisk.com',
                path: '/openapi/getEvent',
                method: 'POST',
            };

            const postData2 = JSON.stringify({
                mainchannelid: message.channel.id
            });

            const res2 = await httpsPostRequest(options2, postData2);

            const events = JSON.parse(res2);
            const event = events[0];


            if (event) {
                const guild = await client.guilds.resolve(event.serverid);
                const channel = await guild.channels.fetch(message.channel.id);
                const role = await guild.roles.fetch(event.participantrole);

                if (channel && role) {
                    await channel.send({ content: `Attention <@&${role.id}>, please read the message above`, allowedMentions: { roles: [role.id], repliedUser: false } });
    
                    const options3 = {
                        hostname: 'friendsofrisk.com',
                        path: '/m2mapi/addChannelPingLog',
                        method: 'POST',
                        headers: {
                            'X-API-KEY': global.config.for_api_key
                        }
                    };

                    const postData3 = JSON.stringify({
                        channelid: message.channel.id,
                        command: 'pingparticipants'
                    });

                    await httpsPostRequest(options3, postData3);
                }
            }
        }   

    } catch (error) {
        // Handle errors
        console.error("Error:", error);
    }
}


async function pingstaff(message, client) {

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

        sql = "SELECT * FROM `" + global.config.mysql_database + "`.`eventmanager__events` WHERE `mainchannel` = " + message.channel.parentId + " OR `helpchannel` = " + message.channel.id + " OR `textchannel` = " + message.channel.id + "";
        const events = await new Promise((resolve, reject) => {
            con.query(sql, function (err, result) {
                if (err) reject(err);
                resolve(result);
            });
        });
        const event = events[0];

        if (event) {
            const guild = await client.guilds.resolve(event.serverid);
            const channel = await guild.channels.fetch(message.channel.id);
            const role = await guild.roles.fetch(event.staffrole);

            await channel.send(`<@${message.author.id}> please use the /staff command instead, because Discord dont allow us to use !staff any more.`);

        }

        con.end();

    } catch (error) {
        // Handle errors
        console.error("Error:", error);
    }
}


async function pingwaitlist(client, thread) {

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

        let sql = "SELECT br.`noshowrole`, br.`bracketid`, br.`bracketname`, e.`serverid`, e.`helpchannel`, e.`waitlistrole`, e.`waitlistbracket`, eg.`name`, eg.`gametime`, eg.`id` FROM `" + global.config.mysql_database + "`.`eventmanager__groups` eg INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__events` e ON r.`eventid` = e.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__brackets` br ON br.`eventid` = e.`id` AND br.`bracketid` = r.`bracket` AND eg.`threadid` = '" + thread.id + "' AND eg.`completed` IS NULL AND (eg.`waitlistpinged` IS NULL OR DATE_ADD(NOW(), INTERVAL -10 MINUTE) > eg.`waitlistpinged`)";
        const result = await new Promise((resolve, reject) => {
            con.query(sql, function (err, result) {
                if (err) reject(err);
                resolve(result);
            });
        });
        const group = result[0];
        if (group) {

            const guild = await client.guilds.resolve(group.serverid);
            const waitlistrole = await guild.roles.fetch(group.waitlistrole);
            const noshowrole = await guild.roles.fetch(group.noshowrole);

            let mention;
            let mentionroles;

            if (waitlistrole && group.waitlistbracket <= group.bracketid) {
                mention = `<@&${waitlistrole.id}> <@&${noshowrole.id}>`
                mentionroles = [waitlistrole.id, noshowrole.id];
            } else if (noshowrole) {
                mention = `<@&${noshowrole.id}>`
                mentionroles = [noshowrole.id];
            }

            if (mentionroles) {

                let message;
                if (isUnscheduledGametime(group.gametime)) {
                    message = `Attention ${mention} there is probably an open spot in ${group.name}.\n\nThis group is currently unscheduled, so please coordinate a game time with the players and event staff after joining.\n\nFirst come first serve, click this button to join this group!`;
                } else {
                    const timestamp = getDiscordTimestamp(group.gametime);
                    message = `Attention ${mention} there is probably an open spot in ${group.name} starting in <t:${timestamp}:R>\n\nFirst come first serve, click this button to join this group!`;
                }

                const btn1 = new ButtonBuilder()
                    .setCustomId('joingroupfromwaitlist')
                    .setLabel('Join group')
                    .setStyle(ButtonStyle.Success);
                const channel = await guild.channels.fetch(group.helpchannel);
                let components = [];
                const row = new ActionRowBuilder().addComponents(btn1);
                components.push(row);

                const pingmessageid = await channel.send({ content: message, components: components, allowedMentions: { roles: mentionroles, repliedUser: false } });

                sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__groups` SET `waitlistpinged` = NOW(), `pingmessageid` = " + pingmessageid + " WHERE `id` = " + group.id + "";
                const result2 = await new Promise((resolve, reject) => {
                    con.query(sql, function (err, result) {
                        if (err) reject(err);
                        resolve(result);
                    });
                });
            }
        }
        con.end();
    } catch (error) {
        console.error(error);
    }
}


// Karma is stored as infraction points that are always negative and never sum
// above zero, so a players score is the starting score plus that sum.
async function getKarmaScore(con, userid) {

    const sql = "SELECT SUM(`points`) AS `sum` FROM `" + global.config.mysql_database + "`.`karmapoints` WHERE `playerid` = " + userid + "";
    const result = await new Promise((resolve, reject) => {
        con.query(sql, function (err, result) {
            if (err) reject(err);
            resolve(result);
        });
    });

    let sum = 0;
    if (result[0] && result[0].sum) {
        sum = parseInt(result[0].sum);
    }

    return KARMA_STARTING_SCORE + sum;
}


// Number of players currently signed up for an event, waitlisted players included.
async function countEventSignups(con, eventid) {

    const sql = "SELECT COUNT(*) AS `signups` FROM `" + global.config.mysql_database + "`.`eventmanager__signups` WHERE `eventid` = " + eventid + " AND `validto` IS NULL";
    const result = await new Promise((resolve, reject) => {
        con.query(sql, function (err, result) {
            if (err) reject(err);
            resolve(result);
        });
    });

    if (result[0] && result[0].signups) {
        return parseInt(result[0].signups);
    }

    return 0;
}


async function signupHandler(interaction, client) {

    // Allow this handler to run as a button interaction without an explicit client argument
    client = client || global.client;

    try {

        // Acknowledge the button press with an ephemeral message so only the user sees the replies
        await interaction.reply({ content: `Please stand by while I sign you up...`, flags: 64 });

        const userid = interaction.user.id;

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


        let sql = "SELECT * FROM `" + global.config.mysql_database + "`.`eventmanager__events` WHERE `signupchannel` = " + interaction.channelId + "";
        const events = await new Promise((resolve, reject) => {
            con.query(sql, function (err, result) {
                if (err) reject(err);
                resolve(result);
            });
        });
        const event = events[0];

        if (event) {
            const guild = await client.guilds.resolve(event.serverid);
            const member = await guild.members.fetch(userid);

            sql = "SELECT * FROM `" + global.config.mysql_database + "`.`eventmanager__signups` WHERE `eventid` = " + event.id + " AND `playerid` = " + userid + "";
            const signedup = await new Promise((resolve, reject) => {
                con.query(sql, function (err, result) {
                    if (err) reject(err);
                    resolve(result);
                });
            });
            if (signedup.length > 0) {

                sql = "SELECT * FROM `" + global.config.mysql_database + "`.`eventmanager__signups` WHERE `eventid` = " + event.id + " AND `playerid` = " + userid + " AND `repeated_myself` > DATE_ADD(NOW(), INTERVAL -1 DAY)";
                const notify = await new Promise((resolve, reject) => {
                    con.query(sql, function (err, result) {
                        if (err) reject(err);
                        resolve(result);
                    });
                });
                if (notify.length == 0) {

                    await interaction.followUp({ content: `You have already signed up for ${event.name}`, flags: 64 });

                    sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__signups` SET `repeated_myself` = NOW() WHERE `eventid` = " + event.id + " AND `playerid` = " + userid + "";
                    const repated = await new Promise((resolve, reject) => {
                        con.query(sql, function (err, result) {
                            if (err) reject(err);
                            resolve(result);
                        });
                    });
                } else {
                    console.log(`Already notified ${userid}`);
                }

            } else {

                if (event.signupstatus == "CLOSED") {

                    const responses = [
                        "Oof! Just a bit too late. Signups for this event are now closed. 😔",
                        "Missed it by *that* much! Signups are closed now. 🚪",
                        "Dang, signups just wrapped up! Maybe next time? 🤷",
                        "Oh no! The tournament signups just closed. 😢",
                        "Looks like you're fashionably late... but signups are closed! 🕰️",
                        "Yikes, signups ended right before you got here! 😬",
                        "You *almost* made it, but signups are officially closed. Better luck next time! 🏆",
                        "Oh snap, you just missed the deadline! Keep an eye out for the next one! 👀",
                        "Signups are locked in, and unfortunately, you're just outside the door. 🚪",
                        "Sorry, signups are closed! But hey, there's always next time. 😉",
                        "Oops! Just a bit too late. Maybe try again next event? 🤞",
                        "The gates are shut! Signups for this one are over. 🏰",
                        "If only you had clicked a second earlier! But signups are closed. 😩",
                        "Signups closed faster than you could type! But don't worry, more events are coming! 🔜",
                        "Too slow! The signup window just closed. 🏃‍♂️💨",
                        "You just missed it! But stay tuned for future tournaments! 📢",
                        "Late to the party! Signups are closed, but we'll catch you next time! 🎉",
                        "Sorry, signups ended just before you arrived. 😕 Keep an eye out for the next one!",
                        "Missed it this time, but we’ll save you a seat for the next event. 😉",
                        "Tough luck! Signups are locked, but there’s always next time! 🔄",
                        "If only you were a few minutes earlier! Signups are now closed. ⏳",
                        "Welp, that’s a wrap! Signups are over. 🎬",
                        "Sorry, no late entries allowed! Signups are done for now. 🚫",
                        "Too little, too late! Signups just closed. 😵‍💫",
                        "Oh no, just missed it! Maybe next time? 🤖"
                    ];

                    await interaction.followUp({ content: responses[Math.floor(Math.random() * responses.length)], flags: 64 });

                } else {


                    let availerror = 0;

                    let blsql = "SELECT * FROM `" + global.config.mysql_database + "`.`eventmanager__blacklists` WHERE `eventid` = " + event.id + " AND `playerid` = " + userid + " AND `validto` IS NULL";
                    const blacklisted = await new Promise((resolve, reject) => {
                        con.query(blsql, function (err, result) {
                            if (err) reject(err);
                            resolve(result);
                        });
                    });
                    // Low karma players are only let into events that already have a
                    // decent number of participants signed up
                    const karmascore = await getKarmaScore(con, userid);
                    const signupcount = await countEventSignups(con, event.id);
                    const lowkarma = karmascore < KARMA_SIGNUP_MINIMUM && signupcount < KARMA_MIN_PARTICIPANTS;

                    if (blacklisted.length > 0) {
                        await interaction.followUp({ content: `You are not able to sign up for ${event.name}. Please contact event staff if you have any questions.`, flags: 64 });
                    } else if (lowkarma) {

                        await interaction.followUp({ content: `You are **not** signed up for ${event.name}.\n\nYour karma score is **${karmascore}**, and with a karma score below ${KARMA_SIGNUP_MINIMUM} you can only sign up for events that already have at least ${KARMA_MIN_PARTICIPANTS} participants signed up. This event currently has ${signupcount}.\n\nYou can check your karma at https://friendsofrisk.com/karma/ or contact event staff if you have any questions.`, flags: 64 });

                        sql = "INSERT INTO `" + global.config.mysql_database + "`.`eventmanager__playerlog` VALUES (NULL," + userid + "," + event.id + ",NOW(),'Signup blocked','Karma " + karmascore + " with " + signupcount + " signups',NULL,NULL)";
                        await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });

                    } else {



                        sql = "SELECT 1 FROM `" + global.config.mysql_database + "`.`users` u WHERE u.`discordid` = " + userid + "";
                        const exists = await new Promise((resolve, reject) => {
                            con.query(sql, function (err, result) {
                                if (err) reject(err);
                                resolve(result);
                            });
                        });

                        if (exists.length == 0) {

                            const username = member.nickname || member.user.globalName || member.user.username;

                            // Remove any ' characters from username
                            const sanitizedUsername = username.replace(/'/g, "");

                            const guid = uuidv4().toUpperCase();
                            let sql = "INSERT INTO `" + global.config.mysql_database + "`.`users` (`name`, `discordid`, `guid`, `guid_validto`) VALUES ('" + sanitizedUsername + "','" + member.id + "','" + guid + "',DATE_ADD(NOW(), INTERVAL +1 WEEK));";
                            try {
                                const result = await new Promise((resolve, reject) => {
                                    con.query(sql, function (err, result) {
                                        if (err) reject(err);
                                        resolve(result);
                                    });
                                });
                                const insertedId = result.insertId;
                                if (insertedId) {
                                    if (event.requireavailability == 1) {
                                        availerror = 1;
                                    }
                                } else {
                                    //      await message.reply(`Something went horribly wrong, or I am stupid. Please reach out to someone for help with this`); // Is it really a problem? If we dont require availability, we can go fine without FoR user as well.
                                }
                            } catch (error) {
                                // Handle errors
                                console.error("Error:", error);
                            }


                        }


                        if (event.requireavailability == 1 && availerror == 0) {

                            sql = "SELECT 1 FROM `" + global.config.mysql_database + "`.`users` u INNER JOIN `" + global.config.mysql_database + "`.`user__availability` ua ON u.`id` = ua.`userid` AND u.`discordid` = " + userid + "";
                            const availability = await new Promise((resolve, reject) => {
                                con.query(sql, function (err, result) {
                                    if (err) reject(err);
                                    resolve(result);
                                });
                            });
                            if (availability.length > 0) {
                                availerror = 0;
                            } else {
                                availerror = 1;
                            }
                        }

                        if (availerror == 0) {

                            let badgeissue = 0;

                            if (event.badgerequired > 0) {
                                // Check for badges

                                sql = "SELECT * FROM `" + global.config.mysql_database + "`.`user__merits` um INNER JOIN `" + global.config.mysql_database + "`.`users` u ON u.`id` = um.`userid` AND um.`validto` IS NULL AND um.`merit` = " + event.badgerequired + " AND u.`discordid` = " + userid + "";
                                const hasbadge = await new Promise((resolve, reject) => {
                                    con.query(sql, function (err, result) {
                                        if (err) reject(err);
                                        resolve(result);
                                    });
                                });

                                if (!hasbadge || hasbadge.length === 0) {
                                    badgeissue = 1;
                                }

                            }


                            if (badgeissue == 1) {

                                sql = "SELECT * FROM `" + global.config.mysql_database + "`.`merits` WHERE `id` = " + event.badgerequired + "";
                                const badgeres = await new Promise((resolve, reject) => {
                                    con.query(sql, function (err, result) {
                                        if (err) reject(err);
                                        resolve(result);
                                    });
                                });
                                const badgeinfo = badgeres[0];

                                await interaction.followUp({ content: `I am so sorry, but it does not look like you have the required FoR badge ${badgeinfo.name} that is required to sign up for this tourney.\nHow to get this badge:\n1) Link your Risk Friend ID to your FoR profile\n2) ${badgeinfo.description}\n3) Wait up to 24 hours for badges to be awarded or contact staff`, flags: 64 });

                            } else {

                                const helpthread = await guild.channels.fetch(event.helpchannel);
                                const chatthread = await guild.channels.fetch(event.textchannel);

                                if (helpthread.type === ChannelType.PublicThread || helpthread.type === ChannelType.PrivateThread || helpthread.type === ChannelType.AnnouncementThread) {
                                    helpthread.members.add(member).catch(err => console.error(`Could not add ${member.id} to help thread ${event.helpchannel}: ${err.message}`));
                                }

                                if (chatthread.type === ChannelType.PublicThread || chatthread.type === ChannelType.PrivateThread || chatthread.type === ChannelType.AnnouncementThread) {
                                    chatthread.members.add(member).catch(err => console.error(`Could not add ${member.id} to chat thread ${event.textchannel}: ${err.message}`));
                                }

                                const randomMessage = getRandomWelcomeMessage();
                                if (event.signupstatus == 'WAITLIST') {
                                    sql = "INSERT INTO `" + global.config.mysql_database + "`.`eventmanager__signups` VALUES (NULL," + event.id + "," + userid + ",NOW(),NULL,NOW(),NULL,NULL,1,NULL,1)";
                                    if (event.participantrole) {
                                        const participantrole = await guild.roles.fetch(event.participantrole);
                                        if (participantrole) {
                                            await member.roles.add(participantrole);
                                        }
                                    }
                                    if (event.waitlistrole) {
                                        const waitlistrole = await guild.roles.fetch(event.waitlistrole);
                                        if (waitlistrole) {
                                            await member.roles.add(waitlistrole);
                                        }
                                    }
                                } else {
                                    sql = "INSERT INTO `" + global.config.mysql_database + "`.`eventmanager__signups` VALUES (NULL," + event.id + "," + userid + ",NOW(),NULL,NULL,NULL,NULL,1,NULL,1)";
                                    if (event.participantrole) {
                                        const participantrole = await guild.roles.fetch(event.participantrole);
                                        if (participantrole) {
                                            await member.roles.add(participantrole);
                                        }
                                    }
                                }
                                const signup = await new Promise((resolve, reject) => {
                                    con.query(sql, function (err, result) {
                                        if (err) reject(err);
                                        resolve(result);
                                    });
                                });
                                if (signup) {
                                    if (event.signupstatus == 'WAITLIST') {
                                        await interaction.followUp({ content: `You are now put on the waiting list for ${event.name}. You will be pinged if there is an opening for you. View all signups at https://friendsofrisk.com/eventmanager/${event.id}/`, flags: 64 });
                                    } else {
                                        await interaction.followUp({ content: `You are now signed up for ${event.name}. ${randomMessage} View all signups at https://friendsofrisk.com/eventmanager/${event.id}/`, flags: 64 });
                                    }
                                    sql = "INSERT INTO `" + global.config.mysql_database + "`.`eventmanager__playerlog` VALUES (NULL," + userid + "," + event.id + ",NOW(),'Signed up','Using Discord',NULL,NULL)";
                                    await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });
                                } else {
                                    await interaction.followUp({ content: `There was a problem signing you up... please ask for help`, flags: 64 });
                                }

                            }


                        } else {

                            sql = "INSERT INTO `" + global.config.mysql_database + "`.`eventmanager__signups_failed` VALUES (NULL," + event.id + "," + userid + ",NOW())";
                            await new Promise((resolve, reject) => {
                                con.query(sql, function (err, result) {
                                    if (err) reject(err);
                                    resolve(result);
                                });
                            });

                            const confirm = new ButtonBuilder()
                                .setCustomId('availability')
                                .setLabel('Set up availability')
                                .setStyle(ButtonStyle.Primary);

                            const row = new ActionRowBuilder()
                                .addComponents(confirm);
                            await interaction.followUp({ content: `Oops! You don't have any availability set up at friendsofrisk.com. Please click this button to complete your sign up`, components: [row], flags: 64 });
                        }
                    }
                }
            }
        }
        con.end();

    } catch (error) {
        // Handle errors
        console.error("Error:", error);
    }
}





async function updateSignupStatus(client, eventid, status) {

    try {

        // Only allow the three known signup statuses
        const validStatuses = ['OPEN', 'WAITLIST', 'CLOSED'];
        if (!validStatuses.includes(status)) {
            return "INVALID_STATUS";
        }

        // Resolve the event via the API. The website already persists the new
        // signupstatus, so no database access is needed here.
        const res = await httpsGetRequest({
            hostname: 'friendsofrisk.com',
            path: '/openapi/getEvents',
            method: 'GET',
        });
        const events = JSON.parse(res);
        const event = events.find(e => String(e.id) === String(eventid));

        if (!event) {
            return "EVENT_NOT_FOUND";
        }

        const guild = await client.guilds.resolve(event.serverid);
        const channel = await guild.channels.fetch(event.signupchannel);
        const message = await channel.messages.fetch(event.signupmessage);

        // Rebuild the self service buttons (same as create-event)
        const availability = new ButtonBuilder()
            .setCustomId('availability')
            .setLabel('Set up your availability')
            .setStyle(ButtonStyle.Primary);

        const rules = new ButtonBuilder()
            .setCustomId('rulesinfo')
            .setLabel('Rules and info')
            .setStyle(ButtonStyle.Primary);

        const contactstaff = new ButtonBuilder()
            .setCustomId('contactstaff')
            .setLabel('Contact staff')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder();

        // Add the signup button depending on the new status (no button when CLOSED)
        if (status == 'OPEN') {
            const signup = new ButtonBuilder()
                .setCustomId('signup')
                .setLabel('Sign up')
                .setStyle(ButtonStyle.Success);
            row.addComponents(signup);
        } else if (status == 'WAITLIST') {
            const signup = new ButtonBuilder()
                .setCustomId('signup')
                .setLabel('Join waitlist')
                .setStyle(ButtonStyle.Success);
            row.addComponents(signup);
        }

        row.addComponents(availability, rules, contactstaff);

        const content = `# Self service channel\n\nPlease use the buttons below to interact with this event.\n\n## Signup status: ${status}`;

        await message.edit({ content: content, components: [row] });

        return "SUCCESS";

    } catch (error) {
        // Handle errors
        console.error("Error:", error);
        return "ERROR";
    }
}


// Posts a FRESH commands/self-service message (with the signup buttons) into the event's
// signup thread and returns the new message id. Used by the website when a site admin
// repoints the signup channel id at a new thread. Reads the saved channel id and the
// current signup status via the openapi, same as updateSignupStatus - the caller stores
// the returned id as the event's signupmessage.
async function sendSignupMessage(client, eventid) {

    try {

        // Resolve the event via the API - the website has already saved the new channel id
        const res = await httpsGetRequest({
            hostname: 'friendsofrisk.com',
            path: '/openapi/getEvents',
            method: 'GET',
        });
        const events = JSON.parse(res);
        const event = events.find(e => String(e.id) === String(eventid));

        if (!event) {
            return { error: "EVENT_NOT_FOUND" };
        }
        if (!event.signupchannel) {
            return { error: "NO_SIGNUP_CHANNEL" };
        }

        const guild = await client.guilds.resolve(event.serverid);
        const channel = await guild.channels.fetch(event.signupchannel);

        // Same buttons as updateSignupStatus, driven by the event's current signup status
        const validStatuses = ['OPEN', 'WAITLIST', 'CLOSED'];
        const status = validStatuses.includes(event.signupstatus) ? event.signupstatus : 'CLOSED';

        const availability = new ButtonBuilder()
            .setCustomId('availability')
            .setLabel('Set up your availability')
            .setStyle(ButtonStyle.Primary);

        const rules = new ButtonBuilder()
            .setCustomId('rulesinfo')
            .setLabel('Rules and info')
            .setStyle(ButtonStyle.Primary);

        const contactstaff = new ButtonBuilder()
            .setCustomId('contactstaff')
            .setLabel('Contact staff')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder();

        if (status == 'OPEN') {
            const signup = new ButtonBuilder()
                .setCustomId('signup')
                .setLabel('Sign up')
                .setStyle(ButtonStyle.Success);
            row.addComponents(signup);
        } else if (status == 'WAITLIST') {
            const signup = new ButtonBuilder()
                .setCustomId('signup')
                .setLabel('Join waitlist')
                .setStyle(ButtonStyle.Success);
            row.addComponents(signup);
        }

        row.addComponents(availability, rules, contactstaff);

        const content = `# Self service channel\n\nPlease use the buttons below to interact with this event.\n\n## Signup status: ${status}`;

        const message = await channel.send({ content: content, components: [row] });

        return { signupmessageid: message.id };

    } catch (error) {
        console.error("Error:", error);
        return { error: "ERROR" };
    }
}


async function eventmanagerCheckinStart(client) {

    try {


        // Connect to SQL database and fetch various config stuff
        const con = mysql.createConnection({
            host: global.config.mysql_host,
            user: global.config.mysql_username,
            password: global.config.mysql_password,
            supportBigNumbers: true,
            bigNumberStrings: true
        });

        // Wrap connection and query in Promises to use async/await
        await new Promise((resolve, reject) => {
            con.connect(err => {
                if (err) return reject(err);
                resolve();
            });
        });

        let sql = "SELECT e.`serverid`, eg.`name`, eg.`gametime`, eg.`id`, eg.`threadid` FROM `" + global.config.mysql_database + "`.`eventmanager__groups` eg INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__events` e ON r.`eventid` = e.`id` AND eg.`threadid` IS NOT NULL AND e.`validto` IS NULL AND eg.`completed` IS NULL AND e.`checkinsystem` = 1 AND eg.`checkinmessageid` IS NULL AND eg.`checkindone` IS NULL AND eg.`gametime` BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 45 MINUTE)";
        const result = await new Promise((resolve, reject) => {
            con.query(sql, (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        // Process the result
        for (const group of result) {

            const guild = await client.guilds.resolve(group.serverid);
            const thread = await guild.channels.fetch(group.threadid);

            if (thread) {
                sql = "SELECT `playerid` FROM `" + global.config.mysql_database + "`.`eventmanager__groupmembers` WHERE `groupid` = " + group.id + " AND `validto` IS NULL ORDER BY `playerid` ASC";
                const players = await new Promise((resolve, reject) => {
                    con.query(sql, (err, result) => {
                        if (err) return reject(err);
                        resolve(result);
                    });
                });

                const date = new Date(group.gametime);
                let message = `Checkin starting now `;
                for (const player of players) {
                    message = message + `<@${player.playerid}> `;
                }

                const playerIds = players.map(player => player.playerid);
                const messageid = await thread.send({ content: message, components: [], allowedMentions: { users: playerIds, repliedUser: false } });

                sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__groups` SET `checkinmessageid` = " + messageid + " WHERE `id` = " + group.id + "";
                await new Promise((resolve, reject) => {
                    con.query(sql, (err, result) => {
                        if (err) return reject(err);
                        resolve(result);
                    });
                });

                await updatecheckinmessage(thread);
                await messageid.pin();

            }

        }

        // Close MySQL connection
        await new Promise((resolve, reject) => {
            con.end(err => {
                if (err) return reject(err);
                resolve();
            });
        });



    } catch (error) {
        // Handle errors
        console.error("Error:", error);
    }
}




async function eventmanager24hourping(client) {

    try {


        // Connect to SQL database and fetch various config stuff
        const con = mysql.createConnection({
            host: global.config.mysql_host,
            user: global.config.mysql_username,
            password: global.config.mysql_password,
            supportBigNumbers: true,
            bigNumberStrings: true
        });

        // Wrap connection and query in Promises to use async/await
        await new Promise((resolve, reject) => {
            con.connect(err => {
                if (err) return reject(err);
                resolve();
            });
        });

        let sql = "SELECT e.`serverid`, eg.`name`, eg.`gametime`, eg.`id`, eg.`threadid` FROM `" + global.config.mysql_database + "`.`eventmanager__groups` eg INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__events` e ON r.`eventid` = e.`id` AND e.`validto` IS NULL AND eg.`threadid` IS NOT NULL AND eg.`completed` IS NULL AND eg.`created` < DATE_ADD(NOW(), INTERVAL -1 HOUR) AND (eg.`lastping` IS NULL OR eg.`lastping` < DATE_ADD(NOW(), INTERVAL -12 HOUR)) AND eg.`gametime` BETWEEN DATE_ADD(NOW(), INTERVAL 23 HOUR) AND DATE_ADD(NOW(), INTERVAL 1 DAY)";
        const result = await new Promise((resolve, reject) => {
            con.query(sql, (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        // Process the result
        for (const group of result) {

            const guild = await client.guilds.resolve(group.serverid);
            const thread = await guild.channels.fetch(group.threadid);

            if (thread) {
                sql = "SELECT `playerid` FROM `" + global.config.mysql_database + "`.`eventmanager__groupmembers` WHERE `groupid` = " + group.id + " AND `validto` IS NULL ORDER BY `playerid` ASC";
                const players = await new Promise((resolve, reject) => {
                    con.query(sql, (err, result) => {
                        if (err) return reject(err);
                        resolve(result);
                    });
                });

                const date = new Date(group.gametime);
                let message = `24 HOUR REMINDER\n\nYour game is scheduled for <t:${date.getTime() / 1000}:F> which is in <t:${date.getTime() / 1000}:R> `;
                for (const player of players) {
                    message = message + `<@${player.playerid}> `;
                }

                const playerIds = players.map(player => player.playerid);

                const btn1 = new ButtonBuilder()
                    .setCustomId('pinghelp')
                    .setLabel('Ping event staff')
                    .setStyle(ButtonStyle.Danger);

                const btn2 = new ButtonBuilder()
                    .setCustomId('cantmakeit')
                    .setLabel('I cannot make it')
                    .setStyle(ButtonStyle.Danger);

                const btn3 = new ButtonBuilder()
                    .setCustomId('rulesinfo')
                    .setLabel('Rules&info')
                    .setStyle(ButtonStyle.Primary);

                let components = [];
                const row = new ActionRowBuilder().addComponents(btn1).addComponents(btn2).addComponents(btn3);
                components.push(row);

                const messageid = await thread.send({ content: message, components: components, allowedMentions: { users: playerIds, repliedUser: false } });

                sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__groups` SET `lastping` = NOW() WHERE `id` = " + group.id + "";
                await new Promise((resolve, reject) => { con.query(sql, (err, result) => { if (err) return reject(err); resolve(result); }); });

            } else {
                console.log("Unable to find thread " + group.threadid)
            }


        }

        // Close MySQL connection
        await new Promise((resolve, reject) => {
            con.end(err => {
                if (err) return reject(err);
                resolve();
            });
        });



    } catch (error) {
        // Handle errors
        console.error("Error:", error);
    }
}




async function eventmanager48hourping(client) {

    try {


        // Connect to SQL database and fetch various config stuff
        const con = mysql.createConnection({
            host: global.config.mysql_host,
            user: global.config.mysql_username,
            password: global.config.mysql_password,
            supportBigNumbers: true,
            bigNumberStrings: true
        });

        // Wrap connection and query in Promises to use async/await
        await new Promise((resolve, reject) => {
            con.connect(err => {
                if (err) return reject(err);
                resolve();
            });
        });

        let sql = "SELECT e.`serverid`, eg.`name`, eg.`gametime`, eg.`id`, eg.`threadid`, e.`helpchannel`, e.`textchannel`, r.`eventid`, eg.`roundid` FROM `" + global.config.mysql_database + "`.`eventmanager__groups` eg INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__events` e ON r.`eventid` = e.`id` AND e.`validto` IS NULL AND eg.`threadid` IS NOT NULL AND eg.`completed` IS NULL AND eg.`created` < DATE_ADD(NOW(), INTERVAL -1 DAY) AND (eg.`lastping` IS NULL OR eg.`lastping` < DATE_ADD(NOW(), INTERVAL -2 DAY)) AND eg.`gametime` BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 DAY)";
        const result = await new Promise((resolve, reject) => {
            con.query(sql, (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        // Process the result
        for (const group of result) {

            const guild = await client.guilds.resolve(group.serverid);
            const thread = await guild.channels.fetch(group.threadid);

            if (thread) {

                sql = "SELECT `playerid` FROM `" + global.config.mysql_database + "`.`eventmanager__groupmembers` WHERE `groupid` = " + group.id + " AND `validto` IS NULL ORDER BY `playerid` ASC";
                const players = await new Promise((resolve, reject) => {
                    con.query(sql, (err, result) => {
                        if (err) return reject(err);
                        resolve(result);
                    });
                });

                const date = new Date(group.gametime);
                const randomquote = getRandomQuote();
                let message = `I am just jumping in to remind you all that this groups game is scheduled for <t:${date.getTime() / 1000}> (your local timezone) which is in <t:${date.getTime() / 1000}:R>.\n\nIf you need some information, have any questions or just want to chat about the event please take a look at these links:\n\n🗣 [Discord Tournament Chat](https://discord.com/channels/${guild.id}/${group.textchannel})\n👋 [Discord Tournament Help](https://discord.com/channels/${guild.id}/${group.helpchannel})\n👀 [View all groups this round](https://friendsofrisk.com/eventmanager/${group.eventid}/rounds/${group.roundid})\n<:for:1292550710285828261> [Tournament website](https://friendsofrisk.com/eventmanager/${group.eventid})\n\n You can also use the buttons below at any time.\n## ${randomquote}`;

                const btn1 = new ButtonBuilder()
                    .setCustomId('pinghelp')
                    .setLabel('Ping event staff')
                    .setStyle(ButtonStyle.Danger);

                const btn2 = new ButtonBuilder()
                    .setCustomId('cantmakeit')
                    .setLabel('I cannot make it')
                    .setStyle(ButtonStyle.Danger);

                const btn3 = new ButtonBuilder()
                    .setCustomId('rulesinfo')
                    .setLabel('Rules&info')
                    .setStyle(ButtonStyle.Primary);

                let components = [];
                const row = new ActionRowBuilder().addComponents(btn1).addComponents(btn2).addComponents(btn3);
                components.push(row);

                const messageid = await thread.send({ content: message, components: components, allowedMentions: { repliedUser: false } });

                sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__groups` SET `lastping` = NOW() WHERE `id` = " + group.id + "";
                await new Promise((resolve, reject) => { con.query(sql, (err, result) => { if (err) return reject(err); resolve(result); }); });

            } else {
                console.log("Finner ikke thread " + group.threadid);
            }


        }

        // Close MySQL connection
        await new Promise((resolve, reject) => {
            con.end(err => {
                if (err) return reject(err);
                resolve();
            });
        });



    } catch (error) {
        // Handle errors
        console.error("Error:", error);
    }
}


async function lockThread(client, serverid, channelid, threadid) {
    try {
        // Fetch the guild (server)
        const guild = await client.guilds.fetch(serverid);
        if (!guild) {
            console.log('Guild not found');
            return;
        }

        // Fetch the thread within the channel
        const thread = await guild.channels.fetch(threadid);
        if (!thread) {
            console.log('Thread not found');
            return;
        }

        if (thread && thread.type === ChannelType.PublicThread || thread.type === ChannelType.PrivateThread || thread.type === ChannelType.AnnouncementThread) {
            // Lock and archive the thread (optional)
            await thread.setLocked(true);
            await thread.setArchived(true);
        }
        //        console.log(`Thread ${threadid} has been locked successfully.`);

    } catch (error) {
        console.error(`Error locking thread: ${error.message}`);
    }
}


// API functions
async function addThreadMember(guild, thread, userid) {
    try {

        if (thread && thread.type === ChannelType.PublicThread || thread.type === ChannelType.PrivateThread || thread.type === ChannelType.AnnouncementThread) {
            const member = await guild.members.fetch(userid);
            thread.members.add(member)
                .then(() => {
                    //				console.log(`Added ${member.user.tag} to the thread.`);
                })
                .catch(console.error);
        }
    } catch (error) {
        console.error(error.message);
    }
}


async function eventmanagerwelcomethreads(client) {

    try {

        // Connect to SQL database and fetch various config stuff
        const con = mysql.createConnection({
            host: global.config.mysql_host,
            user: global.config.mysql_username,
            password: global.config.mysql_password,
            supportBigNumbers: true,
            bigNumberStrings: true
        });

        // Wrap connection and query in Promises to use async/await
        await new Promise((resolve, reject) => {
            con.connect(err => {
                if (err) return reject(err);
                resolve();
            });
        });

        let sql = "SELECT eg.`id`, e.`serverid`, e.`mainchannel`, eg.`threadid`, r.`roundname`, eg.`name`, r.`bracket`, br.`bracketname`, r.`threadmessage`, eg.`gametime`, r.`game1_settings`, r.`game2_settings`, r.`game3_settings`, r.`game4_settings`, r.`game5_settings`, r.`game6_settings` FROM `" + global.config.mysql_database + "`.`eventmanager__groups` eg INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__brackets` br ON r.`bracket` = br.`bracketid` AND r.`eventid` = br.`eventid` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__events` e ON r.`eventid` = e.`id` AND e.`validto` IS NULL AND eg.`threadid` IS NOT NULL AND eg.`completed` IS NULL AND eg.`threadlocked` IS NULL AND eg.`welcomed` IS NULL LIMIT 0,10";
        const result = await new Promise((resolve, reject) => { con.query(sql, (err, result) => { if (err) return reject(err); resolve(result); }); });

        for (const group of result) {

            const guild = await client.guilds.resolve(group.serverid);
            const thread = await guild.channels.fetch(group.threadid);

            let attachments = [];
            let components = [];

            const unscheduled = isUnscheduledGametime(group.gametime);

            // Prepare the message by replacing placeholders
            let threadmessage = group.threadmessage;
            if (unscheduled) {
                threadmessage = threadmessage.replace(/\B(##GAMETIME##)\B/i, `Unscheduled (PLEASE SCHEDULE ASAP AND CONTACT STAFF)`);
                threadmessage = threadmessage.replace(/\B(##COUNTDOWN##)\B/i, `No game time set yet`);
            } else {
                const timestamp = getDiscordTimestamp(group.gametime);
                threadmessage = threadmessage.replace(/\B(##GAMETIME##)\B/i, `<t:${timestamp}:F>`);
                threadmessage = threadmessage.replace(/\B(##COUNTDOWN##)\B/i, `<t:${timestamp}:R>`);
            }

            // Prepare settings URLs
            const rounds = [1, 2, 3, 4, 5, 6];
            for (const i of rounds) {
                const gameSettingKey = `game${i}_settings`;
                if (group[gameSettingKey]) {
                    const attachment1 = new AttachmentBuilder(`https://friendsofrisk.com/setting/${group[gameSettingKey]}.png?title=Game%20${i}%20settings`);
                    attachments.push(attachment1);
                }
            }

            // Get players from the database
            sql = `SELECT * FROM \`${global.config.mysql_database}\`.\`eventmanager__groupmembers\` WHERE \`groupid\` = ${group.id} AND \`validto\` IS NULL`;
            const players = await new Promise((resolve, reject) => {
                con.query(sql, (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                });
            });

            if (players.length > 0) {
                let users = [];
                let userPings = "";
                let groupname = `${group.roundname} ${group.name}`;
                if (group.bracket > 1) {
                    groupname = `${group.roundname} ${group.name} ${group.bracketname}`;
                }

                for (const player of players) {
                    userPings += `<@${player.playerid}> `;
                    users.push(player.playerid);
                    addThreadMember(group.serverid, group.threadid, player.playerid);
                }

                const btn1 = new ButtonBuilder()
                    .setCustomId('pinghelp')
                    .setLabel('Ping event staff')
                    .setStyle(ButtonStyle.Danger);

                const btn2 = new ButtonBuilder()
                    .setCustomId('cantmakeit')
                    .setLabel('I cannot make it')
                    .setStyle(ButtonStyle.Danger);

                const btn3 = new ButtonBuilder()
                    .setCustomId('rulesinfo')
                    .setLabel('Rules&info')
                    .setStyle(ButtonStyle.Primary);

                const row = new ActionRowBuilder().addComponents(btn1).addComponents(btn2).addComponents(btn3);

                components.push(row);

                const embed = new EmbedBuilder()
                    .setTitle(groupname)
                    .setDescription(threadmessage)
                    .setTimestamp();

                const message = await thread.send({ content: userPings, embeds: embed ? [embed] : [], components: components, files: attachments, allowedMentions: { users: users, repliedUser: false } });
                await message.pin();

            }

            // Update database
            sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__groups` SET `welcomed` = NOW(), `lastping` = NOW() WHERE `id` = " + group.id + "";
            await new Promise((resolve, reject) => { con.query(sql, (err, result) => { if (err) return reject(err); resolve(result); }); });


        }

        // Close MySQL connection
        await new Promise((resolve, reject) => {
            con.end(err => {
                if (err) return reject(err);
                resolve();
            });
        });



    } catch (error) {
        // Handle errors
        console.error("Error:", error);
    }


}


async function eventmanagerUnscheduledPing(client) {

    try {

        // Connect to SQL database and fetch unscheduled active groups
        const con = mysql.createConnection({
            host: global.config.mysql_host,
            user: global.config.mysql_username,
            password: global.config.mysql_password,
            supportBigNumbers: true,
            bigNumberStrings: true
        });

        await new Promise((resolve, reject) => {
            con.connect(err => {
                if (err) return reject(err);
                resolve();
            });
        });

        let sql = "SELECT e.`serverid`, e.`helpchannel`, e.`id` AS `eventid`, eg.`name`, eg.`id`, eg.`threadid` FROM `" + global.config.mysql_database + "`.`eventmanager__groups` eg INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__events` e ON r.`eventid` = e.`id` AND e.`validto` IS NULL AND eg.`threadid` IS NOT NULL AND eg.`completed` IS NULL AND eg.`gametime` LIKE '" + UNSCHEDULED_GAMETIME_PREFIX + "%'";
        const groups = await new Promise((resolve, reject) => {
            con.query(sql, (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        for (const group of groups) {
            const guild = await client.guilds.resolve(group.serverid);
            if (!guild) continue;

            const thread = await guild.channels.fetch(group.threadid).catch(() => null);
            if (!thread) continue;

            sql = "SELECT `playerid` FROM `" + global.config.mysql_database + "`.`eventmanager__groupmembers` WHERE `groupid` = " + group.id + " AND `validto` IS NULL ORDER BY `playerid` ASC";
            const players = await new Promise((resolve, reject) => {
                con.query(sql, (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                });
            });

            const playerIds = players.map(player => player.playerid);
            if (playerIds.length === 0) continue;

            let userPings = '';
            for (const playerId of playerIds) {
                userPings += `<@${playerId}> `;
            }

            const message = `UNSCHEDULED GAME REMINDER\n\nThis group does not have a confirmed game time yet. Please coordinate a time between yourselves and report the decided time to event staff in the help thread (<#${group.helpchannel}>), or use the Ping event staff button below if you need help.\n\n${userPings}`;

            const btn1 = new ButtonBuilder()
                .setCustomId('pinghelp')
                .setLabel('Ping event staff')
                .setStyle(ButtonStyle.Danger);

            const btn2 = new ButtonBuilder()
                .setCustomId('cantmakeit')
                .setLabel('I cannot make it')
                .setStyle(ButtonStyle.Danger);

            const btn3 = new ButtonBuilder()
                .setCustomId('rulesinfo')
                .setLabel('Rules&info')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(btn1).addComponents(btn2).addComponents(btn3);

            await thread.send({
                content: message,
                components: [row],
                allowedMentions: { users: playerIds, repliedUser: false }
            });
        }

        await new Promise((resolve, reject) => {
            con.end(err => {
                if (err) return reject(err);
                resolve();
            });
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

















async function eventmanagerlockthreads(client) {

    try {


        // Connect to SQL database and fetch various config stuff
        const con = mysql.createConnection({
            host: global.config.mysql_host,
            user: global.config.mysql_username,
            password: global.config.mysql_password,
            supportBigNumbers: true,
            bigNumberStrings: true
        });

        // Wrap connection and query in Promises to use async/await
        await new Promise((resolve, reject) => {
            con.connect(err => {
                if (err) return reject(err);
                resolve();
            });
        });

        let sql = "SELECT eg.`id`, e.`serverid`, e.`mainchannel`, eg.`threadid` FROM `" + global.config.mysql_database + "`.`eventmanager__groups` eg INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__events` e ON r.`eventid` = e.`id` AND e.`validto` IS NULL AND eg.`threadid` IS NOT NULL AND eg.`completed` < DATE_ADD(NOW(), INTERVAL -9 MINUTE) AND eg.`threadlocked` IS NULL";
        const result = await new Promise((resolve, reject) => {
            con.query(sql, (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        // Process the result
        for (const group of result) {

            lockThread(client, group.serverid, group.mainchannel, group.threadid);

            sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__groups` SET `threadlocked` = NOW() WHERE `id` = " + group.id + "";
            await new Promise((resolve, reject) => { con.query(sql, (err, result) => { if (err) return reject(err); resolve(result); }); });


        }

        // Close MySQL connection
        await new Promise((resolve, reject) => {
            con.end(err => {
                if (err) return reject(err);
                resolve();
            });
        });



    } catch (error) {
        // Handle errors
        console.error("Error:", error);
    }


}

async function eventmanager1hourping(client) {

    try {


        // Connect to SQL database and fetch various config stuff
        const con = mysql.createConnection({
            host: global.config.mysql_host,
            user: global.config.mysql_username,
            password: global.config.mysql_password,
            supportBigNumbers: true,
            bigNumberStrings: true
        });

        // Wrap connection and query in Promises to use async/await
        await new Promise((resolve, reject) => {
            con.connect(err => {
                if (err) return reject(err);
                resolve();
            });
        });

        let sql = "SELECT e.`serverid`, eg.`name`, eg.`gametime`, eg.`id`, eg.`threadid`, e.`checkinsystem` FROM `" + global.config.mysql_database + "`.`eventmanager__groups` eg INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__events` e ON r.`eventid` = e.`id` AND e.`validto` IS NULL AND eg.`threadid` IS NOT NULL AND eg.`created` < DATE_ADD(NOW(), INTERVAL -1 HOUR) AND eg.`completed` IS NULL AND (eg.`lastping` IS NULL OR eg.`lastping` < DATE_ADD(NOW(), INTERVAL -1 HOUR)) AND eg.`gametime` BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 1 HOUR) AND e.`checkinsystem` = 0";
        const result = await new Promise((resolve, reject) => {
            con.query(sql, (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        // Process the result
        for (const group of result) {

            const guild = await client.guilds.resolve(group.serverid);
            const thread = await guild.channels.fetch(group.threadid);

            sql = "SELECT `playerid` FROM `" + global.config.mysql_database + "`.`eventmanager__groupmembers` WHERE `groupid` = " + group.id + " AND `validto` IS NULL ORDER BY `playerid` ASC";
            const players = await new Promise((resolve, reject) => {
                con.query(sql, (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                });
            });

            const date = new Date(group.gametime);

            let message = `1 HOUR REMINDER\n\nYour game is scheduled for <t:${date.getTime() / 1000}:F> which is in <t:${date.getTime() / 1000}:R> `;
            for (const player of players) {
                message = message + `<@${player.playerid}> `;
            }
            if (group.checkinsystem == 1) {
                message = message + ` The check-in process will start 45 minutes before game time. Remember to check in!`;
            }


            const playerIds = players.map(player => player.playerid);

            const btn1 = new ButtonBuilder()
                .setCustomId('pinghelp')
                .setLabel('Ping event staff')
                .setStyle(ButtonStyle.Danger);

            const btn2 = new ButtonBuilder()
                .setCustomId('cantmakeit')
                .setLabel('I cannot make it')
                .setStyle(ButtonStyle.Danger);

            const btn3 = new ButtonBuilder()
                .setCustomId('rulesinfo')
                .setLabel('Rules&info')
                .setStyle(ButtonStyle.Primary);

            let components = [];
            let row;

            if (group.checkinsystem == 0) {
                const btn4 = new ButtonBuilder()
                    .setCustomId('pingwaitlist')
                    .setLabel('Ping waitlist/noshows')
                    .setStyle(ButtonStyle.Primary);
                row = new ActionRowBuilder().addComponents(btn1).addComponents(btn2).addComponents(btn3).addComponents(btn4);
                components.push(row);
            } else {
                row = new ActionRowBuilder().addComponents(btn1).addComponents(btn2).addComponents(btn3);
                components.push(row);
            }

            const messageid = await thread.send({ content: message, components: components, allowedMentions: { users: playerIds, repliedUser: false } });

            sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__groups` SET `lastping` = NOW() WHERE `id` = " + group.id + "";
            await new Promise((resolve, reject) => { con.query(sql, (err, result) => { if (err) return reject(err); resolve(result); }); });

        }

        // Close MySQL connection
        await new Promise((resolve, reject) => {
            con.end(err => {
                if (err) return reject(err);
                resolve();
            });
        });



    } catch (error) {
        // Handle errors
        console.error("Error:", error);
    }
}



async function eventmanagegroupstartingnow(client) {

    try {


        // Connect to SQL database and fetch various config stuff
        const con = mysql.createConnection({
            host: global.config.mysql_host,
            user: global.config.mysql_username,
            password: global.config.mysql_password,
            supportBigNumbers: true,
            bigNumberStrings: true
        });

        // Wrap connection and query in Promises to use async/await
        await new Promise((resolve, reject) => {
            con.connect(err => {
                if (err) return reject(err);
                resolve();
            });
        });

        let sql = "SELECT e.`serverid`, eg.`name`, eg.`gametime`, eg.`id`, eg.`threadid`, e.`autopingwl`, e.`checkinsystem`, r.`groupmaxsize` FROM `" + global.config.mysql_database + "`.`eventmanager__groups` eg INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__events` e ON r.`eventid` = e.`id` AND eg.`completed` IS NULL AND e.`checkinsystem` = 0 AND eg.`gametime` BETWEEN DATE_ADD(NOW(), INTERVAL -1 MINUTE) AND DATE_ADD(NOW(), INTERVAL 1 MINUTE)";
        const result = await new Promise((resolve, reject) => {
            con.query(sql, (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        // Process the result
        for (const group of result) {

            const guild = await client.guilds.resolve(group.serverid);
            const thread = await guild.channels.fetch(group.threadid);

            sql = "SELECT `playerid` FROM `" + global.config.mysql_database + "`.`eventmanager__groupmembers` WHERE `groupid` = " + group.id + " AND `validto` IS NULL ORDER BY `playerid` ASC";
            const players = await new Promise((resolve, reject) => {
                con.query(sql, (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                });
            });

            if (group.checkinsystem == 0 && group.autopingwl == 1) {
                if (players.length < group.groupmaxsize) {
                    await pingwaitlist(client, thread);
                }
            }

            const date = new Date(group.gametime);
            let message = `The game should be starting now.`;
            for (const player of players) {
                message = message + `<@${player.playerid}> `;
            }

            const playerIds = players.map(player => player.playerid);

            const btn1 = new ButtonBuilder()
                .setCustomId('pinghelp')
                .setLabel('Ping event staff')
                .setStyle(ButtonStyle.Danger);

            const btn2 = new ButtonBuilder()
                .setCustomId('reportscores')
                .setLabel('Report scores')
                .setStyle(ButtonStyle.Primary);

            let components = [];
            let row;

            if (group.checkinsystem == 0) {
                const btn3 = new ButtonBuilder()
                    .setCustomId('pingwaitlist')
                    .setLabel('Ping waitlist/noshows')
                    .setStyle(ButtonStyle.Primary);
                row = new ActionRowBuilder().addComponents(btn1).addComponents(btn2).addComponents(btn3);
                components.push(row);
            } else {
                row = new ActionRowBuilder().addComponents(btn1).addComponents(btn2);
                components.push(row);
            }

            const messageid = await thread.send({ content: message, components: components, allowedMentions: { users: playerIds, repliedUser: false } });

            sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__groups` SET `lastping` = NOW() WHERE `id` = " + group.id + "";
            await new Promise((resolve, reject) => { con.query(sql, (err, result) => { if (err) return reject(err); resolve(result); }); });


        }

        // Close MySQL connection
        await new Promise((resolve, reject) => {
            con.end(err => {
                if (err) return reject(err);
                resolve();
            });
        });



    } catch (error) {
        // Handle errors
        console.error("Error:", error);
    }
}





async function updatecheckinmessage(thread) {

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

        let sql = "SELECT e.`serverid`, e.`helpchannel`, e.`waitlistrole`, eg.`name`, eg.`gametime`, eg.`id`, eg.`checkinmessageid` FROM `" + global.config.mysql_database + "`.`eventmanager__groups` eg INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__events` e ON r.`eventid` = e.`id` AND eg.`threadid` = '" + thread.id + "' AND eg.`completed` IS NULL";
        const result = await new Promise((resolve, reject) => {
            con.query(sql, function (err, result) {
                if (err) reject(err);
                resolve(result);
            });
        });
        const group = result[0];
        if (group) {

            const messagetoedit = await thread.messages.fetch(group.checkinmessageid);
            sql = "SELECT `playerid`, `checkedin` FROM `" + global.config.mysql_database + "`.`eventmanager__groupmembers` WHERE `groupid` = " + group.id + " AND `validto` IS NULL ORDER BY `playerid` ASC";
            const players = await new Promise((resolve, reject) => {
                con.query(sql, (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                });
            });

            const date = new Date(group.gametime);
            let message = `# Please check in\nClick the button below to confirm that you can make the game on time (<t:${date.getTime() / 1000}:R>). If not, you will be removed from the group and put on the noshow-list with no guaranteed game this round.\n## Players\n`;

            for (const player of players) {
                if (player.checkedin) {
                    message = message + `<@${player.playerid}>: ✅\n`;
                } else {
                    message = message + `<@${player.playerid}>: ❓❓\n`;
                }
            }

            const playerIds = players.map(player => player.playerid);

            const btn1 = new ButtonBuilder()
                .setCustomId('checkin')
                .setLabel('Check in')
                .setStyle(ButtonStyle.Success);

            const btn2 = new ButtonBuilder()
                .setCustomId('cantmakeit')
                .setLabel('I cannot make it')
                .setStyle(ButtonStyle.Danger);

            let components = [];
            const row = new ActionRowBuilder().addComponents(btn1).addComponents(btn2);
            components.push(row);

            const messageid = await messagetoedit.edit({ content: message, components: components, allowedMentions: { users: playerIds, repliedUser: false } });

        }
        con.end();
    } catch (error) {
        console.error(error);
    }



}



async function eventmanagerCheckinStop(client) {

    try {


        // Auto remove players that failed to check in
        // Auto ping waitlist if playercount < group maxsize

        // Connect to SQL database and fetch various config stuff
        const con = mysql.createConnection({
            host: global.config.mysql_host,
            user: global.config.mysql_username,
            password: global.config.mysql_password,
            supportBigNumbers: true,
            bigNumberStrings: true
        });

        // Wrap connection and query in Promises to use async/await
        await new Promise((resolve, reject) => {
            con.connect(err => {
                if (err) return reject(err);
                resolve();
            });
        });

        let sql = "SELECT br.`noshowrole`, e.`serverid`, eg.`name`, eg.`gametime`, eg.`id`, eg.`threadid`, r.`groupmaxsize`, r.`eventid`, e.`waitlistrole`, e.`participantrole` FROM `" + global.config.mysql_database + "`.`eventmanager__groups` eg INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__rounds` r ON eg.`roundid` = r.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__events` e ON r.`eventid` = e.`id` INNER JOIN `" + global.config.mysql_database + "`.`eventmanager__brackets` br ON br.`eventid` = e.`id` AND br.`bracketid` = r.`bracket` AND e.`checkinsystem` = 1 AND eg.`completed` IS NULL AND eg.`checkinmessageid` IS NOT NULL AND eg.`checkindone` IS NULL AND eg.`gametime` BETWEEN DATE_ADD(NOW(), INTERVAL -1 MINUTE) AND DATE_ADD(NOW(), INTERVAL 1 MINUTE)";
        const result = await new Promise((resolve, reject) => {
            con.query(sql, (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        // Process the result
        for (const group of result) {

            const guild = await client.guilds.resolve(group.serverid);
            const thread = await guild.channels.fetch(group.threadid);
            const noshowrole = await guild.roles.fetch(group.noshowrole);

            sql = "SELECT `playerid` FROM `" + global.config.mysql_database + "`.`eventmanager__groupmembers` WHERE `groupid` = " + group.id + " AND `validto` IS NULL AND `validfrom` < DATE_ADD(NOW(), INTERVAL -45 MINUTE) AND `checkedin` IS NULL";
            const players_to_be_removed = await new Promise((resolve, reject) => {
                con.query(sql, (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                });
            });


            for (const player of players_to_be_removed) {

                sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__groupmembers` SET `validto` = NOW() WHERE `groupid` = " + group.id + " AND `validto` IS NULL AND `playerid` = " + player.playerid + "";
                await new Promise((resolve, reject) => { con.query(sql, (err, result) => { if (err) return reject(err); resolve(result); }); });

                try {
                    const member = await guild.members.fetch(player.playerid);
                    if (member) {
                        await member.roles.add(noshowrole);
                        await thread.members.remove(`${member.id}`);
                    }
                    sql = "INSERT INTO `" + global.config.mysql_database + "`.`eventmanager__playerlog` VALUES (NULL," + member.id + "," + group.eventid + ",NOW(),'Failed to check in','Using Discord',NULL,NULL)";
                    await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });
                } catch (error) {
                    if (error.code === 'UNKNOWN_MEMBER') {
                        console.log(`Member with ID ${player.playerid} is no longer in the server.`);
                        // Handle logic for when the member is no longer in the server, if needed.
                    } else {
                        console.error(`An error occurred: ${error}`);
                    }
                }

            };

            await updatecheckinmessage(thread);

            sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__groups` SET `checkindone` = NOW() WHERE `id` = " + group.id + "";
            await new Promise((resolve, reject) => { con.query(sql, (err, result) => { if (err) return reject(err); resolve(result); }); });

            sql = "SELECT `playerid` FROM `" + global.config.mysql_database + "`.`eventmanager__groupmembers` WHERE `groupid` = " + group.id + " AND `validto` IS NULL";
            const players_left = await new Promise((resolve, reject) => {
                con.query(sql, (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                });
            });

            const free_spots = group.groupmaxsize - players_left.length;

            sql = "SELECT `playerid` FROM `" + global.config.mysql_database + "`.`eventmanager__groupmembers` WHERE `groupid` = " + group.id + " AND `validto` IS NULL ORDER BY `playerid` ASC";
            const players = await new Promise((resolve, reject) => {
                con.query(sql, (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                });
            });
            const date = new Date(group.gametime);
            let message = ``;

            if (free_spots > 0) {
                await pingwaitlist(client, thread);
                message = message + `I have just pinged the waitlist/noshow list. Please wait to see if somebody else joins before you start the game.`;
            } else {
                message = message + `The game should be starting now.`;
            }

            for (const player of players) {
                message = message + `<@${player.playerid}> `;
            }

            const playerIds = players.map(player => player.playerid);

            const btn1 = new ButtonBuilder()
                .setCustomId('pinghelp')
                .setLabel('Ping event staff')
                .setStyle(ButtonStyle.Danger);

            const btn2 = new ButtonBuilder()
                .setCustomId('reportscores')
                .setLabel('Report scores')
                .setStyle(ButtonStyle.Primary);

            let components = [];
            let row;

            row = new ActionRowBuilder().addComponents(btn1).addComponents(btn2);
            components.push(row);

            const messageid = await thread.send({ content: message, components: components, allowedMentions: { users: playerIds, repliedUser: false } });

        }

        // Close MySQL connection
        await new Promise((resolve, reject) => {
            con.end(err => {
                if (err) return reject(err);
                resolve();
            });
        });















    } catch (error) {
        // Handle errors
        console.error("Error:", error);
    }
}




async function availabilityMessage(message) {

    try {


        const confirm = new ButtonBuilder()
            .setCustomId('availabilityupdate')
            .setLabel('Update your availability')
            .setStyle(ButtonStyle.Success);
        const row = new ActionRowBuilder()
            .addComponents(confirm);
        await message.reply({ content: `You can click this button to update your availability on Friends of Risk`, components: [row] });

    } catch (error) {
        // Handle errors
        console.error("Error:", error);
    }
}


// The #commands / signup thread is locked, so it auto-archives from inactivity
// (and archived threads are hidden and cannot be unarchived by regular members).
// Keep it surfaced by unarchiving the signup thread of every active event.
async function eventmanagerunarchivecommandthreads(client) {

    try {

        const res = await httpsGetRequest({
            hostname: 'friendsofrisk.com',
            path: '/openapi/getEvents',
            method: 'GET',
        });
        const events = JSON.parse(res);

        for (const event of events) {
            try {
                if (event.validto || !event.signupchannel) continue;

                const guild = await client.guilds.resolve(event.serverid);
                if (!guild) continue;

                const thread = await guild.channels.fetch(event.signupchannel).catch(() => null);
                if (thread && thread.isThread() && thread.archived) {
                    await thread.setArchived(false);
                }
            } catch (e) {
                console.error(`Could not unarchive commands thread for event ${event.id}: ${e.message}`);
            }
        }

    } catch (error) {
        // Handle errors
        console.error("Error:", error);
    }
}


// The #commands / signup thread is a buttons-only self service panel. If a user
// posts a message there, delete it and point them to the #chat thread instead.
async function redirectCommandsMessage(message, client) {

    try {

        // Resolve the event (and its #chat / textchannel) from the signup channel
        const res = await httpsGetRequest({
            hostname: 'friendsofrisk.com',
            path: '/openapi/getEvents',
            method: 'GET',
        });
        const events = JSON.parse(res);
        const event = events.find(e => String(e.signupchannel) === String(message.channel.id));
        if (!event) return;

        // Remove the stray message
        await message.delete().catch(err => console.error(`Could not delete message in commands thread ${message.channel.id}: ${err.message}`));

        // Point the user to the #chat thread
        const guild = await client.guilds.resolve(event.serverid);
        const chatthread = await guild.channels.fetch(event.textchannel).catch(() => null);
        if (chatthread) {
            await chatthread.send({
                content: `<@${message.author.id}> Please use this channel instead if you want to chat about this event, or use the /staff command if you need help`,
                allowedMentions: { users: [message.author.id], repliedUser: false }
            });
        }

    } catch (error) {
        // Handle errors
        console.error("Error:", error);
    }
}


updateEventChannelIds();

module.exports = {
    updateEventChannelIds,
    eventmanager1hourping,
    eventmanagerlockthreads,
    updatecheckinmessage,
    lockThread,
    swap_users,
    eventmanager24hourping,
    eventmanager48hourping,
    eventmanagegroupstartingnow,
    eventmanagerwelcomethreads,
    pingstaff,
    pingparticipants,
    eventmanagerCheckinStart,
    eventmanagerCheckinStop,
    eventmanagerUnscheduledPing,
    signupHandler,
    updateSignupStatus,
    sendSignupMessage,
    eventmanagerunarchivecommandthreads,
    redirectCommandsMessage,
    addThreadMember,
    availabilityMessage,
    getAllowedChannelIds: () => allowedChannelIds,
    getChatChannelIds: () => chatChannelIds,
    getAnnouncementChannelsIds: () => announcementChannelsIds
};