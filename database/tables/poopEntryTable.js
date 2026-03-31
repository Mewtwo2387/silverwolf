const poopEntryTable = {
  name: 'PoopEntry',
  columns: [
    { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
    { name: 'user_id', type: 'VARCHAR NOT NULL' },
    { name: 'logged_at', type: 'INTEGER NOT NULL' },
    { name: 'colour', type: 'TEXT' },
    { name: 'size', type: 'TEXT' },
    { name: 'type', type: 'TEXT' },
    { name: 'duration', type: 'INTEGER' },
  ],
  primaryKey: ['id'],
  specialConstraints: [],
  constraints: ['FOREIGN KEY (user_id) REFERENCES User(id)'],
};

module.exports = poopEntryTable;
