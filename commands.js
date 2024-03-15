// commands.js

module.exports = 
[
    {
      name: 'ping',
      description: 'pong',
      options: [
      ],
    },
    {
      name: 'validate',
      description: 'reset role of all new users for the past 59 days',
      options: [
      ],
    },
    {
      name: 'setrole',
      description: 'set role',
      options: [
        {
          name: 'user_id',
          type: 3,
          description: 'user to set',
          required: true,
        },
        {
          name: 'role_id',
          type: 3,
          description: 'role id to set',
          required: true,
        },
        {
          name: 'duration',
          type: 3,
          description: 'role duration',
          required: true,
        }
      ],
    },
];
  
