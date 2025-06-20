const { CommandGroup } = require('../classes/commandGroup');

class GlobalConfig extends CommandGroup {
  constructor(client) {
    super(client, 'globalconfig', 'Global config commands', ['get', 'set']);
  }
}

module.exports = GlobalConfig;
