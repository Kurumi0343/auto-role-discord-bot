const keep_alive = require('./keep_alive.js')
const mongoose = require('mongoose');

const TOKEN = ""
const CLIENT_ID = ""
const mongoURL = ""
const ROLE_ID = "1224237860564238346"
const ROLE_DURATION = "2k"
const MEMBER_ROLE = "952717623597084692"

const {
  Client,
  IntentsBitField,
  Partials,
  Events,
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

async function updateCountdown(data) {
  try {
    autoRole.findOne({
      userId: data
    }).then(async userData => {
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
            }).catch(_ => null)
          })
          .catch((error) => console.log(error));
      }
    })
  } catch (error) {
    console.log(error, data)
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
  countdownTimers['GUILD'] = setInterval(async () => {
    await autoRole.find({}, 'userId')
    .then(rolesData => {
      if (rolesData.length > 0) {
        rolesData.forEach(data => {
          updateCountdown(data.userId);
        })
      }
    })
  }, 60000 * 10);


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

client.on(Events.GuildMemberUpdate, async (member, memberNew) => {
  const fetchedMember = await memberNew.guild.members.fetch(memberNew.id);
  try {
    if (!fetchedMember.roles.cache.has(MEMBER_ROLE)) return;
    if (fetchedMember.roles.cache.has(ROLE_ID)) return;
    const newbieRole = memberNew.guild.roles.cache.get(ROLE_ID);
    const currentDate = Math.floor(Date.now() / 1000);
    const endDate = currentDate + parseTimeToSeconds(ROLE_DURATION);
    if (newbieRole) {
      autoRole.findOne({
        userId: memberNew.id
      }).then(async userData => {
        const fetchUser = await memberNew.guild.members.fetch(memberNew.user.id);
        if (!userData) {
          if (fetchedMember.roles.cache.has(MEMBER_ROLE)) {
            await fetchUser.roles.add(newbieRole)
              .then(() => {
                const autoRoleData = new autoRole({
                  serverId: memberNew.guild.id,
                  endDate: endDate,
                  joinDate: currentDate,
                  roleId: ROLE_ID,
                  userId: memberNew.id
                })
                autoRoleData.save().then(_ => {
                })
              }).catch(error => console.log(error))
          }
        } else {
          await fetchUser.roles.add(newbieRole)
          userData.endDate = endDate;
          userData.joinDate = currentDate;
          userData.save()
        }
      })
    } else {
      console.error(`Role with ID ${newbieRole} not found.`);
    }
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
            content: `This bot is online`,
            ephemeral: true
          });
        }
      } catch (error) {
        console.log(error)
      }
    }

    if (commandName === 'validate') {
      return
      const sortedMembers = interaction.guild.members.cache.sort((a, b) => a.joinedAt - b.joinedAt);
      const newbieRole = interaction.guild.roles.cache.get(ROLE_ID);
      const memberRole = interaction.guild.roles.cache.get(MEMBER_ROLE);
      sortedMembers.forEach(async member => {
        try {
          const joinTimestamp = Math.floor(member.joinedTimestamp / 1000);
          const sixtyDaysAgo = Math.floor(new Date().getTime() / 1000) - (65 * 24 * 60 * 60);
          const currentTimestamp = Math.floor(Date.now() / 1000);
          const daysInServer = Math.floor(currentTimestamp - joinTimestamp);
          const endDate = Math.floor(currentTimestamp + parseTimeToSeconds(ROLE_DURATION) - daysInServer);
          if (joinTimestamp > sixtyDaysAgo) {
          } else {
            if (member.roles.cache.has(memberRole.id) && member.roles.cache.has(newbieRole.id)) {
              console.log(member.user.username, member.id)
              await member.roles.remove(newbieRole).catch(error => console.log(error))
              autoRole.findOneAndDelete({
                userId: member.id
              }).then(async ()=> {
                console.log(member.user.username, member.id)
              })
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
                  })
                } else {
                  userData.roleId = ROLE_ID;
                  userData.endDate = endDate;
                  userData.save().then(_ => {
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
    const memberRole = member.guild.roles.cache.get(MEMBER_ROLE);
    const currentDate = Math.floor(Date.now() / 1000);
    const endDate = currentDate + parseTimeToSeconds(ROLE_DURATION);
    const fetchedMember = await member.guild.members.fetch(member.id);
    if (newbieRole) {
      autoRole.findOne({
        userId: member.id
      }).then(async userData => {
        if (!fetchedMember.roles.cache.has(memberRole.id)) return;
        if (!userData) {
          const autoRoleData = new autoRole({
            serverId: member.guild.id,
            endDate: endDate,
            joinDate: currentDate,
            roleId: ROLE_ID,
            userId: member.id
          })
          autoRoleData.save().then(_ => {
          })
        } else {
          userData.endDate = endDate;
          userData.joinDate = currentDate;
          userData.save()
        }
        await fetchedMember.roles.add(newbieRole)
      })
    } else {
      console.error(`Role with ID ${newbieRole} not found.`);
    }
  } catch (error) {

  }
});


client.login(process.env.TOKEN || TOKEN);
