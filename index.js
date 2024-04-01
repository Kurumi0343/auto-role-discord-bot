const keep_alive = require('./keep_alive.js')
const mongoose = require('mongoose');

const TOKEN = ""
const CLIENT_ID = ""
const mongoURL = ""
const ROLE_ID = "1224237860564238346"
const ROLE_DURATION = "2k"

const {
  Client,
  IntentsBitField,
  Partials,
  InteractionType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  PermissionsBitField
} = require('discord.js');
const {
  REST
} = require('@discordjs/rest');
const {
  Routes
} = require('discord-api-types/v9');
const commands = require('./commands.js');

const autoRoleSchema = new mongoose.Schema({
  serverId: String,
  endDate: String,
  joinDate: String,
  roleId: String,
  userId: String
});

const autoRole = mongoose.model('autoRole', autoRoleSchema)

const countdownTimers = {};

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

function parseTimeToSeconds(timeString) {
  const regex = /^(\d+)([smhdk])$/;
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

async function updateCountdown(userData) {
  try {
    const interact = client.guilds.cache.get(userData.serverId);
    const currentDate = Math.floor(Date.now() / 1000);
    const remainingTime = userData.endDate - currentDate;
    if (remainingTime <= 0) {
      const roleToRemove = interact.roles.cache.get(userData.roleId);
      const fetchedMember = await interact.members.fetch(userData.userId);
      fetchedMember.roles.remove(roleToRemove).then(() => {
          autoRole.findOneAndDelete({
            userId: userData.userId
          }).then(itemDelete => {
            clearInterval(countdownTimers[itemDelete.userId]);
            delete countdownTimers[itemDelete.userId];
          }).catch(_ => null)
        })
        .catch((error) => console.log(error));
    }
  } catch (error) {
    console.log(error, userData)
  }
}

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

client.on('ready', async () => {
  await mongoose.connect(process.env.mongoURL || mongoURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  autoRole.find({}, 'userId')
    .then(rolesData => {
      if (rolesData.length > 0) {
        rolesData.forEach(data => {
          countdownTimers[data.userId] = setInterval(() => {
            updateCountdown(data);
          }, 1000);
        })
      }
    })

  const commandsArray = commands.map((command) => ({
    ...command,
    type: 1,
  }));

  const rest = new REST({
    version: '9'
  }).setToken(process.env.TOKEN || TOKEN);
  try {
    console.log('Started refreshing application (/) commands.');
    client.guilds.cache.forEach(async guild => {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID || CLIENT_ID, guild.id), {
          body: commandsArray
        },
      );
    });
    await Promise.all(client.guilds.cache.map(guild => guild.members.fetch()));
    await Promise.all(client.guilds.cache.map(guild => guild.channels.fetch()));
    await Promise.all(client.guilds.cache.map(guild => guild.roles.fetch()));
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({
      content: "Only Staff can use this command",
      ephemeral: true
    })
    return
  }
  if (interaction.isCommand()) {
    const {
      commandName,
      options,
      user
    } = interaction;
    if (commandName === 'ping') {
      try {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.reply({
            content: `This is bot is online`,
            ephemeral: true
          });
        }
      } catch (error) {
        console.log(error)
      }
    }
    if (commandName === 'validate') {
      if (options.getString('duration') && parseTimeToSeconds(options.getString('duration')) <= 0) {
        await interaction.reply({
          content: `${(parseTimeToSeconds(options.getString('duration')) === '-10') ? 'Sytanx Error, correct format: 1s, 1m, 1h, 1d, 1k' : 'Not supported time date'}`,
          ephemeral: true
        });
        return
      }
      interaction.guild.members.cache.forEach(async member => {
        try {
          const newbieRole = interaction.guild.roles.cache.get(ROLE_ID);
          const joinTimestamp = Math.floor(member.joinedTimestamp / 1000);
          const sixtyDaysAgo = Math.floor(new Date().getTime() / 1000) - (60 * 24 * 60 * 60);
          const currentTimestamp = Math.floor(Date.now() / 1000);
          const daysInServer = Math.floor(currentTimestamp - joinTimestamp);
          const endDate = Math.floor(currentTimestamp + parseTimeToSeconds(ROLE_DURATION) - daysInServer);
          if (joinTimestamp > sixtyDaysAgo) {
            if (newbieRole) {
              await member.roles.add(newbieRole)
                .then(() => {
                  autoRole.findOne({
                    userId: member.id
                  }).then(async userData => {
                    if (!userData) {
                      const autoRoleData = new autoRole({
                        serverId: interaction.guild.id,
                        endDate: Math.floor(currentTimestamp + parseTimeToSeconds(options.getString('duration'))) || endDate,
                        joinDate: currentTimestamp,
                        roleId: ROLE_ID,
                        userId: member.id
                      })
                      autoRoleData.save().then(_ => {
                        countdownTimers[autoRoleData.userId] = setInterval(() => {
                          updateCountdown(autoRoleData);
                        }, 1000);
                      })
                    } else {
                      userData.endDate = endDate;
                      await userData.save()
                    }
                  })
                })
                .catch((error) => console.error('Error adding role on join:', error));
            }
          }
        } catch (error) {
          console.log(error)
        }
      });

      try {
        await interaction.reply({
          content: 'Validated!',
          ephemeral: true
        });
      } catch {

      }
    }
    if (commandName === 'setrole') {
      try {
        const newbieRole = interaction.guild.roles.cache.get(ROLE_ID);
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
          await fetchUser.roles.add(newbieRole)
            .then(async () => {
              if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({
                  content: 'Role added!',
                  ephemeral: true
                });
              }

              autoRole.findOne({
                userId: fetchUser.id
              }).then(userData => {
                if (!userData) {
                  const autoRoleData = new autoRole({
                    serverId: interaction.guild.id,
                    endDate: endDate,
                    joinDate: currentDate,
                    roleId: ROLE_ID,
                    userId: fetchUser.id
                  })
                  autoRoleData.save().then(_ => {
                    countdownTimers[autoRoleData.userId] = setInterval(() => {
                      updateCountdown(autoRoleData);
                    }, 1000);
                  })
                } else {
                  userData.roleId = ROLE_ID;
                  userData.endDate = endDate;
                  userData.save().then(_ => {
                    clearInterval(countdownTimers[userData.userId]);
                    delete countdownTimers[userData.userId];

                    countdownTimers[userData.userId] = setInterval(() => {
                      updateCountdown(userData);
                    }, 1000);
                  })
                }
              })
            })
            .catch((error) => {
              console.log(error)
            });
        } else {
          console.error(`Role with ID ${optionsUser} not found.`);
        }
      } catch (error) {
        console.log(error)
      }
    }
  }

});

client.on('guildMemberAdd', async (member) => {
  try {
    const newbieRole = member.guild.roles.cache.get(ROLE_ID);
    const currentDate = Math.floor(Date.now() / 1000);
    const endDate = currentDate + parseTimeToSeconds(ROLE_DURATION);
    if (newbieRole) {
      await member.roles.add(newbieRole)
        .then(() => {
          autoRole.findOne({
            userId: member.id
          }).then(userData => {
            if (!userData) {
              const autoRoleData = new autoRole({
                serverId: member.guild.id,
                endDate: endDate,
                joinDate: currentDate,
                roleId: ROLE_ID,
                userId: member.id
              })
              autoRoleData.save().then(_ => {
                countdownTimers[autoRoleData.userId] = setInterval(() => {
                  updateCountdown(autoRoleData);
                }, 1000);
              })
            }
          })
        })
        .catch((error) => console.error('Error adding role on join:', error));
    } else {
      console.error(`Role with ID ${newbieRole} not found.`);
    }
  } catch (error) {

  }
});

client.login(process.env.TOKEN || TOKEN);
