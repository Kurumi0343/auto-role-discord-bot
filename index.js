const keep_alive = require('./keep_alive.js')
const firebaseadmin = require('firebase-admin');

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
const config = require('./config.json');
const commands = require('./commands.js');
const {
  error
} = require('console');
const countdownTimers = {};

firebaseadmin.initializeApp({
  credential: firebaseadmin.credential.cert({
    projectId: process.env.PROJECT_ID,
    clientEmail: process.env.CLIENT_EMAIL,
    privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, '\n')
  }),
  databaseURL: 'https://ucomebooster-18265-default-rtdb.firebaseio.com' // Replace 'your-project-id' with your Firebase project ID
});
const db = firebaseadmin.database();
const ref = db.ref('users');
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

async function updateCountdown(entry) {
  try {
    const userRef = ref.child(entry);
    userRef.once('value')
      .then(async snapshot => {
        const data = snapshot.val();
        const interact = client.guilds.cache.get(config.server_id);
        const currentDate = Math.floor(Date.now() / 1000);
        const remainingTime = data.endDate - currentDate;
        if (remainingTime <= 0) {
          if (data.isNew) {
            const roleToRemove = interact.roles.cache.get(data.roleid);
            if (data) {
              const member = await interact.members.fetch(data.userid);
              member.roles.remove(roleToRemove).then(() => {
                  userRef.remove()
                })
                .catch((error) => console.log(error));
            }
            clearInterval(countdownTimers[data.userid]);
            delete countdownTimers[data.userid];
          }
        }
      })
      .catch(error => {
        console.error('Error retrieving data:', error);
      });
  } catch (error) {
    console.log(error + entry)
  }
}

client.on('ready', async () => {
  ref.once('value')
    .then(snapshot => {
      const childNames = Object.keys(snapshot.val() || {});
      childNames.forEach(childName => {
        countdownTimers[childName] = setInterval(() => {
          updateCountdown(childName);
        }, 1000);
      });
    })
    .catch(error => {

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
          content: `This is bot is online`,
          ephemeral: true
        });
      } catch (error) {
        console.log(error)
      }
    }
    if (commandName === 'validate') {
      await interaction.guild.members.fetch();
      interaction.guild.members.cache.forEach(async member => {
        try {
          const newbieRole = interaction.guild.roles.cache.get(config.role_id);
          const joinTimestamp = Math.floor(member.joinedTimestamp / 1000);
          const sixtyDaysAgo = Math.floor(new Date().getTime() / 1000) - (60 * 24 * 60 * 60);
          const currentTimestamp = Math.floor(Date.now() / 1000);
          const daysInServer = Math.floor(currentTimestamp - joinTimestamp);
          const endDate = Math.floor(currentTimestamp + parseTimeToSeconds(config.role_duration) - daysInServer);
          if (joinTimestamp > sixtyDaysAgo) {
            if (newbieRole) {
              member.roles.add(newbieRole)
                .then(() => {
                  const dataUser = member.id;
                  const data = ref.child(dataUser);
                  data.once('value')
                    .then(snapshot => {
                      const data = snapshot.val();
                      ref.child(dataUser).set({
                          userid: dataUser,
                          isNew: true,
                          joinDate: currentTimestamp,
                          endDate: endDate,
                          roleid: config.role_id,
                        })
                        .then(() => {})
                        .catch(error => {
                          console.error('Error pushing data:', error);
                        });
                      countdownTimers[dataUser] = setInterval(() => {
                        updateCountdown(dataUser);
                      }, 1000);
                    })
                    .catch(error => {
                      console.error('Error retrieving data:', error);
                    });
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
      } catch(error) {
        
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
          const optionsUser = options.getString('user_id');
          fetchUser.roles.add(newbieRole)
            .then(() => {
              interaction.reply({
                content: 'Role added!',
                ephemeral: true
              });
              const data = ref.child(optionsUser);
              data.once('value')
                .then(snapshot => {
                  const data = snapshot.val();
                  ref.child(optionsUser).set({
                      userid: optionsUser,
                      isNew: true,
                      joinDate: currentDate,
                      endDate: endDate,
                      roleid: options.getString('role_id'),
                    })
                    .then(() => {})
                    .catch(error => {
                      console.error('Error pushing data:', error);
                    });
                  countdownTimers[optionsUser] = setInterval(() => {
                    updateCountdown(optionsUser);
                  }, 1000);
                })
                .catch(error => {
                  console.error('Error retrieving data:', error);
                });

            })
            .catch((error) => {
              interaction.reply({
                content: 'Role not added!',
                ephemeral: true
              })
              console.log(error)
            });
        } else {
          console.error(`Role with ID ${optionsUser} not found.`);
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
          const dataUser = member.id;
          const data = ref.child(dataUser);
          data.once('value')
            .then(snapshot => {
              const data = snapshot.val();
              ref.child(dataUser).set({
                  userid: dataUser,
                  isNew: true,
                  joinDate: currentDate,
                  endDate: endDate,
                  roleid: config.role_id,
                })
                .then(() => {})
                .catch(error => {
                  console.error('Error pushing data:', error);
                });
              countdownTimers[dataUser] = setInterval(() => {
                updateCountdown(dataUser);
              }, 1000);
            })
            .catch(error => {
              console.error('Error retrieving data:', error);
            });
        })
        .catch((error) => console.error('Error adding role on join:', error));
    } else {
      console.error(`Role with ID ${newbieRole} not found.`);
    }
  } catch (error) {

  }
});

client.login(process.env.TOKEN);
