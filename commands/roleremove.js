const { SlashCommandBuilder} = require('@discordjs/builders')
const { Message, MessageAttachment, EmbedBuilder, PermissionFlagsBits} = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder()
    .setName('roleremove')
    .setDescription('Remove all users from a role')
    .addRoleOption(option =>
		option.setName('role')
			.setDescription('Which role?')
			.setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    ,
    async execute(interaction){
        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        let message = await interaction.reply(`Working on it...`);
        try{
            let role=interaction.options.getRole('role');
            const members = await interaction.guild.members.fetch();
            const membersWithRole = members.filter(member => member.roles.cache.has(role.id)); 
            for (const member of membersWithRole.values()) {
                try {
                    await member.roles.remove(role);
                    await sleep(2000);
                } catch (error) {
                    console.error(`Failed to remove role from ${member.user.tag}:`, error);
                }
            }
        }catch(err){
            console.log(err)
        }
        await interaction.editReply('All done!');
        }
    }
