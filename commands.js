// commands.js

module.exports = [
  {
    name: 'gstart',
    description: 'Start Giveaway',
    options: [
      {
        name: 'duration',
        type: 3, // String
        description: 'Giveaway duration',
        required: true,
      },
      {
        name: 'winners',
        type: 4, // INTEGER
        description: 'Winners Count',
        required: true,
      },
      {
        name: 'prize',
        type: 3, // String
        description: 'Giveaway Prize',
        required: true,
      }
    ],
  },
  {
    name: 'greroll',
    description: 'rerolls new winner from a giveaway',
    options: [
      {
        name: 'giveaway_id',
        type: 3, // String
        description: 'Giveaway ID',
        required: true,
      },
      {
        name: 'count',
        type: 4, //Integer
        description: 'numbers of winners count',
        required: false,
      }
    ],
  }
];
