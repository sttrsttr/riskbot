// eventRelay.js
// Handles relaying player thread messages and event commands

const { getFakeName } = require('./eventManager');
const { ChannelType } = require('discord.js');

/**
 * Relay a message from a player's private thread to the main event channel, using their fake name.
 * @param {object} client - Discord client
 * @param {string} guildId - Guild/server ID
 * @param {string} mainChannelId - Main event channel ID
 * @param {string} playerId - Discord user ID
 * @param {string} message - Message content
 */
async function relayPlayerMessage(client, guildId, mainChannelId, playerId, message) {
    const guild = await client.guilds.fetch(guildId);
    const mainChannel = await guild.channels.fetch(mainChannelId);
    if (!mainChannel || mainChannel.type !== ChannelType.GuildText) {
        console.error(`Invalid mainChannel or unsupported type: ${mainChannel?.type}`);
        return;
    }
    const fakeName = getFakeName(playerId) || 'Unknown';
    await mainChannel.send(`[${fakeName}]: ${message}`);
}

/**
 * Relay !gamecode <code> command to all player threads
 * @param {object} client
 * @param {string[]} threadIds - Array of player thread IDs
 * @param {string} code - Game code
 */
async function relayGameCode(client, mainChannelId, threadIds, code, sourceThreadId) {
    for (const [playerId, threadId] of threadIds) {
        const thread = await client.channels.fetch(threadId); // Await the fetch call
        const user = await client.users.fetch(playerId); // Await the fetch call

        // Ensure the thread exists and the user is not a bot
        if (thread && user && !user.bot && thread.id !== sourceThreadId) {
            await thread.send(`<@${user.id}> # New game code available: ${code}`); // Await the send call
        }
    }
    /*
    const mainChannel = await client.channels.fetch(mainChannelId);
    await mainChannel.send(`# New game code available: ${code}`);
    */
}

/**
 * Relay !kill <fake player name> to all player threads and staff thread
 * @param {object} client
 * @param {string[]} threadIds - Array of player thread IDs
 * @param {string} staffThreadId - Staff thread ID
 * @param {string} fakeName - Fake player name
 */

/**
 * Relay !kill <fake player name> to all player threads and staff thread, including killer info
 * @param {object} client
 * @param {string[]} threadIds - Array of player thread IDs
 * @param {string} staffThreadId - Staff thread ID
 * @param {string} fakeName - Fake player name (victim)
 * @param {string} killerFakeName - Fake name of killer
 * @param {string} killerRealName - Real name of killer
 */
async function relayKill(client, mainChannelId, threadIds, staffThreadId, fakeName, killerFakeName, killerRealName) {
    for (const [playerId, threadId] of threadIds) {
        const thread = await client.channels.fetch(threadId);
        await thread.send(`## ⚔️ ${killerFakeName} eliminated 💀 ${fakeName}`);
    }
    const staffThread = await client.channels.fetch(staffThreadId);
    await staffThread.send(`## ⚔️ ${killerRealName} aka ${killerFakeName} eliminated 💀 ${fakeName}`);

    const mainChannel = await client.channels.fetch(mainChannelId);
    await mainChannel.send(`## ⚔️ ${killerFakeName} eliminated 💀 ${fakeName}`);

}

module.exports = {
    relayPlayerMessage,
    relayGameCode,
    relayKill,
};
