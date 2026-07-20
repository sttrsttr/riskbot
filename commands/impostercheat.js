// This command is hidden from everyone by default (setDefaultMemberPermissions(0) below). It isn't
// config-driven — a server admin must grant it to specific roles per-server via Discord's own Integrations
// settings (Server Settings > Integrations > riskbot > /impostercheat).

const { SlashCommandBuilder } = require('discord.js');
const { runImposterGame } = require('../modules/impostergame.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('impostercheat')
    .setDescription('Assign imposter role among specified users, with control over who is picked')
    .setDefaultMemberPermissions(0)
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
    .addIntegerOption(option =>
      option.setName('imposters')
        .setDescription('How many imposters?')
        .setRequired(false)
        .addChoices(
          { name: '2 imposters', value: 2 },
          { name: '1 imposter', value: 1 },
        )
    )
    .addUserOption(option =>
      option
        .setName('imposter1')
        .setDescription('Force this player to be an imposter (must be one of the specified players)')
        .setRequired(false)
    )
    .addUserOption(option =>
      option
        .setName('imposter2')
        .setDescription('Force this player to be the second imposter (requires imposter1, and imposters=2)')
        .setRequired(false)
    ),
  async execute(interaction) {
    const forcedImposterId1 = interaction.options.getUser('imposter1')?.id;
    const forcedImposterId2 = interaction.options.getUser('imposter2')?.id;
    await runImposterGame(interaction, { forcedImposterId1, forcedImposterId2 });
  }
};
