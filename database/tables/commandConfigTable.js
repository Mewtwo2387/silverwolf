const commandConfigTable = {
  name: 'CommandConfig',
  columns: [
    { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
    { name: 'command_name', type: 'TEXT NOT NULL' },
    { name: 'server_id', type: 'VARCHAR NOT NULL' },
    { name: 'disabled_date', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    { name: 'reason', type: 'TEXT' },
  ],
  primaryKey: ['id'],
  specialConstraints: [],
  constraints: [
    'UNIQUE (command_name, server_id)',
  ],
};

module.exports = commandConfigTable;
