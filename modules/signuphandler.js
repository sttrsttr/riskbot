const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
const https = require('https');

const { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');

// Array of inspirational quotes for players
const inspirationalQuotes = [
    "Success is no accident. It's hard work, perseverance, learning, studying, sacrifice, and most of all, love for what you're doing.",
    "Champions keep playing until they get it right.",
    "You miss 100% of the shots you don't take.",
    "Believe you can, and you're halfway there.",
    "It's not whether you get knocked down, it's whether you get up.",
    "Winning isn't everything, but wanting to win is.",
    "Don't watch the clock; do what it does. Keep going.",
    "The harder the battle, the sweeter the victory.",
    "Success is where preparation and opportunity meet.",
    "Push yourself, because no one else is going to do it for you.",
    "Great things never come from comfort zones.",
    "Hard work beats talent when talent doesn't work hard.",
    "Believe in yourself and all that you are.",
    "Difficult roads often lead to beautiful destinations.",
    "Don't limit your challenges. Challenge your limits.",
    "Today's accomplishments were yesterday's impossibilities.",
    "The difference between ordinary and extraordinary is that little extra.",
    "You are stronger than you think.",
    "Pain is temporary. Victory is forever.",
    "Don't stop when you're tired. Stop when you're done.",
    "The only place success comes before work is in the dictionary.",
    "You didn't come this far to only come this far.",
    "The only limit to our realization of tomorrow is our doubts of today.",
    "Do something today that your future self will thank you for.",
    "Your mind is a powerful thing. When you fill it with positive thoughts, your life will start to change.",
    "Stay patient and trust your journey.",
    "Dream it. Believe it. Build it.",
    "Success is not final, failure is not fatal: It is the courage to continue that counts.",
    "Make each day your masterpiece.",
    "The road to success and the road to failure are almost exactly the same.",
    "You never know how strong you are until being strong is your only choice.",
    "Success is not measured by what you accomplish, but by the opposition you have encountered.",
    "A goal is not always meant to be reached; it often serves simply as something to aim at.",
    "It always seems impossible until it's done.",
    "Don't let yesterday take up too much of today.",
    "Winners never quit, and quitters never win.",
    "Fall seven times, stand up eight.",
    "In the middle of every difficulty lies opportunity.",
    "The more difficult the victory, the greater the happiness in winning.",
    "Perseverance is not a long race; it is many short races one after the other.",
    "There are no shortcuts to any place worth going.",
    "The key to success is to focus on goals, not obstacles.",
    "If it doesn't challenge you, it won't change you.",
    "Don't count the days, make the days count.",
    "Focus on the process, and the results will follow.",
    "Start where you are. Use what you have. Do what you can.",
    "Be stronger than your excuses.",
    "Dream big. Work hard. Stay focused.",
    "Your only limit is you.",
    "Patience is not the ability to wait, but the ability to keep a good attitude while waiting.",
    "The two most powerful warriors are patience and time.",
    "All things are difficult before they become easy.",
    "Patience is bitter, but its fruit is sweet.",
    "Patience is not passive; on the contrary, it is active; it is concentrated strength.",
    "Good things come to those who wait.",
    "The best things in life are worth waiting for.",
    "One moment of patience may ward off great disaster. One moment of impatience may ruin a whole life.",
    "Be patient. Everything is coming together.",
    "To lose patience is to lose the battle.",
    "Patience is the companion of wisdom.",
    "Adopt the pace of nature: her secret is patience.",
    "The key to everything is patience. You get the chicken by hatching the egg, not by smashing it.",
    "Patience is the calm acceptance that things can happen in a different order than the one you have in mind.",
    "Sometimes things aren't clear right away. That's where you need to be patient and persevere.",
    "Rivers know this: there is no hurry. We shall get there someday.",
    "Patience, persistence, and perspiration make an unbeatable combination for success.",
    "The more you know yourself, the more patience you have for what you see in others.",
    "Patience and fortitude conquer all things.",
    "The trees that are slow to grow bear the best fruit.",
    "Have patience. All things are difficult before they become easy.",
    "Patience is a form of action.",
    "Great works are performed not by strength but by perseverance.",
    "He that can have patience can have what he will.",
    "Patience is the art of hoping.",
    "Patience is the key to paradise.",
    "Patience is not simply the ability to wait - it's how we behave while we're waiting.",
    "Endurance is nobler than strength, and patience than beauty.",
    "The very important thing you should have is patience.",
    "With patience, even the mulberry leaf becomes a silk gown.",
    "Learning patience can be a difficult experience, but once conquered, you will find life is easier.",
    "Patience is a conquering virtue.",
    "Have patience with all things, but first of all with yourself.",
    "Patience and diligence, like faith, remove mountains.",
    "Patience is the key to joy.",
    "Patience is the road to wisdom.",
    "All great achievements require time.",
    "Patience is the ability to idle your motor when you feel like stripping your gears.",
    "Patience is a key element of success.",
    "Patience, persistence, and perspiration make an unbeatable combination for success.",
    "If you have patience, you'll see that things will unfold as they should.",
    "Patience is necessary, and one cannot reap immediately where one has sown.",
    "The more patient you are, the more peaceful you become.",
    "The strongest of all warriors are these two — time and patience.",
    "Patience is the secret to good food and good friends.",
    "Time is the wisest counselor of all.",
    "Luck is what happens when preparation meets opportunity.",
    "The harder you work, the luckier you get.",
    "Create your own luck by putting yourself in situations where opportunities are more likely to arise.",
    "Success is simply a matter of hanging on after others have let go.",
    "Stay open to new experiences and meet new people - luck often comes from unexpected connections.",
    "Take more risks. You increase your chances of being lucky by stepping out of your comfort zone.",
    "Luck favors the bold. Be courageous in pursuing your goals.",
    "Seize every opportunity, no matter how small, because you never know where it will lead.",
    "Be positive and optimistic. A good attitude attracts opportunities.",
    "Pay attention to the small things. Sometimes luck comes from noticing details others overlook.",
    "Trust your instincts. Sometimes gut feelings lead you to lucky opportunities.",
    "Build relationships. People around you often bring luck in the form of guidance, support, or new opportunities.",
    "Develop resilience. Luck favors those who persist even after failures.",
    "Take action. Luck comes to those who act, not those who wait.",
    "Say 'yes' more often. Every 'yes' is a new chance for something lucky to happen.",
    "Be adaptable. Sometimes luck means being able to pivot when new opportunities arise.",
    "Believe in yourself. Confidence attracts luck by opening doors you didn't even see before.",
    "Focus on progress, not perfection. Sometimes the process of moving forward brings unexpected luck.",
    "Stay curious. The more you learn and explore, the more chances for lucky breaks.",
    "Maintain a growth mindset. See challenges as opportunities for luck and success to follow.",
    "Don't rely on luck alone - make your own destiny through hard work and persistence.",
    "Take calculated risks. Fortune often rewards those who are willing to take chances.",
    "Be grateful for what you have. Gratitude opens doors to more positive experiences, including luck.",
    "Put yourself in the right place at the right time by being active and engaged in your field.",
    "Create opportunities for others. Helping people often brings good fortune in return.",
    "Take small, consistent steps toward your goals. Luck often comes from steady progress over time.",
    "Keep an open mind. Sometimes luck comes in forms you weren't expecting.",
    "Set clear goals and pursue them relentlessly. Luck often finds people who know where they're headed.",
    "Be persistent. The longer you stick with something, the more likely a lucky break will come your way.",
    "Be flexible. Sometimes luck comes from embracing change rather than resisting it.",
    "Surround yourself with positive and motivated people - luck often comes through good relationships.",
    "Learn from your mistakes. What seems like bad luck now can turn into good fortune later.",
    "Keep your eyes open. Luck often comes from noticing opportunities that others miss.",
    "Take initiative. Luck often favors those who make the first move.",
    "Stay prepared. Luck can knock at your door anytime, but you need to be ready to take advantage of it.",
    "Listen carefully to others. Sometimes luck comes from advice or ideas given by those around you.",
    "Be humble. Luck is often a mix of hard work, timing, and help from others.",
    "Focus on creating value for others. The more you give, the more luck seems to find its way back to you.",
    "Stay resilient in the face of adversity. What seems like bad luck now could turn into a blessing in disguise.",
    "Break your routine. Sometimes stepping away from the ordinary creates new opportunities for luck.",
    "Network with purpose. The more people you know, the more chances for luck to strike.",
    "Always be learning. Knowledge opens up more opportunities for luck.",
    "Be proactive. Take the lead in your life, and luck will often follow.",
    "Keep your goals clear but remain open to new paths - luck sometimes comes from detours.",
    "Look for the silver lining in difficult situations. Even challenges can bring luck with the right mindset.",
    "Trust the process. Luck often follows those who stay patient and consistent in their efforts.",
    "Be enthusiastic. Passion for what you do attracts opportunities and luck in surprising ways."
];




// Array of welcome messages
const welcomeMessages = [
    "Welcome to the tournament, let the games begin!",
    "Ready to conquer the competition? Good luck!",
    "May the best player win!",
    "I hope you roll 6's all day!",
    "Try to get a trade on 4 this time!",
    "I hope we get to play some day!",
    "It's game time! Show us what you've got!",
    "Best of luck in the tournament!",
    "Let the battles commence!",
    "Get ready to play and have fun!",
    "Wishing you success in every game!",
    "Play hard and play fair!",
    "Welcome to the arena, warrior!",
    "Victory is just a game away!",
    "Let's make this tournament unforgettable!",
    "Go for the gold!",
    "May your skills shine through!",
    "Ready, set, game on!",
    "Welcome, competitor! Show your prowess!",
    "Here's to a great tournament experience!",
    "Bring your A-game and enjoy!",
    "Good luck, and may the odds be ever in your favor!",
    "Play with passion and determination!",
    "Welcome to the challenge!",
    "Let's see who comes out on top!",
    "Time to showcase your talent!",
    "Enjoy the games and give it your all!",
    "Welcome to the battlefield!",
    "Make every move count!",
    "Wishing you an epic tournament!",
    "May your strategies lead you to victory!",
    "Ready to claim your spot at the top?",
    "Play smart, play bold!",
    "Welcome to the ultimate gaming showdown!",
    "Let's have a tournament to remember!",
    "Compete with heart and spirit!",
    "Best wishes for an amazing tournament!",
    "Welcome to the competition, game on!",
    "May your reflexes be sharp and your aim true!",
    "The tournament awaits your skill!",
    "Play with confidence and grace!",
    "Here's to a fair and fun tournament!",
    "Show us what you're made of!",
    "Bring your best game and enjoy the journey!",
    "Welcome to the quest for victory!",
    "Let your gaming skills shine!",
    "Wishing you thrilling matches ahead!",
    "Ready to face the challenge?",
    "May your games be epic and victories sweet!",
    "Welcome to the ultimate test of skill!",
    "Good luck, and may the best player win!",
    "Get ready for an action-packed tournament!",
    "Welcome, and let's make this tournament legendary!",
    "Let's see some great sportsmanship out there!",
    "Welcome to the competition, player!",
    "Show your skill and strategy!",
    "The tournament awaits your greatness!",
    "May your efforts be rewarded!",
    "Welcome to a world of challenges!",
    "Get set for an exciting ride!",
    "Wishing you great success in the games!",
    "It's your time to shine!",
    "Welcome to the ultimate challenge!",
    "Unleash your potential!",
    "Show your competitive spirit!",
    "May you achieve your dreams!",
    "Let the games inspire you!",
    "Your journey to glory starts now!",
    "Prepare for epic battles!",
    "Welcome to the realm of champions!",
    "May your tactics be flawless!",
    "Victory is within your reach!",
    "Ready to make your mark?",
    "Show your true power!",
    "Let's make history together!",
    "Welcome to the gaming elite!",
    "Your adventure begins now!",
    "Play with honor and pride!",
    "Reach for the stars!",
    "Ready to break records?",
    "Let's create unforgettable moments!",
    "Welcome to the challenge of a lifetime!",
    "May you play with brilliance!",
    "The stage is set for greatness!",
    "Get ready to dominate!",
    "Rise to the occasion!",
    "Welcome to the fight for glory!",
    "The competition is fierce!",
    "Make every moment count!",
    "Let's see some amazing gameplay!",
    "Welcome to the test of champions!",
    "Victory favors the brave!",
    "Compete with courage and skill!",
    "It's your time to conquer!",
    "Welcome to the game of legends!",
    "The thrill of victory awaits!",
    "Aim high and play hard!",
    "Prepare for an epic journey!",
    "Welcome to the arena of champions!",
    "May your path be victorious!",
    "Bring your best game!",
    "I hope you get good dice",
    "I hope you get sets on 3 every time",
    "No australia no win!",
    "Let's witness some great talent!",
    "Welcome to the ultimate quest!",
    "Your destiny awaits!",
    "Play with all your heart!",
    "May fortune favor you!",
    "Show us your mastery!",
    "Welcome to the game of champions!",
    "The challenge is yours to take!",
    "Make your mark in history!"
];

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

let allowedChannelIds = [];
let chatChannelIds = [];
let announcementChannelsIds = [];

async function swap_users(client, tserver, tchannel, tthread_a, tuser_a, tthread_b, tuser_b, tmessage, staffroleid) {

    try {

        const guild = await client.guilds.fetch(tserver);
        if (!guild) {
            console.log('Guild not found');
            return;
        }

        const channel = await guild.channels.fetch(tchannel);
        if (!channel) {
            console.log('Channel not found');
            return;
        }

        const user1 = await guild.members.fetch(tuser_a);
        const user2 = await guild.members.fetch(tuser_b);

        const thread1 = await channel.threads.fetch(tthread_a);
        const thread2 = await channel.threads.fetch(tthread_b);

        await thread1.members.add(user2.id);
        await thread2.members.add(user1.id);

        const message1 = await thread1.send(tmessage, { allowedMentions: { users: [user1.id, user2.id], repliedUser: false } });
        const message2 = await thread2.send(tmessage, { allowedMentions: { users: [user1.id, user2.id], repliedUser: false } });

        if (!user1.roles.cache.has(staffroleid)) {
            await thread1.members.remove(user1.id);
        }
        if (!user2.roles.cache.has(staffroleid)) {
            await thread2.members.remove(user2.id);
        }

        return "SUCCESS";

    } catch (error) {
        console.error('Error fetching guild or channel:', error);
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


        let sql = "SELECT 1 FROM `" + global.config.mysql_database + "`.`eventmanager__pinglog` WHERE `channelid` = " + message.channel.id + " AND `command` = 'pingparticipants' AND `validfrom` > DATE_ADD(NOW(), INTERVAL -1 HOUR)";
        const history = await new Promise((resolve, reject) => {
            con.query(sql, function (err, result) {
                if (err) reject(err);
                resolve(result);
            });
        });
        if (history.length == 0) {

            sql = "SELECT * FROM `" + global.config.mysql_database + "`.`eventmanager__events` WHERE `mainchannel` = " + message.channel.id + "";
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
                const role = await guild.roles.fetch(event.participantrole);

                await channel.send({ content: `Attention <@&${role.id}>, please read the message above`, allowedMentions: { roles: [role.id], repliedUser: false } });

                sql = "INSERT INTO `" + global.config.mysql_database + "`.`eventmanager__pinglog` VALUES (NULL,NOW()," + message.channel.id + "," + message.author.id + ",'pingparticipants')";
                const insert = await new Promise((resolve, reject) => {
                    con.query(sql, function (err, result) {
                        if (err) reject(err);
                        resolve(result);
                    });
                });
            }
        }

        con.end();

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

        let sql = "SELECT 1 FROM `" + global.config.mysql_database + "`.`eventmanager__pinglog` WHERE `channelid` = " + message.channel.id + " AND `command` = 'pingstaff' AND `validfrom` > DATE_ADD(NOW(), INTERVAL -4 MINUTE)";
        const history = await new Promise((resolve, reject) => {
            con.query(sql, function (err, result) {
                if (err) reject(err);
                resolve(result);
            });
        });
        if (history.length == 0) {

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
                await channel.send(`<@${message.author.id}> summons <@&${role.id}>`);

                sql = "INSERT INTO `" + global.config.mysql_database + "`.`eventmanager__pinglog` VALUES (NULL,NOW()," + message.channel.id + "," + message.author.id + ",'pingstaff')";
                const insert = await new Promise((resolve, reject) => {
                    con.query(sql, function (err, result) {
                        if (err) reject(err);
                        resolve(result);
                    });
                });


            }
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

            const date = new Date(group.gametime);

            if (mentionroles.length > 0) {

            const message = `Attention ${mention} there is probably an open spot in ${group.name} starting in <t:${date.getTime() / 1000}:R>\n\nFirst come first serve, click this button to join this group!`;

            const btn1 = new ButtonBuilder()
                .setCustomId('joingroupfromwaitlist')
                .setLabel('Join group')
                .setStyle(ButtonStyle.Success);
            const channel = await guild.channels.fetch(group.helpchannel);
            let components = [];
            const row = new ActionRowBuilder().addComponents(btn1);
            components.push(row);

            const pingmessageid = await channel.send({ content: message, components: components, allowedMentions: { roles: mentionroles, repliedUser: false } });
        }

            sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__groups` SET `waitlistpinged` = NOW(), `pingmessageid` = " + pingmessageid + " WHERE `id` = " + group.id + "";
            const result2 = await new Promise((resolve, reject) => {
                con.query(sql, function (err, result) {
                    if (err) reject(err);
                    resolve(result);
                });
            });
        }
        con.end();
    } catch (error) {
        console.error(error);
    }
}


async function signupHandler(message, client) {

    const main_no_role = '1414643032002920468';

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


        let sql = "SELECT * FROM `" + global.config.mysql_database + "`.`eventmanager__events` WHERE `signupchannel` = " + message.channelId + "";
        const events = await new Promise((resolve, reject) => {
            con.query(sql, function (err, result) {
                if (err) reject(err);
                resolve(result);
            });
        });
        const event = events[0];

        if (event) {
            const guild = await client.guilds.resolve(event.serverid);
            const member = await guild.members.fetch(message.author.id);

            sql = "SELECT * FROM `" + global.config.mysql_database + "`.`eventmanager__signups` WHERE `eventid` = " + event.id + " AND `playerid` = " + message.author.id + "";
            const signedup = await new Promise((resolve, reject) => {
                con.query(sql, function (err, result) {
                    if (err) reject(err);
                    resolve(result);
                });
            });
            if (signedup.length > 0) {

                sql = "SELECT * FROM `" + global.config.mysql_database + "`.`eventmanager__signups` WHERE `eventid` = " + event.id + " AND `playerid` = " + message.author.id + " AND `repeated_myself` > DATE_ADD(NOW(), INTERVAL -1 DAY)";
                const notify = await new Promise((resolve, reject) => {
                    con.query(sql, function (err, result) {
                        if (err) reject(err);
                        resolve(result);
                    });
                });
                if (notify.length == 0) {

                    await message.reply(`You have already signed up for ${event.name}`);

                    sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__signups` SET `repeated_myself` = NOW() WHERE `eventid` = " + event.id + " AND `playerid` = " + message.author.id + "";
                    const repated = await new Promise((resolve, reject) => {
                        con.query(sql, function (err, result) {
                            if (err) reject(err);
                            resolve(result);
                        });
                    });
                } else {
                    console.log(`Already notified ${message.author.id}`);
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

                    await message.reply(responses[Math.floor(Math.random() * responses.length)]);

                } else {


                    let availerror = 0;

                    let blsql = "SELECT * FROM `" + global.config.mysql_database + "`.`eventmanager__blacklists` WHERE `eventid` = " + event.id + " AND `playerid` = " + message.author.id + " AND `validto` IS NULL";
                    const blacklisted = await new Promise((resolve, reject) => {
                        con.query(blsql, function (err, result) {
                            if (err) reject(err);
                            resolve(result);
                        });
                    });
                    if (blacklisted.length > 0) {
                        await message.reply(`You are not able to sign up for ${event.name}. Please contact event staff if you have any questions.`);
                    } else {



                        sql = "SELECT 1 FROM `" + global.config.mysql_database + "`.`users` u WHERE u.`discordid` = " + message.author.id + "";
                        const exists = await new Promise((resolve, reject) => {
                            con.query(sql, function (err, result) {
                                if (err) reject(err);
                                resolve(result);
                            });
                        });

                        if (exists.length == 0) {

                            const username = member.nickname || member.user.globalName || member.user.username;

                            const guid = uuidv4().toUpperCase();
                            let sql = "INSERT INTO `" + global.config.mysql_database + "`.`users` VALUES (NULL,'" + username + "','" + member.id + "',NULL,NULL,NULL,NULL,NOW(),NULL,'" + guid + "',DATE_ADD(NOW(), INTERVAL +1 WEEK),NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);";
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

                            sql = "SELECT 1 FROM `" + global.config.mysql_database + "`.`users` u INNER JOIN `" + global.config.mysql_database + "`.`user__availability` ua ON u.`id` = ua.`userid` AND u.`discordid` = " + message.author + "";
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

                                sql = "SELECT * FROM `" + global.config.mysql_database + "`.`user__merits` um INNER JOIN `" + global.config.mysql_database + "`.`users` u ON u.`id` = um.`userid` AND um.`validto` IS NULL AND um.`merit` = " + event.badgerequired + " AND u.`discordid` = " + message.author + "";
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

                                await message.reply(`I am so sorry, but it does not look like you have the required FoR badge ${badgeinfo.name} that is required to sign up for this tourney.\nHow to get this badge:\n1) Link your Risk Friend ID to your FoR profile\n2) ${badgeinfo.description}\n3) Wait up to 24 hours for badges to be awarded or contact staff`);

                            } else {

                                const helpthread = await guild.channels.fetch(event.helpchannel);
                                const chatthread = await guild.channels.fetch(event.textchannel);

                                if (helpthread.type === ChannelType.PublicThread || helpthread.type === ChannelType.PrivateThread || helpthread.type === ChannelType.AnnouncementThread) {
                                    helpthread.members.add(member);
                                }

                                if (chatthread.type === ChannelType.PublicThread || chatthread.type === ChannelType.PrivateThread || chatthread.type === ChannelType.AnnouncementThread) {
                                    chatthread.members.add(member);
                                }

                                const randomMessage = getRandomWelcomeMessage();
                                if (event.signupstatus == 'WAITLIST') {
                                    sql = "INSERT INTO `" + global.config.mysql_database + "`.`eventmanager__signups` VALUES (NULL," + event.id + "," + message.author + ",NOW(),NULL,NOW(),NULL,NULL,1,NULL,1)";
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
                                    sql = "INSERT INTO `" + global.config.mysql_database + "`.`eventmanager__signups` VALUES (NULL," + event.id + "," + message.author + ",NOW(),NULL,NULL,NULL,NULL,1,NULL,1)";
                                    if (event.participantrole) {
                                        const participantrole = await guild.roles.fetch(event.participantrole);
                                        if (participantrole) {
                                            await member.roles.add(participantrole);

                                            if (guild.id == guilds.MAIN) {
                                                // Remove specific role from MAIN if they have it
                                                if (member.roles.cache.has(main_no_role)) {
                                                    await member.roles.remove(main_no_role);
                                                }
                                            }

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
                                        await message.reply(`You are now put on the waiting list for ${event.name}. You will be pinged if there is an opening for you. View all signups at https://friendsofrisk.com/eventmanager/${event.id}/`);
                                    } else {
                                        await message.reply(`You are now signed up for ${event.name}. ${randomMessage} View all signups at https://friendsofrisk.com/eventmanager/${event.id}/`);
                                    }
                                    sql = "INSERT INTO `" + global.config.mysql_database + "`.`eventmanager__playerlog` VALUES (NULL," + message.author + "," + event.id + ",NOW(),'Signed up','Using Discord',NULL,NULL)";
                                    await new Promise((resolve, reject) => { con.query(sql, function (err, result) { if (err) reject(err); resolve(result); }); });
                                } else {
                                    await message.reply(`There was a problem signing you up... please ask for help`);
                                }

                            }


                        } else {

                            sql = "INSERT INTO `" + global.config.mysql_database + "`.`eventmanager__signups_failed` VALUES (NULL," + event.id + "," + message.author + ",NOW())";
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
                            await message.reply({ content: `Oops! You don't have any availability set up at friendsofrisk.com. Please click this button to complete your sign up`, components: [row] });

                            //                        await message.reply(`Sorry! You don't have any availability set up. Please run the </availability:1258919454545281118> command first to set up your availability, or login at https://friendsofrisk.com/ to do it, before writing sign up here again.`);
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
                await messageid.pin();

                sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__groups` SET `checkinmessageid` = " + messageid + " WHERE `id` = " + group.id + "";
                await new Promise((resolve, reject) => {
                    con.query(sql, (err, result) => {
                        if (err) return reject(err);
                        resolve(result);
                    });
                });

                await updatecheckinmessage(thread);
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

            // Prepare the message by replacing placeholders
            let threadmessage = group.threadmessage;
            threadmessage = threadmessage.replace(/\B(##GAMETIME##)\B/i, `<t:${Math.floor(new Date(group.gametime).getTime() / 1000)}:F>`);
            threadmessage = threadmessage.replace(/\B(##COUNTDOWN##)\B/i, `<t:${Math.floor(new Date(group.gametime).getTime() / 1000)}:R>`);

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

            const threadMembers = await thread.members.fetch();

            for (const player of players_to_be_removed) {

                sql = "UPDATE `" + global.config.mysql_database + "`.`eventmanager__groupmembers` SET `validto` = NOW() WHERE `groupid` = " + group.id + " AND `validto` IS NULL AND `playerid` = " + player.playerid + "";
                await new Promise((resolve, reject) => { con.query(sql, (err, result) => { if (err) return reject(err); resolve(result); }); });

                try {
                    const member = await guild.members.fetch(player.playerid);
                    if (member) {
                        await member.roles.add(noshowrole);
                        if (threadMembers.has(member.id)) {
                            await thread.members.remove(`${member.id}`);
                        }
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



updateEventChannelIds();

module.exports = {
    updateEventChannelIds,
    eventmanager1hourping,
    eventmanagerlockthreads,
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
    signupHandler,
    availabilityMessage,
    getAllowedChannelIds: () => allowedChannelIds,
    getChatChannelIds: () => chatChannelIds,
    getAnnouncementChannelsIds: () => announcementChannelsIds
};