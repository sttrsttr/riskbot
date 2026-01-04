
const { SlashCommandBuilder } = require('discord.js');

function getRndInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1) ) + min;
}

function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('imposter')
		.setDescription('Assign imposter role among specified users')
		.addStringOption(option =>
			option.setName('imposters')
				.setDescription('How many imposters?')
				.setRequired(true)
				.addChoices(
					{ name: '2', value: '2' },
					{ name: '1', value: '1' },
					{ name: 'invalid(0)', value: '0' },
					{ name: 'invalid(2)', value: '-1' },
				)
			)	
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
		,
		async execute(interaction) {

			const interactionUser = await interaction.guild.members.fetch(interaction.user.id);


			let errors = "Imposter assignment executed.";
			let users = [];
			let targets = [];

			const impostercount = parseInt(interaction.options.getString('imposters')) ?? 2;
			const user1 = interaction.options.getMember('user1');
			const user2 = interaction.options.getMember('user2');
			const user3 = interaction.options.getMember('user3');
			const user4 = interaction.options.getMember('user4');
			const user5 = interaction.options.getMember('user5');
			const user6 = interaction.options.getMember('user6');

			let dmtargets = "";

			if (user1) {
				users.push(user1);
				targets.push(user1);
				let name = user1.user.globalName || user1.user.username || user1.displayName || user1.user.nickname;
				dmtargets = dmtargets + name + "\n";	
			}
			if (user2) {
				if (user2.user.username) {
					if (!targets.includes(user2)) {
						users.push(user2);
						targets.push(user2);
						let name = user2.user.globalName || user2.user.username || user2.displayName || user2.user.nickname;
						dmtargets = dmtargets + name + "\n";	
		
					};
				}
			}
			if (user3) {
				if (user3.user.username) {
					if (!targets.includes(user3)) {
						users.push(user3);
						targets.push(user3);
						let name = user3.user.globalName || user3.user.username || user3.displayName || user3.user.nickname;
						dmtargets = dmtargets + name + "\n";	
					};
				}
			}
			if (user4) {
				if (user4.user.username) {
					if (!targets.includes(user4)) {
						users.push(user4);
						targets.push(user4);
						let name = user4.user.globalName || user4.user.username || user4.displayName || user4.user.nickname;
						dmtargets = dmtargets + name + "\n";	
					};
				}
			}
			if (user5) {
				if (user5.user.username) {
					if (!targets.includes(user5)) {
						users.push(user5);
						targets.push(user5);
						let name = user5.user.globalName || user5.displayName || user5.user.username || user5.user.nickname;
						dmtargets = dmtargets + name + "\n";	
					};
				}
			}
			if (user6) {
				if (user6.user.username) {
					if (!targets.includes(user6)) {
						users.push(user6);
						targets.push(user6);
						let name = user6.user.globalName || user6.user.username || user6.displayName || user6.user.nickname;
						dmtargets = dmtargets + name + "\n";
					};
				}
			}


			await interaction.reply({ content: "I am on it... I will send the imposters some information in DM:\n"+ dmtargets, flags: 64 });

			if (users.length > impostercount) {

				if (impostercount == -1 && users.length == 6) {

					// Team the players into 3 teams of 2
					let imposter1 = Math.floor(Math.random()*users.length);
					let imposter2 = Math.floor(Math.random()*users.length);
					let imposter3 = Math.floor(Math.random()*users.length);
					while (imposter1 == imposter2 || imposter1 == imposter3 || imposter2 == imposter3) {
						imposter2 = Math.floor(Math.random()*users.length);
						imposter3 = Math.floor(Math.random()*users.length);
					}

					// Find a random teammate for each imposter
					let teammate1 = Math.floor(Math.random()*users.length);
					let teammate2 = Math.floor(Math.random()*users.length);
					let teammate3 = Math.floor(Math.random()*users.length);
					while (teammate1 == imposter1 || teammate1 == imposter2 || teammate1 == imposter3 || teammate1 == teammate2 || teammate1 == teammate3) {
						teammate1 = Math.floor(Math.random()*users.length);
					}
					while (teammate2 == imposter1 || teammate2 == imposter2 || teammate2 == imposter3 || teammate2 == teammate1 || teammate2 == teammate3) {
						teammate2 = Math.floor(Math.random()*users.length);
					}
					while (teammate3 == imposter1 || teammate3 == imposter2 || teammate3 == imposter3 || teammate3 == teammate1 || teammate3 == teammate2) {
						teammate3 = Math.floor(Math.random()*users.length);
					}

					// Message each player their teammate and role
					let imposter1_msg = `On behalf of ${interactionUser.displayName} I am happy to inform that YOU and ${users[teammate1].user.globalName || users[teammate1].user.username || users[teammate1].displayName || users[teammate1].user.nickname} have been chosen to be the imposters for the upcoming game. Good luck!`;
					let imposter2_msg = `On behalf of ${interactionUser.displayName} I am happy to inform that YOU and ${users[teammate2].user.globalName || users[teammate2].user.username || users[teammate2].displayName || users[teammate2].user.nickname} have been chosen to be the imposters for the upcoming game. Good luck!`;
					let imposter3_msg = `On behalf of ${interactionUser.displayName} I am happy to inform that YOU and ${users[teammate3].user.globalName || users[teammate3].user.username || users[teammate3].displayName || users[teammate3].user.nickname} have been chosen to be the imposters	for the upcoming game. Good luck!`;	
					let teammate1_msg = `On behalf of ${interactionUser.displayName} I am happy to inform that YOU and ${users[imposter1].user.globalName || users[imposter1].user.username || users[imposter1].displayName || users[imposter1].user.nickname} have been chosen to be the imposters	for the upcoming game. Good luck!`;
					let teammate2_msg = `On behalf of ${interactionUser.displayName} I am happy to inform that YOU and ${users[imposter2].user.globalName || users[imposter2].user.username || users[imposter2].displayName || users[imposter2].user.nickname} have been chosen to be the imposters	for the upcoming game. Good luck!`;
					let teammate3_msg = `On behalf of ${interactionUser.displayName} I am happy to inform that YOU and ${users[imposter3].user.globalName || users[imposter3].user.username || users[imposter3].displayName || users[imposter3].user.nickname} have been chosen to be the imposters	for the upcoming game. Good luck!`;

					try {
						await users[imposter1].send(imposter1_msg).catch(() => errors = errors + `\n${users[imposter1]} does not accept DMs. Unable to tell them they are imposters`);
						await users[imposter2].send(imposter2_msg).catch(() => errors = errors + `\n${users[imposter2]} does not accept DMs. Unable to tell them they are imposters`);
						await users[imposter3].send(imposter3_msg).catch(() => errors = errors + `\n${users[imposter3]} does not accept DMs. Unable to tell them they are imposters`);
						await users[teammate1].send(teammate1_msg).catch(() => errors = errors + `\n${users[teammate1]} does not accept DMs. Unable to tell them their target :(`);
						await users[teammate2].send(teammate2_msg).catch(() => errors = errors + `\n${users[teammate2]} does not accept DMs. Unable to tell them their target :(`);
						await users[teammate3].send(teammate3_msg).catch(() => errors = errors + `\n${users[teammate3]} does not accept DMs. Unable to tell them their target :(`);

					} catch (error) {
						console.error(error);
						await interaction.followUp({ content: "Error running command, please try again later", flags: 64 });
					}

				} else {

					if (impostercount == -1) {
						impostercount = 2;
					}

					let imposter1 = Math.floor(Math.random()*users.length);
					let imposter2 = Math.floor(Math.random()*users.length);

				while (imposter1 == imposter2) {
					imposter2 = Math.floor(Math.random()*users.length);
				}
				let imposter2_name;
				let imposter2_msg;

				let imposter1_name = users[imposter1].user.globalName || users[imposter1].user.username || users[imposter1].displayName || users[imposter1].user.nickname;
				let imposter1_msg = `On behalf of ${interactionUser.displayName} I am happy to inform that YOU have been chosen to be the imposter for the upcoming game. Good luck!`;

				imposter2_name = users[imposter2].user.globalName || users[imposter2].user.username || users[imposter2].displayName || users[imposter2].user.nickname;
				imposter1_msg = `On behalf of ${interactionUser.displayName} I am happy to inform that YOU and ${imposter2_name} have been chosen to be the imposter for the upcoming game. Good luck!`;
				imposter2_msg = `On behalf of ${interactionUser.displayName} I am happy to inform that YOU and ${imposter1_name} have been chosen to be the imposters for the upcoming game. Good luck!`;


					try {



						if (impostercount > 0) {
							await users[imposter1].send(imposter1_msg).catch(() => errors = errors + `\n${users[imposter1]} does not accept DMs. Unable to tell them they are imposters`);
						} else {
							imposter1 = -1;
							imposter2 = -1;
						}
						if (impostercount > 1) {
							await users[imposter2].send(imposter2_msg).catch(() => errors = errors + `\n${users[imposter2]} does not accept DMs. Unable to tell them they are imposters`);
						} else {
							imposter2 = -1;
						}
		
						for (i = 0; i < users.length; i++) {
							if (i != imposter1 && i != imposter2) {
								await users[i].send(`On behalf of ${interactionUser.displayName} I am happy to inform that YOU are NOT an imposter for the upcoming game. Good luck!`).catch(() => errors = errors + `\n${users[i].user.nickname} does not accept DMs. Unable to tell them their target :(`);
							}
						}
					
					} catch (error) {
						console.error(error);
						await interaction.followUp({ content: "Error running command, please try again later", flags: 64 });
					}


				}



			} else {
				errors = errors + '\n\nERROR: Not enough unique users identified, unable to assign imposters';
			}

			await interaction.followUp({ content: errors, flags: 64 });
		}
};
