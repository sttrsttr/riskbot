// eventManager.js
// Functions for event channel, threads, fake names, and player management

const { ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { setPlayerThread, loadStorage } = require('./eventStorage');

const FAKE_NAMES_DB = path.join(__dirname, 'event_fake_names.json');


// Global set to track player threads with listeners
const playerThreadsWithListeners = new Set();
// Load event configurations from local storage
const eventStorage = loadStorage();


Object.entries(eventStorage).forEach(([mainChannelId, eventConfig]) => {
    const config = {
        guildId: eventConfig.guildId || 'UNKNOWN_GUILD', // Replace with actual logic if needed
        mainChannelId: mainChannelId,
        staffThreadId: eventConfig.staffThreadId,
        playerThreadIds: Object.values(eventConfig.playerThreads || {}),
    };

    // Set up event thread listeners for each event if playerThreadIds > 0
    if (config.playerThreadIds.length > 0) {

        for (const threadId of config.playerThreadIds) {
            playerThreadsWithListeners.add(threadId);
        }

    }
});



function loadFakeNames() {
    if (!fs.existsSync(FAKE_NAMES_DB)) return {};
    return JSON.parse(fs.readFileSync(FAKE_NAMES_DB, 'utf8'));
}

function saveFakeNames(data) {
    fs.writeFileSync(FAKE_NAMES_DB, JSON.stringify(data, null, 2));
}

function generateFakeName() {
    const names1 = [
        'Alpha', 'Bravo', 'Delta', 'Echo', 'Golf', 'Hotel', 'Kilo', 'Lima',
        'Mike', 'Papa', 'Romeo', 'Mama', 'Sierra', 'Tango',
        'Uniform', 'Victor', 'Whiskey', 'Xray', 'Yankee', 'Zulu',
        'General', 'Major', 'Captain', 'Clumsy', 'Loser', 'Nerd', 'Joker', 'Goofball', 'Dork', 'Weirdo'
    ];
    const names2 = [
        'Wolf', 'Tiger', 'Eagle', 'Shark', 'Bear', 'Lion',
        'Falcon', 'Panther', 'Cobra', 'Viper', 'Jaguar', 'Leopard',
        'Hawk', 'Raven', 'Fox', 'Otter', 'Puma', 'Lynx',
        'Cheetah', 'Gazelle', 'Moose', 'Bison', 'Walrus', 'Penguin',
        'Dolphin', 'Whale', 'Octopus', 'Crab', 'Lobster', 'Seahorse',
        'Koala', 'Kangaroo', 'Platypus', 'Armadillo', 'Sloth', 'Porcupine'
    ];
    const adjectives = [
        'Sweet', 'Soft', 'Tired', 'Brave', 'Calm', 'Wild', 'Gentle', 'Fierce', 'Happy', 'Sad',
        'Quick', 'Slow', 'Smart', 'Silly', 'Loud', 'Quiet', 'Shy', 'Bold', 'Lazy', 'Busy',
        'Energetic', 'Charming', 'Fearless', 'Kind', 'Playful', 'Cheerful', 'Clever', 'Daring',
        'Friendly', 'Graceful', 'Humble', 'Loyal', 'Sleepy', 'Fast', 'Angry', 'Mad'
    ];
    const rand1 = names1[Math.floor(Math.random() * names1.length)];
    const rand2 = names2[Math.floor(Math.random() * names2.length)];
    const randAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randNum = Math.floor(Math.random() * 90) + 10;
    return `${randAdj} ${rand1}${rand2} ${randNum}`;
}

async function createPlayerThread(guild, channel, player, staffThreadId) {
    // Create private thread for player
    const thread = await channel.threads.create({
        name: `${player.displayName || player.user.username}-private`,
        type: ChannelType.PrivateThread,
        autoArchiveDuration: 10080,
    });
    await thread.members.add(player.id);
    // Ask for fake name
    let fakeNames = loadFakeNames();
    let fakeName = generateFakeName();
    fakeNames[player.id] = fakeName;
    saveFakeNames(fakeNames);

    setPlayerThread(guild.id, channel.id, player.id, thread.id);

    // Notify staff thread
    const staffThread = await guild.channels.fetch(staffThreadId);
    if (!staffThread || staffThread.type !== ChannelType.PrivateThread) {
        console.error(`Invalid staff thread: ${staffThreadId}`);
        return;
    }
    await staffThread.send(`Player: ${player.displayName || player.user.username} (ID: ${player.id}) assigned fake name: ${fakeName}`);

    await thread.send(`Hello <@${player.id}>,\n\nwelcome to your private thread.\n\nWe will from now on refer to you as ${fakeName}\n\nUse \`!name <your new name>\` to change your alt name. You can change name at any time during the event.\n\nUse \`!gamecode\` to post a game code.\n\nUSe \`!kill <name of who you killed>\` to report a kill.\n\n`);
    // Assign random fake name if not confirmed

    // Add the new thread to the global set
    if (!playerThreadsWithListeners.has(thread.id)) {
        playerThreadsWithListeners.add(thread.id);
    }

    return thread.id;
}

async function changeFakeName(playerId, newName, staffThreadId, guild) {
    console.log(`changeFakeName called with playerId: ${playerId}, newName: ${newName}, staffThreadId: ${staffThreadId}`);
    let fakeNames = loadFakeNames();
    fakeNames[playerId] = newName;
    saveFakeNames(fakeNames);
    // Notify staff thread
    const staffThread = await guild.channels.fetch(staffThreadId);
    if (!staffThread || staffThread.type !== ChannelType.PrivateThread) {
        console.error(`Invalid staff thread: ${staffThreadId}`);
        return;
    }
    const player = await guild.members.fetch(playerId);
    const realName = player.displayName || player.user.username;
    await staffThread.send(`Player: ${realName} (ID: ${playerId}) changed fake name to: ${newName}`);
}

function getFakeName(playerId) {
    let fakeNames = loadFakeNames();
    if (!fakeNames[playerId]) {
        console.warn(`No fake name found for player ID: ${playerId}`);
    }
    return fakeNames[playerId] || null;
}

// Add a user to the private staff thread for an event
async function addUserToStaffThread(client, serverId, staffThreadId, userId) {
    try {
        const guild = await client.guilds.fetch(serverId);
        if (!guild) {
            console.log('Guild not found');
            return;
        }
        const staffThread = await guild.channels.fetch(staffThreadId);
        if (!staffThread || staffThread.type !== ChannelType.PrivateThread) {
            console.log('Staff thread not found or not private');
            return;
        }
        const member = await guild.members.fetch(userId);
        await staffThread.members.add(member);

        // Grant staff permissions in the event channel
        const eventStorage = loadStorage();
        const mainChannelId = Object.keys(eventStorage).find(id => eventStorage[id].staffThreadId === staffThreadId);
        if (mainChannelId) {
            const mainChannel = await guild.channels.fetch(mainChannelId);
            if (mainChannel) {
                await mainChannel.permissionOverwrites.edit(userId, {
                    ViewChannel: true,
                    ManageChannels: true,
                    SendMessages: true,
                    UseApplicationCommands: true,
                });
            }
        }

        return 'SUCCESS';
    } catch (error) {
        console.error('Error adding user to staff thread:', error);
        return 'ERROR';
    }
}

module.exports = {
    createPlayerThread,
    changeFakeName,
    getFakeName,
    generateFakeName,
    addUserToStaffThread,
    playerThreadsWithListeners,
};
