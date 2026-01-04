// eventCommands.js
// Command handlers for event player management and messaging
const { createPlayerThread, changeFakeName, getFakeName } = require('./eventManager');

// Example: Add player to event and create thread
async function addPlayerToEvent(client, guildId, channelId, playerId, staffThreadId) {
    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);
    const player = await guild.members.fetch(playerId);
    const playerThread = await createPlayerThread(guild, channel, player, staffThreadId);

    // Register the player thread in event storage
    const { setPlayerThread } = require('./eventStorage');
    setPlayerThread(channelId, playerId, playerThread.id);


    return playerThread;
}

// Example: Change player's fake name
async function handleChangeFakeName(client, guildId, staffThreadId, playerId, newName) {
    const guild = await client.guilds.fetch(guildId);
    await changeFakeName(playerId, newName, staffThreadId, guild);
}

// Example: Get player's fake name
function handleGetFakeName(playerId) {
    return getFakeName(playerId);
}

module.exports = {
    addPlayerToEvent,
    handleChangeFakeName,
    handleGetFakeName,
};
