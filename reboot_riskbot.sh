screen -X -S riskbot kill
wait 1
screen -dmL -S riskbot -Logfile riskbot.log node riskbot.js
