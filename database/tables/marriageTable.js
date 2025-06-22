const marriageTable = {
  name: 'Marriage',
  columns: [
    { name: 'user1_id', type: 'VARCHAR NOT NULL' },
    { name: 'user2_id', type: 'VARCHAR NOT NULL' },
    { name: 'married_on', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
  ],
  primaryKey: ['user1_id', 'user2_id'],
  specialConstraints: [
    'PRIMARY KEY (user1_id, user2_id)',
  ],
  constraints: [
    'FOREIGN KEY (user1_id) REFERENCES User(id)',
    'FOREIGN KEY (user2_id) REFERENCES User(id)',
  ],
};

module.exports = marriageTable;
