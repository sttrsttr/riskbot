
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
		.setName('assassin')
		.setDescription('Assign assassin target to specified users')
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


			let errors = "Assasination assignment executed.";
			let users = [];
			let targets = [];

			const user1 = interaction.options.getMember('user1');
			const user2 = interaction.options.getMember('user2');
			const user3 = interaction.options.getMember('user3');
			const user4 = interaction.options.getMember('user4');
			const user5 = interaction.options.getMember('user5');
			const user6 = interaction.options.getMember('user6');

			let dmtargets = "";

			if (user1) {
				//console.log(user1.username);
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

			let errorcnt = 0;

			await interaction.reply({ content: "I am on it... I will send the players their targets in DM:\n"+ dmtargets, ephemeral: true });

			if (users.length > 2) {

				let targets_used = [];
				let usertarget = [];
				let attempts = 0;

				function assignTargets() {

					targets_used = [];
					usertarget[0] = "";
					usertarget[1] = "";
					usertarget[2] = "";
					if (users.length > 3) {
						usertarget[3] = "";
						if (users.length > 4) {
							usertarget[4] = "";
							if (users.length > 5) {
								usertarget[5] = "";	
							}
						}
					}

					for (i = 0; i < users.length; i++) {
						attempts = 0;
						// Loop through all users
						target = "0";
						while (target === "0" && attempts < 200) {

							var targetindex = Math.floor(Math.random()*targets.length);
							var t = targets[targetindex];
							if ((targetindex != i || i == users.length-1) && !targets_used.includes(targetindex)) {
								// Target is not this user, and the target has not been assigned before
								target = t;
								usertarget[i] = targetindex;
								targets_used.push(targetindex);
								if (i == targetindex) {
									// The last user got assigned himself as a target (he has to suicide like a noob to win). Lets just pick someone else as a target
									newtarget = Math.floor(Math.random()*(targets.length-1));
									usertarget[i] = usertarget[newtarget];
									usertarget[newtarget] = targetindex;
									errorcnt++;
								}
							}
							attempts++;
						}
					}

				}

				assignTargets();

				for (i = 0; i < users.length; i++) {

					let targetname = users[usertarget[i]].user.displayName || users[usertarget[i]].user.username || users[usertarget[i]].user.globalName || users[usertarget[i]].user.nickname;
					await users[i].send(`I've been asked by ${interactionUser.displayName} to assign you a target for an upcoming Assassin game.\n\n Your target for the game will be **${targetname}**\n\nNB: Discord username may differ from other nicknames you may know them by.\n\nBest of luck!`).catch(() => errors = errors + `\n${users[i].user.nickname} does not accept DMs. Unable to tell them their target :(`);
					console.log(users[i].user.globalName +" ==|;:;:;:;> "+ targetname);
				}

			} else {
				errors = errors + '\n\nERROR: Not enough unique users identified, unable to assign targets to everyone';
			}

			await interaction.followUp({ content: errors, ephemeral: true });
		}
};
