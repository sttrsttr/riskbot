// eventStorage.js
// Persistent storage for event channel/thread relationships

const fs = require('fs');
const path = require('path');

const STORAGE_PATH = path.join(__dirname, 'event_storage.json');

function loadStorage() {
    if (!fs.existsSync(STORAGE_PATH)) return {};
    return JSON.parse(fs.readFileSync(STORAGE_PATH, 'utf8'));
}

function saveStorage(data) {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2));
}

function setStaffThread(guildId, mainChannelId, staffThreadId) {
    let data = loadStorage();
    // Check if the mainChannelId already exists
    if (data[mainChannelId]) {
        console.log(`Updating existing entry for mainChannelId: ${mainChannelId}`);
    } else {
        console.log(`Creating new entry for mainChannelId: ${mainChannelId}`);
    }
    if (!data[mainChannelId]) data[mainChannelId] = { guildId, staffThreadId: null, playerThreads: {} };
    data[mainChannelId].guildId = guildId;
    data[mainChannelId].staffThreadId = staffThreadId;
    saveStorage(data);
}

function getStaffThread(mainChannelId) {
    let data = loadStorage();
    return data[mainChannelId]?.staffThreadId || null;
}

function setPlayerThread(guildId, mainChannelId, playerId, threadId) {
    let data = loadStorage();
    // Check if the mainChannelId already exists
    if (data[mainChannelId]) {
        console.log(`Updating existing entry for mainChannelId: ${mainChannelId}`);
    } else {
        console.log(`Creating new entry for mainChannelId: ${mainChannelId}`);
    }

    if (!data[mainChannelId]) data[mainChannelId] = { guildId, staffThreadId: null, playerThreads: {} };
    data[mainChannelId].guildId = guildId;
    data[mainChannelId].playerThreads[playerId] = threadId;



    saveStorage(data);
}

function getPlayerThread(mainChannelId, playerId) {
    let data = loadStorage();
    return data[mainChannelId]?.playerThreads?.[playerId] || null;
}

function getAllPlayerThreads(mainChannelId) {
    let data = loadStorage();
    return Object.values(data[mainChannelId]?.playerThreads || {});
}

module.exports = {
    setStaffThread,
    getStaffThread,
    setPlayerThread,
    getPlayerThread,
    getAllPlayerThreads,
    loadStorage,
};
