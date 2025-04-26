const CoreDatabase = require('./service/core');
const { initializeTables } = require('./service/initTable');

// Import services
const UserService = require('./service/userService');
// (You can import other services like BabyService, MarriageService later too)

class Database {
    constructor() {
        this.initPromise = this.init(); // Start async init inside constructor
    }

    async init() {
        this.coreDb = new CoreDatabase();             // Create CoreDatabase instance
        await initializeTables(this.coreDb);           // Initialize all tables

        // Attach services, passing coreDb
        this.userService = new UserService(this.coreDb);

        // Example:
        // this.babyService = new BabyService(this.coreDb);
        // this.marriageService = new MarriageService(this.coreDb);
    }

    // Optional: helper to make sure services are initialized
    async ready() {
        return this.initPromise;
    }
}

module.exports = { Database };
