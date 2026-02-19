const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');
const progressFile = path.join(__dirname, 'member_scan_progress.json');
const { Guild } = require('discord.js');

async function processBatch(members, guildId) {
    // Your batch processing logic here

    const targetDate = new Date('2025-09-08T00:00:00Z').getTime();
    const roleId = '1414643032002920468';

    // Store the message ID via API
    const options = {
        hostname: 'friendsofrisk.com',
        path: '/openapi/getAllSignups',
        method: 'POST',
    };

    const postData = JSON.stringify({
        serverid: guildId
    });

    const req = https.request(options, (res) => {        
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            const signedupIds = JSON.parse(data);
            // Use signedupIds here
        });
    });
    req.write(postData);
    req.end();
    
    const signedupSet = new Set(signedupIds);

    for (const member of members.values()) {
        if (member.joinedTimestamp > targetDate) {

            if (!signedupSet.has(member.id)) {

  //              console.log(`Member ${member.user.tag} (${member.user.id}) have joined but not signed up.`);

                // Your logic here
                if (!member.roles.cache.has(roleId)) {
                    await member.roles.add(roleId).catch(console.error);
                }
            } else {
                // Console log that the user is already signed up
//                console.log(`Member ${member.user.tag} (${member.user.id}) is already signed up for some events in this server.`);

                // Remove role if they have it
                if (member.roles.cache.has(roleId)) {
                    await member.roles.remove(roleId).catch(console.error);
                }
            }
        }
    }
}

function loadProgress() {
    if (fs.existsSync(progressFile)) {
        const data = fs.readFileSync(progressFile, 'utf8');
        try {
            const parsed = JSON.parse(data);
            return parsed.lastMemberId || undefined;
        } catch {
            return undefined;
        }
    }
    return undefined;
}

function saveProgress(lastMemberId) {
    fs.writeFileSync(progressFile, JSON.stringify({ lastMemberId }), 'utf8');
}

async function checkNewButNotSignedUp(client, guildId) {
    let lastMemberId = loadProgress();
    let count = 0;
    const batchSize = 1000;
    const guild = await client.guilds.fetch(guildId);

    while (true) {

//        console.log(`STARTING NEW BATCH\nFetching members after ID: ${lastMemberId || 'start'}`);

        // Only include 'after' if lastMemberId is defined
        const fetchOptions = lastMemberId
            ? { limit: batchSize, after: lastMemberId }
            : { limit: batchSize };
        const members = await guild.members.list(fetchOptions);

        count += members.size;
        console.log(`Fetched ${members.size} members, total processed: ${count}`);

        if (members.size === 0) break;
        const newLastMemberId = Array.from(members.values()).pop().id;

        // Break if we've reached the end or lastMemberId did not advance
        if (newLastMemberId === lastMemberId) break;

        await processBatch(members, guildId);

        if (members.size < batchSize) break;

        lastMemberId = newLastMemberId;
        saveProgress(lastMemberId);

        await new Promise(res => setTimeout(res, 1000));
    }

    // Only reset progress after full scan
    saveProgress(undefined);

    console.log('Member scan completed. Total members processed:', count);
}

module.exports = {
    checkNewButNotSignedUp,
};