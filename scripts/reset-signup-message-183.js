//////////////////////////////////////////////////////////////////////
// One-off: reset the "📝 commands" thread for a single event.
//   1. Deletes all messages in the event's existing commands thread
//      (signupchannel).
//   2. Posts the self-service message with the correct signup button for
//      the event's current signupstatus (OPEN -> "Sign up",
//      WAITLIST -> "Join waitlist", CLOSED -> no signup button),
//      matching scripts/migrate-signup-buttons.js buildMessage().
//   3. Stores the new signupmessage id in the DB.
//
// SAFETY:
//   - Dry-run by default. Pass --commit to actually perform changes.
//
// Usage:
//   node scripts/reset-signup-message-183.js            # dry run, event 183
//   node scripts/reset-signup-message-183.js --commit    # perform changes
//   node scripts/reset-signup-message-183.js --commit 183 190
//////////////////////////////////////////////////////////////////////

const mysql = require('mysql2');
const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

global.config = require('../riskbot_config.json');
const config = global.config;

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const EVENT_IDS = args.filter(a => /^\d+$/.test(a)).map(Number);
const TARGET_IDS = EVENT_IDS.length > 0 ? EVENT_IDS : [183];

function log(...a) { console.log(...a); }

function query(con, sql) {
    return new Promise((resolve, reject) => {
        con.query(sql, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
}

function buildMessage(status) {
    const row = new ActionRowBuilder();

    if (status === 'OPEN') {
        row.addComponents(new ButtonBuilder()
            .setCustomId('signup').setLabel('Sign up').setStyle(ButtonStyle.Success));
    } else if (status === 'WAITLIST') {
        row.addComponents(new ButtonBuilder()
            .setCustomId('signup').setLabel('Join waitlist').setStyle(ButtonStyle.Success));
    }

    row.addComponents(
        new ButtonBuilder().setCustomId('availability').setLabel('Set up your availability').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('rulesinfo').setLabel('Rules and info').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('contactstaff').setLabel('Contact staff').setStyle(ButtonStyle.Danger),
    );

    const content = `# Self service channel\n\nPlease use the buttons below to interact with this event.\n\n## Signup status: ${status}`;
    return { content, components: [row] };
}

// Delete every message in a thread. Bulk-delete what we can (< 14 days),
// fall back to individual deletes for the rest. Ignores messages that
// can't be deleted (e.g. the thread-starter system message).
async function purgeThread(thread) {
    let deleted = 0;
    let failed = 0;
    while (true) {
        const batch = await thread.messages.fetch({ limit: 100 });
        if (batch.size === 0) break;

        for (const msg of batch.values()) {
            try {
                await msg.delete();
                deleted++;
            } catch (e) {
                failed++;
                log(`    WARN: could not delete message ${msg.id}: ${e.message}`);
            }
        }
        // If nothing in this batch was deletable, stop to avoid an infinite loop.
        if (batch.size > 0 && deleted === 0 && failed >= batch.size) break;
    }
    return { deleted, failed };
}

async function resetEvent(client, con, event) {
    const status = event.signupstatus;
    log(`\n=== Event ${event.id} "${event.name}" (status ${status}) ===`);

    const guild = await client.guilds.fetch(String(event.serverid));
    const thread = await guild.channels.fetch(String(event.signupchannel));
    if (!thread) throw new Error(`signup/commands thread ${event.signupchannel} not found`);

    const { content, components } = buildMessage(status);
    const buttonDesc = status === 'CLOSED' ? '[availability, rules]' : status === 'WAITLIST' ? '[Join waitlist, availability, rules]' : '[Sign up, availability, rules]';

    if (!COMMIT) {
        const preview = await thread.messages.fetch({ limit: 100 });
        log(`  [dry-run] thread ${thread.id} (#${thread.name}) currently has >= ${preview.size} message(s) in the latest page`);
        log(`  [dry-run] would delete all messages in the thread`);
        log(`  [dry-run] would post self-service message + buttons: ${buttonDesc}`);
        log(`  [dry-run] would set signupmessage in DB for event ${event.id}`);
        return;
    }

    if (thread.archived) await thread.setArchived(false);
    if (thread.locked) await thread.setLocked(false);

    const { deleted, failed } = await purgeThread(thread);
    log(`  purged thread ${thread.id}: ${deleted} deleted, ${failed} skipped`);

    const msg = await thread.send({ content, components });
    log(`  posted signup message ${msg.id}`);

    await query(con, "UPDATE `" + config.mysql_database + "`.`eventmanager__events` SET `signupmessage` = " + msg.id + " WHERE `id` = " + event.id + "");
    log(`  DB updated: signupmessage=${msg.id}`);
}

async function main() {
    log(`Signup message reset — targets: ${TARGET_IDS.join(', ')} | mode: ${COMMIT ? 'COMMIT' : 'DRY-RUN'}`);

    const con = mysql.createConnection({
        host: config.mysql_host,
        user: config.mysql_username,
        password: config.mysql_password,
        database: config.mysql_database,
        supportBigNumbers: true,
        bigNumberStrings: true,
    });
    await new Promise((res, rej) => con.connect(e => e ? rej(e) : res()));

    const events = await query(con, "SELECT * FROM `" + config.mysql_database + "`.`eventmanager__events` WHERE `id` IN (" + TARGET_IDS.join(',') + ")");
    if (events.length === 0) { log('No matching events found.'); con.end(); return; }

    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    await client.login(config.token);
    await new Promise(res => client.once('clientReady', res));
    log(`Logged in as ${client.user.tag}`);

    for (const event of events) {
        try {
            await resetEvent(client, con, event);
        } catch (e) {
            log(`  ERROR on event ${event.id}: ${e.message}`);
        }
    }

    await client.destroy();
    con.end();
    log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
