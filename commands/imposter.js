
const { SlashCommandBuilder, MessageFlags } = require('discord.js');

function consoleLog(message) {
  const now = new Date();
  const isoString = now.toISOString();
  console.log(`${isoString}: ${message}`);
}

async function interactionReply(interaction, content, flags = undefined, options = {}) {
  consoleLog(`Replying to interaction with content: ${content}`);
  if (flags === undefined) {
    flags = MessageFlags.Ephemeral
  }
  let args = {
    content: content,
    flags: flags,
    ...options
  }
  if (interaction.deferred) {
    await interaction.followUp(args);
  } else {
    await interaction.reply(args);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('imposter')
    .setDescription('Assign imposter role among specified users')
    .addUserOption(option =>
      option
        .setName('user1')
        .setDescription('user1')
        .setRequired(true)
    )
    .addUserOption(option =>
      option
        .setName('user2')
        .setDescription('user2')
        .setRequired(true)
    )
    .addUserOption(option =>
      option
        .setName('user3')
        .setDescription('user3')
        .setRequired(true)
    )
    .addUserOption(option =>
      option
        .setName('user4')
        .setDescription('user4')
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName('user5')
        .setDescription('user5')
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName('user6')
        .setDescription('user6')
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName('host')
        .setDescription('The host of the game')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('imposters')
        .setDescription('How many imposters?')
        .setRequired(false)
        .addChoices(
          { name: '2 imposters', value: '2' },
          { name: '1 imposter', value: '1' },
        )
    ),
  async execute(interaction) {
    const author = interaction.user;
    //consoleLog(`Imposter command invoked by ${author.username} in guild ${interaction.guildId}`);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const host = interaction.options.getUser("host");
    const cantBendRules = (author.id != "415848204136087563"); // Lany can bend rules a bit.Added only for testing purposes
    const imposterCount = interaction.options.getInteger("imposters") ?? 2;
    let users = [];
    let userIds = [];
    for (let i = 1; i <= 6; i++) {
      const user = interaction.options.getUser(`user${i}`);
      if (null === user) {
        continue;
      }
      if (user.bot && cantBendRules) {
        await interactionReply(interaction, `You cannot specify a bot as a player!`);
        return;
      }
      if (host && user.id === host.id && cantBendRules) {
        await interactionReply(interaction, `You cannot specify the host as a player!`);
        return;
      }
      if (userIds.includes(user.id) && cantBendRules) {
        await interactionReply(interaction, `You cannot specify the same user multiple times!`);
        return;
      }
      users.push(user);
      userIds.push(user.id);
    }
    if (users.length <= imposterCount) {
      await interactionReply(interaction, `Not enough unique users identified, unable to assign imposters`);
      return;
    }
    const userCount = users.length;
    const imposter1 = Math.floor(Math.random() * users.length);
    let imposter2;
    if (imposterCount === 2) {
      do {
        imposter2 = Math.floor(Math.random() * users.length);
      } while (imposter1 === imposter2);
    }
    const isSolo = imposter2 === undefined;
    let userSettings = [];
    for (let i = 0; i < users.length; i++) {
      let isImposter = i === imposter1 || i === imposter2;
      userSettings.push({
        user: users[i],
        role: isImposter ? "Imposter" : "Crewmate",
        isImposter: isImposter
      });
    }
    const hostString = host ? `${host.username}` : "No host";
    if (host) {
      let fields = [
        {
          name: "Game Creator",
          value: `${author.username}`,
          inline: true,
        },
        {
          name: "Host",
          value: hostString,
          inline: true,
        },
        {
          name: "Player Count",
          value: `${userCount}`,
          inline: true,
        },
        {
          name: "Imposter Count",
          value: `${imposterCount}`,
          inline: true,
        }
      ];
      let fields2 = [];
      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const userSetting = userSettings[i];
        fields2.push({
          name: `${user.username}`,
          value: `${userSetting.role}`,
          inline: true,
        });
      }
      let embeds = [
        {
          title: `Rigged Caps Game`,
          description: `You are the host for this game.`,
          fields: fields,
          timestamp: new Date().toISOString(),
        },
        {
          title: `Players`,
          fields: fields2,
        },
      ];
      try {
        await host.send({
          content: "Rigged Caps Game Started.",
          embeds: embeds,
        });
      } catch (err) {
        const responseMessage = err.code === 50007 ?
          `Could not send DM to host! Host must enable DMs from server members and try again.` :
          `Error sending DM to host! ${err.message}`;
        //consoleLog(responseMessage);
        await interactionReply(interaction, responseMessage);
        return;
      }
    }
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const userSetting = userSettings[i];
      let fields = [
        {
          name: "Game Creator",
          value: `${author.username}`,
          inline: true,
        },
        {
          name: "Host",
          value: hostString,
          inline: true,
        },
        {
          name: "Role",
          value: userSetting.role,
          inline: true,
        },
      ];
      if (userSetting.isImposter && !isSolo) {
        const teamMate = i === imposter1 ? users[imposter2] : users[imposter1];
        fields.push({
          name: "Teammate",
          value: `${teamMate.username}`,
          inline: true,
        });
      }
      let embed = {
        title: `Rigged Caps Game`,
        description: `You have been assigned a role of **${userSetting.role}**.`,
        fields: fields,
        timestamp: new Date().toISOString(),
      };
      try {
        await user.send({
          content: "Rigged Caps Game Started.",
          embeds: [embed],
        });
      } catch (err) {
        const errorRecipient = host ? host : interaction.user;
        const responseMessage = err.code === 50007 ?
          `Could not send DM to ${user.username}! They must enable DMs from server members and try again.` :
          `Error sending DM to ${user.username}! ${err.message}`;
        //consoleLog(responseMessage);
        try {
          await errorRecipient.send(responseMessage);
        } catch (err2) {
            //consoleLog(`Also could not send error message to host/author. ${err2.message}`);
            interactionReply(interaction, `Error sending DM to ${user.username}, and could not notify the host/author!\n${err.message}\n${err2.message}`);
            return;
        }
      }
    }
    await interactionReply(interaction, `The Rigged Caps game has been started!`);
  }
};
