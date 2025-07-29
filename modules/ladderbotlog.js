const { guilds } = require('../riskbot_config.json');

async function ladderbotlog(client,message) {

    const guild = await client.guilds.fetch(guilds.RETRYGAMES);
    const channel = await guild.channels.fetch('1214262432332120064');
    channel.send(message, { allowedMentions: { repliedUser: false } });

}


module.exports = {
    ladderbotlog,
};