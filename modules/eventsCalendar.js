const https = require('https');

// Refresh event calendar discord message
function refreshtournamentcalendar() {

	if (global.config.for_api_key === undefined || global.config.for_api_key === "") {
		console.log("No Friends of Risk API key configured, skipping tournament calendar refresh.");
		return;
	}

	let messageContent = 'Discord Tournament Calendar (upcoming events)\n\nYou can also look up these events with more information about how to signup etc on [friendsofrisk.com/calendar](https://www.friendsofrisk.com/calendar)\n\nThe Friends of Risk webpage is not affiliated with Risk: Global Domination, SMG or Hasbro, and the calendar includes unofficial tournaments not affiliated with the official Discord server.\n\n'; // Customize the message content

	try {
		https.get('https://friendsofrisk.com/openapi/getCalendar', (resp) => {
			let data = '';
			resp.on('data', (chunk) => {
				data += chunk;
			});
			resp.on('end', () => {
				const result = JSON.parse(data);
				for (const event of result) {
					messageContent = messageContent + `## ${event.name}\n`;
					messageContent = messageContent + `> [${event.hostserverid}]\n`;
					if (event.start_date_year != "4000") {
						messageContent = messageContent + `> Event starts ${event.start_date}\n> Events ends ${event.end_date}\n`;
					} else {
						messageContent = messageContent + `> Dates TBA\n`;
					}
					if (event.signup_start_date_year != "4000") {
						if (event.daystillsignup > 0) {
							messageContent = messageContent + `> Signups opens ${event.signup_start_date}\n`;
						} else {
							messageContent = messageContent + `> **Open for signups**!\n`;
						}
						messageContent = messageContent + `> Signups deadline ${event.signup_close_date}\n\n`;
					} else {
						messageContent = messageContent + `> Signups dates TBA\n\n`;
					}
				}
				messageContent = messageContent + "View more information about these events on [Friends of Risk](https://www.friendsofrisk.com/calendar) (third party website)";

				const options = {
					hostname: 'friendsofrisk.com',
					path: '/m2mapi/getCalendarChannels',
					method: 'GET',
					headers: {
						'X-API-KEY': global.config.for_api_key 
					}
				};

				https.get(options, (resp) => {
					let data = '';
					resp.on('data', (chunk) => {
						data += chunk;
					});
					resp.on('end', () => {
						const result = JSON.parse(data);
						for (const serverinfo of result) {
                            const guild = global.client.guilds.cache.get(serverinfo.serverid);
                            if (!guild) {
                                console.log(`Guild with ID ${serverinfo.serverid} not found.`);
                                continue;
                            }
							const channel = guild.channels.cache.get(serverinfo.singlemessagechannel);
							if (channel) {

								if (serverinfo.messageid !== null) {
									//console.log("Have to update message "+ serverinfo.messageid);

									channel.messages.fetch(serverinfo.messageid).then(
										existingMessage => {
											if (!existingMessage) {
												console.log('Message not found.');
											}
											// Edit the existing message
											existingMessage.edit(messageContent)
												.then(editedMessage => {
													//									console.log(`Message edited in ${channel.name} (${editedMessage.guild.name})`);
												})
												.catch(error => console.error(`Error editing message: ${error}`));
										}
									)

								} else {
									if (channel) {
										// Send the message to the channel
										channel.send(messageContent)
											.then(sentMessage => {
												//console.log(`Message sent to ${guild.name} (${sentMessage.guild.id})`);

												// Store the message ID via API
												const options = {
													hostname: 'friendsofrisk.com',
													path: '/m2mapi/updateCalendarChannel',
													method: 'POST',
													headers: {
														'X-API-KEY': global.config.for_api_key 
													}
												};

												const postData = JSON.stringify({
													messageid: sentMessage.id,
													serverid: guild.id
												});

												const req = https.request(options, (res) => {
													
												});
												req.write(postData);
												req.end();

											})
											.catch(error => console.error(`Error sending message to ${guild.name} (${guild.id}): ${error}`));
									}
								}
							}
						}
					});
				});
			});
		}).on("error", (err) => {
			console.error("Error fetching calendar data: " + err.message);
		});
	}
	catch (error) {
		console.error("Error processing calendar data: " + error.message);
	}
}


module.exports = {
    refreshtournamentcalendar,
};