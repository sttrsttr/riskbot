const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
const https = require('https');

const { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, StringSelectMenuBuilder } = require('discord.js');
const { httpsPostRequest, httpsGetRequest } = require('./helperfunctions.js');

async function updateSettingVoteMessage(guild, thread, threadmeta) {

    if (threadmeta.settingvotemessageid) {
        // Setting vote message already exists
        const settingVoteMessage = await thread.messages.fetch(threadmeta.settingvotemessageid);
        if (settingVoteMessage) {
            // Delete existing setting vote message
            await settingVoteMessage.delete();
        }
    }

    // Fetch three random settings from FoR API
    const options3 = {
        hostname: 'friendsofrisk.com',
        path: '/m2mapi/getsettings',
        method: 'POST',
        headers: {
            'X-API-KEY': global.config.for_api_key
        }
    };

    const postData3 = JSON.stringify({
        playercount: threadmeta.lobbysize,
        gametype: threadmeta.lobbytype,
    });

    const output3 = await httpsPostRequest(options3, postData3);
    const settingpool = JSON.parse(output3);

    // Create a setting vote message with embedded setting images and a dropdown action to select one of three setting items

    const settingEmbed = new EmbedBuilder()
        .setTitle(`${threadmeta.lobbytype} Lounge settings vote`)
        .setDescription('The lounge game is full! Please vote for one of the following settings to be used for the game:')
        .setColor(0x00AE86);

    const settingOptions = [];
    const settingids = [];

    for (let i = 0; i < 3; i++) {

        const setting = settingpool.settings[i];
        settingids.push(setting.settingid);
        setting.name = setting.map +' '+ setting.cards +' '+ setting.gametype;

        settingOptions.push({
            label: setting.name,
            description: 'FoR setting #'+ setting.settingid,
            value: setting.settingid,
        });
    }

    settingOptions.push({
        label: 'Re-roll settings',
        description: 'Re-roll the settings options',
        value: '-1',
    });

    settingOptions.push({
        label: 'Game is cancelled',
        description: 'The game has been cancelled',
        value: '-9',
    });

    // Implode settingids array into a string glued together with .
    const settinglink = `https://friendsofrisk.com/setting/${settingids.join('.')}.png`;

    settingEmbed.setImage(settinglink);

    const row = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('vote_lounge_setting')
                .setPlaceholder('Vote for an option')
                .addOptions(settingOptions)
        );

    const voteMessage = await thread.send({ content: `Settinglink: ${settinglink}`, embeds: [settingEmbed], components: [row] });
    
    // Update vote message ID in database
    const options4 = {
        hostname: 'friendsofrisk.com',
        path: '/m2mapi/updateloungegame',
        method: 'POST',
        headers: {
            'X-API-KEY': global.config.for_api_key
        }
    };

    const postData4 = JSON.stringify({
        threadid: thread.id,
        settingvotemessageid: voteMessage.id
    });

    const output4 = await httpsPostRequest(options4, postData4);

    return

}

async function updateLoungeMessages(guild, thread, threadmeta) {

    let message = `${threadmeta.playercount}p ${threadmeta.lobbytype} Lounge lobby\n\n${threadmeta.playercount}/${threadmeta.lobbysize} players joined\n\n`;
    for (const player of threadmeta.players) {
        message += `• <@${player}> joined\n`;
    }
    message += `\nPlease wait for the remaining players to join...\n\n`;

    let buttonstyle = ButtonStyle.Success;

    let emote = '🏖️';

    if (threadmeta.lobbytype == "Competitive") {
        buttonstyle = ButtonStyle.Danger;
        emote = '🏟️';
    }

    // Update existing welcome message
    welcomeMessage = await thread.messages.fetch(threadmeta.welcomemessageid);
    if (welcomeMessage) {
        await welcomeMessage.edit({ content: message, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('leave_lounge_game').setLabel('Leave game').setStyle(ButtonStyle.Danger))] });
    }

    const channel = await guild.channels.fetch(threadmeta.channelid);
    const joinmessage = await channel.messages.fetch(threadmeta.joinmessageid);
    if (!joinmessage) {
        console.error(`Failed to fetch join message in channel ${channel.name}`);
        return;
    }

    if (!welcomeMessage) {
        console.error(`Failed to fetch welcome message in thread ${thread.name}`);
        return;
    }

    let playerlistmsg = '';
    for (const player of threadmeta.players) {
        playerlistmsg += ` • <@${player}>\n`;
    }

    if (threadmeta.playercount >= threadmeta.lobbysize) {
        await joinmessage.edit({ content: `${emote} ${threadmeta.lobbysize}P ${threadmeta.lobbytype} Lounge game is now full ${emote}\n\n- Players:\n${playerlistmsg}- ELO requirement: ${threadmeta.elolimit}\n - Status: ${threadmeta.lobbysize - threadmeta.playercount} spots remaining`, components: [] });
        welcomeMessage.delete();
    } else {
        await joinmessage.edit({ content: `${emote} New ${threadmeta.lobbysize}P ${threadmeta.lobbytype} Lounge game created ${emote}\n\n- Players:\n${playerlistmsg}- ELO requirement: ${threadmeta.elolimit}\n - Status: ${threadmeta.lobbysize - threadmeta.playercount} spots remaining\n\nUse the button below to join the game.\n`, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('join_lounge_game').setLabel(`Join ${emote} ${threadmeta.lobbytype} game`).setStyle(buttonstyle))] });
    }

}

