// commands.js

module.exports = [{
    name: 'ping',
    description: 'pong',
    options: [],
    default_member_permissions: 1 << 5
  },
  {
    name: 'validate',
    description: 'pong',
    options: [],
    default_member_permissions: 1 << 5
  },
  {
    name: 'setrole',
    description: 'set role',
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
    default_member_permissions: 1 << 5
  },
];