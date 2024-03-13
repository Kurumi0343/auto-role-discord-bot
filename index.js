const keep_alive = require('./keep_alive.js')
const {
  Client,
  IntentsBitField,
  Partials,
  InteractionType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder
} = require('discord.js');
const {
  REST
} = require('@discordjs/rest');
const {
  Routes
} = require('discord-api-types/v9');
const fs = require('fs');
const config = require('./config.json');
const commands = require('./commands.js');
const {
  error
} = require('console');
const storage = 'storage/data.json';
const jsonData = JSON.parse(fs.readFileSync('storage/data.json'));
const countdownTimers = {};



const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

function parseTimeToSeconds(timeString) {
  const regex = /^(\d+)([smhd])$/;
  const match = timeString.match(regex);

  if (!match) {
    return '-10';
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 24 * 60 * 60;
    case 'k':
      return value * 30 * 24 * 60 * 60;
    default:
      return '-20';
  }
}

async function updateCountdown(entry) {
  try {
    const interact = client.guilds.cache.get(config.server_id);
    const currentDate = Math.floor(Date.now() / 1000);
    const remainingTime = entry.endDate - currentDate;
    if (remainingTime <= 0) {
      if (entry.isNew) {
        const roleToRemove = interact.roles.cache.get(entry.roleid);
        if (entry) {
          const member = await interact.members.fetch(entry.userid);
          member.roles.remove(roleToRemove).then(() => {
              const indexToRemove = jsonData.findIndex(item => item.userid === entry.userid);
              if (indexToRemove !== -1) {
                jsonData.splice(indexToRemove, 1);
              }
              fs.writeFileSync(storage, JSON.stringify(jsonData, null, 2));
            })
            .catch((error) => console.log(error));
        }
        clearInterval(countdownTimers[entry.userid]);
        delete countdownTimers[entry.userid];
      }
    }

  } catch (error) {
    console.log(error)
  }
}

client.on('ready', async () => {
  jsonData.forEach((entry) => {
    countdownTimers[entry.userid] = setInterval(() => {
      updateCountdown(entry);
    }, 1000);
  });
  const commandsArray = commands.map((command) => ({
    ...command,
    type: 1,
  }));
  const rest = new REST({
    version: '9'
  }).setToken(process.env.TOKEN);
  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, config.server_id), {
        body: commandsArray
      },
    );
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
});

client.on('interactionCreate', async (interaction) => {

  if (interaction.isCommand()) {
    const {
      commandName,
      options,
      user
    } = interaction;
    if (commandName === 'ping') {
      try {
              
      await interaction.reply({
        content: `This is bot is online total entries ${storage.length()}`,
        ephemeral: true
      });
      } catch (error) {
        
      }
    }
    if (commandName === 'setrole') {
      try {
        const newbieRole = interaction.guild.roles.cache.get(options.getString('role_id'));
        const fetchUser = await interaction.guild.members.fetch(options.getString('user_id'));
        const currentDate = Math.floor(Date.now() / 1000);
        if (parseTimeToSeconds(options.getString('duration')) <= 0) {
          await interaction.reply({
            content: `${(parseTimeToSeconds(options.getString('duration')) === '-10') ? 'Sytanx Error, correct format: 1s, 1m, 1h, 1d, 1k' : 'Not supported time date'}`,
            ephemeral: true
          });
          return
        }
        const endDate = currentDate + parseTimeToSeconds(options.getString('duration'));
        if (newbieRole) {
          fetchUser.roles.add(newbieRole)
            .then(() => {
              interaction.reply({
                content: 'Role added!',
                ephemeral: true
              });
              let entry = jsonData.find(entry => entry.userid === options.getString('user_id'));
              if (!entry) {
                jsonData.push({
                  userid: options.getString('user_id'),
                  isNew: true,
                  joinDate: currentDate,
                  endDate: endDate,
                  roleid: config.role_id,
                });
                fs.writeFileSync(storage, JSON.stringify(jsonData, null, 2));
              } else {
                entry.isNew = true;
                entry.joinDate = currentDate;
                entry.endDate = endDate;
                fs.writeFileSync(storage, JSON.stringify(jsonData, null, 2));
              }
              entry = jsonData.find(entry => entry.userid === options.getString('user_id'));
              countdownTimers[entry.userid] = setInterval(() => {
                updateCountdown(entry);
              }, 1000);
            })
            .catch((error) => {
              interaction.reply({
                content: 'Role not added!',
                ephemeral: true
              })
              console.log(error)
            });
        } else {
          console.error(`Role with ID ${options.getString('role_id')} not found.`);
        }
      } catch (error) {
        interaction.reply({
          content: error,
          ephemeral: true
        })
      }
    }
  }

});

client.on('guildMemberAdd', async (member) => {
  try {
    const newbieRole = member.guild.roles.cache.get(config.role_id);
    const currentDate = Math.floor(Date.now() / 1000);
    const endDate = currentDate + parseTimeToSeconds(config.role_duration);
    if (newbieRole) {
      member.roles.add(newbieRole)
        .then(() => {
          let entry = jsonData.find(entry => entry.userid === member.user.id);
          if (!entry) {
            jsonData.push({
              userid: member.id,
              isNew: true,
              joinDate: currentDate,
              endDate: endDate,
              roleid: config.role_id,
            });
            fs.writeFileSync(storage, JSON.stringify(jsonData, null, 2));
          } else {
            entry.joinDate = currentDate;
            entry.endDate = endDate;
            fs.writeFileSync(storage, JSON.stringify(jsonData, null, 2));
          }
          entry = jsonData.find(entry => entry.userid === member.user.id);
          countdownTimers[member.id] = setInterval(() => {
            updateCountdown(entry);
          }, 1000);
        })
        .catch((error) => console.error('Error adding role on join:', error));
    } else {
      console.error(`Role with ID ${newbieRole} not found.`);
    }
  } catch (error) {

  }
});

client.login(process.env.TOKEN);