// API functions
async function addLoungeMember(guild, thread, userid) {
    try {

        if (thread && thread.type === ChannelType.PublicThread || thread.type === ChannelType.PrivateThread || thread.type === ChannelType.AnnouncementThread) {
            const member = await guild.members.fetch(userid);

            // Get thread meta info
            const options = {
                hostname: 'friendsofrisk.com',
                path: '/m2mapi/getloungegame',
                method: 'POST',
                headers: {
                    'X-API-KEY': global.config.for_api_key
                }
            };

            const postData = JSON.stringify({
                threadid: thread.id
            });

            const output = await httpsPostRequest(options, postData);
            const threadmeta = JSON.parse(output).gamedata;

            // Verify that there are free spots
            if (threadmeta.playercount >= threadmeta.lobbysize) {
                console.log(`Thread ${thread.name} is full. Cannot add ${member.user.tag}.`);
                return;
            }

            const options2 = {
                hostname: 'friendsofrisk.com',
                path: '/m2mapi/addloungeplayer',
                method: 'POST',
                headers: {
                    'X-API-KEY': global.config.for_api_key
                }
            };

            const postData2 = JSON.stringify({
                serverid: guild.id,
                threadid: thread.id,
                player: member.id,
            });

            const output2 = await httpsPostRequest(options2, postData2);
            const addplayerresult = JSON.parse(output2);

            if (addplayerresult.status !== 'success') {
                console.log(`Failed to add ${member.user.tag} to lounge game in thread ${thread.name}.`);
                return;
            }

            // Add member to the thread
            await thread.members.add(member).then(async () => {
                    threadmeta.playercount++;
                    threadmeta.players.push(member.id);

                    await thread.send(`<@${member.id}> has joined the lounge game!`);

                    // Update lounge messages
                    await updateLoungeMessages(guild, thread, threadmeta);

                    if (threadmeta.playercount >= threadmeta.lobbysize) {
                        // Lobby is full, delete welcome message and start setting voting

                        await updateSettingVoteMessage(guild, thread, threadmeta);

                    }

                    //console.log(`Added ${member.user.tag} to thread ${thread.name}`);
                    // Create or update the lounge welcome message

                })
                .catch(console.error);
        }
    } catch (error) {
        console.error(error.message);
    }
}


async function removeLoungeMember(guild, thread, userid) {
    try {

        if (thread && thread.type === ChannelType.PublicThread || thread.type === ChannelType.PrivateThread || thread.type === ChannelType.AnnouncementThread) {
            const member = await guild.members.fetch(userid);

            // Get thread meta info
            const options = {
                hostname: 'friendsofrisk.com',
                path: '/m2mapi/getloungegame',
                method: 'POST',
                headers: {
                    'X-API-KEY': global.config.for_api_key
                }
            };

            const postData = JSON.stringify({
                threadid: thread.id
            });

            const output = await httpsPostRequest(options, postData);
            const threadmeta = JSON.parse(output).gamedata;

            const options2 = {
                hostname: 'friendsofrisk.com',
                path: '/m2mapi/removeloungeplayer',
                method: 'POST',
                headers: {
                    'X-API-KEY': global.config.for_api_key
                }
            };

            const postData2 = JSON.stringify({
                serverid: guild.id,
                threadid: thread.id,
                player: member.id,
            });

            const output2 = await httpsPostRequest(options2, postData2);
            const removeplayerresult = JSON.parse(output2);

            if (removeplayerresult.status !== 'success') {
                console.log(`Failed to remove ${member.user.tag} from lounge game in thread ${thread.name}.`);
                return;
            }

            // Add member to the thread
            thread.members.remove(member)
                .then(async () => {

                    threadmeta.playercount--;
                    threadmeta.players = threadmeta.players.filter(id => id !== member.id);

                    if (threadmeta.playercount == 0) {

                        const joinmessage = await guild.channels.fetch(threadmeta.channelid).then(channel => channel.messages.fetch(threadmeta.joinmessageid));
                        await joinmessage.delete();
                        // No players left, delete the thread
                        await thread.delete('No players left in lounge game thread.');

                        // Update vote message ID in database
                        const options5 = {
                            hostname: 'friendsofrisk.com',
                            path: '/m2mapi/updateloungegame',
                            method: 'POST',
                            headers: {
                                'X-API-KEY': global.config.for_api_key
                            }
                        };

                        const postData5 = JSON.stringify({
                            threadid: thread.id,
                            cancelled: 1
                        });

                        const output5 = await httpsPostRequest(options5, postData5);

                        return;
                    }

                    // Update lounge messages
                    await updateLoungeMessages(guild, thread, threadmeta);

                    console.log(`Removed ${member.user.tag} from thread ${thread.name}`);
                    // Create or update the lounge welcome message

                })
                .catch(console.error);
        }
    } catch (error) {
        console.error(error.message);
    }
}


module.exports = {
    addLoungeMember,
    removeLoungeMember,
    updateSettingVoteMessage,
};