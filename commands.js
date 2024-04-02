// commands.js

module.exports = [{
    name: 'ping',
    description: 'pong',
    options: [],
  },
  {
    name: 'setrole',
    description: 'set role',
    default_member_permissions: "0",
    options: [{
        name: 'user_id',
        type: 3,
        description: 'user to set',
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
