const globalConfigTable = {
  name: 'GlobalConfig',
  columns: [
    { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
    { name: 'key', type: 'TEXT NOT NULL' },
    { name: 'value', type: 'TEXT NOT NULL' },
  ],
  primaryKey: ['id'],
  specialConstraints: [],
  constraints: [
    'UNIQUE (key)',
  ],
};

module.exports = globalConfigTable;
