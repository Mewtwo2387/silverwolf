const Database = require('./Database');
const models = require('./models');

class DatabaseManager {
  constructor() {
    this.db = new Database();
    this.models = {};
    
    // Initialize all models
    for (const [modelName, ModelClass] of Object.entries(models)) {
      this.models[modelName] = new ModelClass(this.db);
    }
  }

  // Getter methods for each model
  get userModel() { return this.models.UserModel; }
  get pokemonModel() { return this.models.PokemonModel; }
  get marriageModel() { return this.models.MarriageModel; }
  get serverRolesModel() { return this.models.ServerRolesModel; }
  get gameUIDModel() { return this.models.GameUIDModel; }
  get commandConfigModel() { return this.models.CommandConfigModel; }
  get globalConfigModel() { return this.models.GlobalConfigModel; }
  get babyModel() { return this.models.BabyModel; }
  get chatSessionModel() { return this.models.ChatSessionModel; }
  get chatHistoryModel() { return this.models.ChatHistoryModel; }
}

module.exports = DatabaseManager; 