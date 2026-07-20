//////////////////////////////////////////////////////////////////////
// One-off migration: move existing events onto the button-based
// signup process. For each event it:
//   1. Creates a new locked "📝 commands" thread under the main channel
//      (matching commands/create-event.js).
//   2. Posts the self-service message with the correct signup button for
//      the event's current signupstatus (OPEN -> "Sign up",
//      WAITLIST -> "Join waitlist", CLOSED -> no signup button).
//   3. Locks the new thread and stores signupchannel + signupmessage.
//   4. Locks & archives the old signup thread, leaving a pointer to the
//      new thread.
//
// SAFETY:
//   - Dry-run by default. Pass --commit to actually perform changes.
//   - Idempotent: skips any event that already has a signupmessage set
//     (unless --force is given).
//   - The bot serving button clicks MUST already be running the new code
//     (interactions/signup.js -> signupHandler), otherwise the migrated
//     buttons will not work.
//
// Usage:
//   node scripts/migrate-signup-buttons.js            # dry run, events 180 182
//   node scripts/migrate-signup-buttons.js --commit    # perform changes
//   node scripts/migrate-signup-buttons.js --commit 180 182 190
//////////////////////////////////////////////////////////////////////

const mysql = require('mysql2');
const {
    Client,
    GatewayIntentBits,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

global.config = require('../riskbot_config.json');
const config = global.config;

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const FORCE = args.includes('--force');
// --in-place: reuse the event's existing signup thread instead of creating a
// new one (for channels where the bot lacks Create Public Threads).
const IN_PLACE = args.includes('--in-place');
const EVENT_IDS = args.filter(a => /^\d+$/.test(a)).map(Number);
const TARGET_IDS = EVENT_IDS.length > 0 ? EVENT_IDS : [180, 182];

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
    );

    const content = `# Self service channel\n\nPlease use the buttons below to interact with this event.\n\n## Signup status: ${status}`;
    return { content, components: [row] };
}

async function migrateEvent(client, con, event) {
    const status = event.signupstatus;
    log(`\n=== Event ${event.id} "${event.name}" (status ${status}) ===`);

    if (event.signupmessage && !FORCE) {
        log(`  SKIP: already has signupmessage ${event.signupmessage} (use --force to redo)`);
        return;
    }

    const guild = await client.guilds.fetch(String(event.serverid));
    const mainchannel = await guild.channels.fetch(String(event.mainchannel));
    if (!mainchannel) throw new Error(`main channel ${event.mainchannel} not found`);

    const { content, components } = buildMessage(status);
    const buttonDesc = status === 'CLOSED' ? '[availability, rules]' : status === 'WAITLIST' ? '[Join waitlist, availability, rules]' : '[Sign up, availability, rules]';

    // ---- In-place mode: reuse the existing signup thread ----
    if (IN_PLACE) {
        if (!COMMIT) {
            log(`  [dry-run] would reuse existing thread ${event.signupchannel}, post message + buttons: ${buttonDesc}, and lock it`);
            return;
        }
        const thread = await guild.channels.fetch(String(event.signupchannel));
        if (!thread) throw new Error(`existing signup thread ${event.signupchannel} not found`);
        if (thread.archived) await thread.setArchived(false);
        if (thread.locked) await thread.setLocked(false);
        const msg = await thread.send({ content, components });
        await thread.setLocked(true);
        await query(con, "UPDATE `" + config.mysql_database + "`.`eventmanager__events` SET `signupmessage` = " + msg.id + " WHERE `id` = " + event.id + "");
        log(`  reused thread ${thread.id}, posted signup message ${msg.id}, locked it, DB updated (signupmessage=${msg.id})`);
        return;
    }

    if (!COMMIT) {
        log(`  [dry-run] would create locked "📝 commands" thread under #${mainchannel.name} (${mainchannel.id})`);
        log(`  [dry-run] would post message + buttons: ${buttonDesc}`);
        log(`  [dry-run] would repoint signupchannel from ${event.signupchannel} to <new thread>`);
        log(`  [dry-run] would lock & archive old thread ${event.signupchannel}`);
        return;
    }

    // 1. Create the new locked commands thread under the main channel
    const newThread = await mainchannel.threads.create({
        name: '📝 commands',
        type: ChannelType.PublicThread,
        autoArchiveDuration: 10080,
        reason: `Signup process migration for event ${event.id}`,
    });
    log(`  created new thread ${newThread.id}`);

    // 2. Post the self-service message and lock the thread
    const msg = await newThread.send({ content, components });
    await newThread.setLocked(true);
    log(`  posted signup message ${msg.id} and locked thread`);

    // 3. Store the new signupchannel + signupmessage
    await query(con, "UPDATE `" + config.mysql_database + "`.`eventmanager__events` SET `signupchannel` = " + newThread.id + ", `signupmessage` = " + msg.id + " WHERE `id` = " + event.id + "");
    log(`  DB updated: signupchannel=${newThread.id}, signupmessage=${msg.id}`);

    // 4. Retire the old signup thread
    try {
        const oldThread = await guild.channels.fetch(String(event.signupchannel));
        if (oldThread) {
            const newUrl = `https://discord.com/channels/${event.serverid}/${newThread.id}`;
            if (oldThread.archived) await oldThread.setArchived(false);
            if (oldThread.locked) await oldThread.setLocked(false);
            await oldThread.send(`This channel has moved. Please use the new self-service thread: ${newUrl}`);
            await oldThread.setLocked(true);
            await oldThread.setArchived(true);
            log(`  old thread ${event.signupchannel} locked & archived`);
        }
    } catch (e) {
        log(`  WARN: could not retire old thread ${event.signupchannel}: ${e.message}`);
    }
}

async function main() {
    log(`Signup migration — targets: ${TARGET_IDS.join(', ')} | mode: ${COMMIT ? 'COMMIT' : 'DRY-RUN'}${FORCE ? ' | FORCE' : ''}`);

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
            await migrateEvent(client, con, event);
        } catch (e) {
            log(`  ERROR on event ${event.id}: ${e.message}`);
        }
    }

    await client.destroy();
    con.end();
    log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
