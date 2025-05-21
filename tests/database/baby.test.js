const Database = require('../../database/Database');

describe('BabyModel', () => {
  let db;
  let babyModel;

  beforeAll(async () => {
    // Create test database using current timestamp
    const timestamp = Date.now();
    db = new Database(`./testBaby-${timestamp}.db`);
    await db.ready;
    babyModel = db.baby;
  });

  afterAll(() => {
    // Close database connection and delete test database
    db.db.close();
  });

  beforeEach(async () => {
    // Clear the User table before each test
    await db.executeQuery('DELETE FROM User');
    await db.executeQuery('DELETE FROM Baby');
    await db.executeQuery('DELETE FROM sqlite_sequence WHERE name="Baby"');
  });

  describe('createBaby and getBabyById', () => {
    it('should create a baby even if mother and father does not have a user yet', async () => {
      const motherId = '123456789';
      const fatherId = '987654321';
      await babyModel.createBaby(motherId, fatherId);
      const baby = await babyModel.getBabyById(1);
      expect(baby).toBeDefined();
      expect(baby.motherId).toBe(motherId);
      expect(baby.fatherId).toBe(fatherId);
    });

    it('can create multiple babies', async () => {
      const motherId = '123456789';
      const fatherId = '987654321';
      await babyModel.createBaby(motherId, fatherId);
      await babyModel.createBaby(motherId, fatherId);
      const baby1 = await babyModel.getBabyById(1);
      const baby2 = await babyModel.getBabyById(2);
      expect(baby1).toBeDefined();
      expect(baby2).toBeDefined();
      expect(baby1.motherId).toBe(motherId);
      expect(baby1.fatherId).toBe(fatherId);
      expect(baby2.motherId).toBe(motherId);
      expect(baby2.fatherId).toBe(fatherId);
    });
  });

  describe('getBabiesByParentId', () => {
    it('should return all babies for a given parent ID', async () => {
      const motherId = '123456789';
      const fatherId = '987654321';
      const fatherId2 = '111111111';
      await babyModel.createBaby(motherId, fatherId);
      await babyModel.createBaby(motherId, fatherId2);
      const motherBabies = await babyModel.getBabiesByParentId(motherId);
      const fatherBabies = await babyModel.getBabiesByParentId(fatherId);
      expect(motherBabies).toHaveLength(2);
      expect(fatherBabies).toHaveLength(1);
      expect(motherBabies[0].motherId).toBe(motherId);
      expect(fatherBabies[0].fatherId).toBe(fatherId);
    });

    it('should return babies where mother and father ID are flipped', async () => {
      const motherId = '123456789';
      const fatherId = '987654321';
      await babyModel.createBaby(motherId, fatherId);
      await babyModel.createBaby(fatherId, motherId);
      const babies = await babyModel.getBabiesByParentId(motherId);
      const babies2 = await babyModel.getBabiesByParentId(fatherId);
      expect(babies).toHaveLength(2);
      expect(babies2).toHaveLength(2);
    });
  });

  describe('getAllBabies', () => {
    it('should return all babies in the database', async () => {
      await babyModel.createBaby('123', '456');
      await babyModel.createBaby('789', '012');
      const allBabies = await babyModel.getAllBabies();
      expect(allBabies).toHaveLength(2);
    });

    it('should return no babies if the database is empty', async () => {
      const allBabies = await babyModel.getAllBabies();
      expect(allBabies).toHaveLength(0);
    });
  });

  describe('updateBabyAttr and addBabyAttr', () => {
    it('should update baby attributes correctly', async () => {
      await babyModel.createBaby('123', '456');
      await babyModel.updateBabyAttr(1, 'name', 'TestBaby');
      const baby = await babyModel.getBabyById(1);
      expect(baby.name).toBe('TestBaby');
    });

    it('should add to baby attributes correctly', async () => {
      await babyModel.createBaby('123', '456');
      await babyModel.updateBabyAttr(1, 'level', 10);
      await babyModel.addBabyAttr(1, 'level', 1);
      const baby = await babyModel.getBabyById(1);
      expect(baby.level).toBe(11);
    });
  });

  describe('deleteBaby', () => {
    it('should delete a baby by ID', async () => {
      await babyModel.createBaby('123', '456');
      await babyModel.deleteBaby(1);
      const baby = await babyModel.getBabyById(1);
      expect(baby).toBeNull();
    });
  });

  describe('updateBabyStatus', () => {
    it('should update baby status correctly', async () => {
      await babyModel.createBaby('123', '456');
      await babyModel.updateBabyStatus(1, 'born');
      const baby = await babyModel.getBabyById(1);
      expect(baby.status).toBe('born');
    });
  });

  describe('updateBabyName', () => {
    it('should update baby name correctly', async () => {
      await babyModel.createBaby('123', '456');
      await babyModel.updateBabyName(1, 'TestBaby');
      const baby = await babyModel.getBabyById(1);
      expect(baby.name).toBe('TestBaby');
    });
  });

  describe('updateBabyBirthday', () => {
    it('should update baby birthday correctly', async () => {
      await babyModel.createBaby('123', '456');
      await babyModel.updateBabyBirthday(1);
      const baby = await babyModel.getBabyById(1);
      expect(baby.born).toBeDefined();
    });
  });

  describe('babyIsUnborn', () => {
    it('should correctly identify unborn babies', async () => {
      await babyModel.createBaby('123', '456');
      const isUnborn = await babyModel.babyIsUnborn(1);
      expect(isUnborn).toBe(true);
    });

    it('should correctly identify born babies', async () => {
      await babyModel.createBaby('123', '456');
      await babyModel.updateBabyStatus(1, 'born');
      const isUnborn = await babyModel.babyIsUnborn(1);
      expect(isUnborn).toBe(false);
    });
  });

  describe('bornBaby', () => {
    it('should successfully birth an unborn baby', async () => {
      await babyModel.createBaby('123', '456');
      const result = await babyModel.bornBaby(1);
      expect(result).toBe(true);
      const baby = await babyModel.getBabyById(1);
      expect(baby.status).toBe('born');
      expect(baby.born).toBeDefined();
    });

    it('should fail to birth an already born baby', async () => {
      await babyModel.createBaby('123', '456');
      await babyModel.updateBabyStatus(1, 'born');
      const result = await babyModel.bornBaby(1);
      expect(result).toBe(false);
    });
  });

  describe('updateBabyJob', () => {
    it('should update baby job and pinger info correctly', async () => {
      await babyModel.createBaby('123', '456');
      await babyModel.updateBabyJob(1, 'pinger', 'target123', 'channel456');
      const baby = await babyModel.getBabyById(1);
      expect(baby.job).toBe('pinger');
      expect(baby.pingerTarget).toBe('target123');
      expect(baby.pingerChannel).toBe('channel456');
    });

    it('should update baby job without pinger info', async () => {
      await babyModel.createBaby('123', '456');
      await babyModel.updateBabyJob(1, 'gambler');
      const baby = await babyModel.getBabyById(1);
      expect(baby.job).toBe('gambler');
      expect(baby.pingerTarget).toBeNull();
      expect(baby.pingerChannel).toBeNull();
    });
  });

  describe('levelUpBaby', () => {
    it('should increment baby level by 1', async () => {
      await babyModel.createBaby('123', '456');
      await babyModel.levelUpBaby(1);
      const baby = await babyModel.getBabyById(1);
      expect(baby.level).toBe(1);
    });
  });

  describe('incrementNuggieClaimerStats', () => {
    it('should increment nuggie claimer stats correctly', async () => {
      await babyModel.createBaby('123', '456');
      await babyModel.incrementNuggieClaimerStats(1, 5);
      const baby = await babyModel.getBabyById(1);
      expect(baby.nuggieClaimerClaims).toBe(1);
      expect(baby.nuggieClaimerClaimed).toBe(5);
      await babyModel.incrementNuggieClaimerStats(1, 5);
      const baby2 = await babyModel.getBabyById(1);
      expect(baby2.nuggieClaimerClaims).toBe(2);
      expect(baby2.nuggieClaimerClaimed).toBe(10);
    });
  });

  describe('incrementGamblerStats', () => {
    it('should increment gambler stats correctly', async () => {
      await babyModel.createBaby('123', '456');
      await babyModel.incrementGamblerStats(1, 1, 1, 0, 100, 200);
      const baby = await babyModel.getBabyById(1);
      expect(baby.gamblerGames).toBe(1);
      expect(baby.gamblerWins).toBe(1);
      expect(baby.gamblerLosses).toBe(0);
      expect(baby.gamblerCreditsGambled).toBe(100);
      expect(baby.gamblerCreditsWon).toBe(200);
      await babyModel.incrementGamblerStats(1, 1, 1, 0, 100, 200);
      const baby2 = await babyModel.getBabyById(1);
      expect(baby2.gamblerGames).toBe(2);
      expect(baby2.gamblerWins).toBe(2);
      expect(baby2.gamblerLosses).toBe(0);
      expect(baby2.gamblerCreditsGambled).toBe(200);
      expect(baby2.gamblerCreditsWon).toBe(400);
    });
  });

  describe('incrementPingerPings', () => {
    it('should increment pinger pings correctly', async () => {
      await babyModel.createBaby('123', '456');
      await babyModel.incrementPingerPings(1);
      const baby = await babyModel.getBabyById(1);
      expect(baby.pingerPings).toBe(1);
      await babyModel.incrementPingerPings(1);
      const baby2 = await babyModel.getBabyById(1);
      expect(baby2.pingerPings).toBe(2);
    });
  });
});
