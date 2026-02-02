const { REST, Routes } = require('discord.js');
const { clientId, guilds, token } = require('./riskbot_config.json');
const fs = require('node:fs');
const path = require('node:path');

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commands = [];
const commandsdev = [];
const commandsmainserver = [];

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	if (file == "roleremove.js" || file == "karma.js") {
		commandsmainserver.push(command.data.toJSON());
	} else if (file == "ffa-result.js") {
		commandsdev.push(command.data.toJSON());
	} else if (file == "1v1-result.js") {
		commandsmainserver.push(command.data.toJSON());
	} else if (file == "1v1-top10.js") {
		commandsmainserver.push(command.data.toJSON());		
	} else if (file == "create-lounge-game.js") {
		commandsdev.push(command.data.toJSON());
		//commandsmainserver.push(command.data.toJSON());		
	} else if (file == "eventlabs-create.js") {
		commandsmainserver.push(command.data.toJSON());		
	} else {
		commandsdev.push(command.data.toJSON());
		commands.push(command.data.toJSON());
		commandsmainserver.push(command.data.toJSON());
	}
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
	try {
		console.log(`Started refreshing all application (/) commands.`);

		for (const guild in guilds) {

			let commandload = commands;
			if (guild == "MAIN") {
				commandload = commandsmainserver;
			} else if (guild == "RISKDEV") {
				commandload = commandsdev;
			}
			const data = await rest.put(
				Routes.applicationGuildCommands(clientId, guilds[guild]),
				{ body: commandload },
			);
			console.log(`Successfully reloaded ${data.length} application (/) commands to ${guild}`);	
		}

	} catch (error) {
		console.error(error);
	}
})();
