const Database = require('../../database/Database');

describe('MarriageModel', () => {
  let db;
  let marriageModel;

  beforeAll(async () => {
    // Create test database using current timestamp
    const timestamp = Date.now();
    db = new Database(`./tests/temp/testMarriage-${timestamp}.db`);
    await db.ready;
    marriageModel = db.marriage;
  });

  afterAll(() => {
    // Close database connection and delete test database
    db.db.close();
  });

  beforeEach(async () => {
    // Clear the Marriage table before each test
    await db.executeQuery('DELETE FROM Marriage');
    await db.executeQuery('DELETE FROM User');
  });

  describe('addMarriage and checkMarriageStatus', () => {
    it('should add a marriage and verify status', async () => {
      const user1Id = '123456789';
      const user2Id = '987654321';

      await marriageModel.addMarriage(user1Id, user2Id);
      const status1 = await marriageModel.checkMarriageStatus(user1Id);
      const status2 = await marriageModel.checkMarriageStatus(user2Id);

      expect(status1.isMarried).toBe(true);
      expect(status1.partnerId).toBe(user2Id);
      expect(status2.isMarried).toBe(true);
      expect(status2.partnerId).toBe(user1Id);
    });

    it('should return not married status for single users', async () => {
      const userId = '123456789';
      const status = await marriageModel.checkMarriageStatus(userId);
      expect(status.isMarried).toBe(false);
    });
  });

  describe('removeMarriage', () => {
    it('should successfully remove a marriage', async () => {
      const user1Id = '123456789';
      const user2Id = '987654321';

      await marriageModel.addMarriage(user1Id, user2Id);
      await marriageModel.removeMarriage(user1Id, user2Id);

      const status1 = await marriageModel.checkMarriageStatus(user1Id);
      const status2 = await marriageModel.checkMarriageStatus(user2Id);

      expect(status1.isMarried).toBe(false);
      expect(status2.isMarried).toBe(false);
    });

    it('should handle removing non-existent marriage', async () => {
      const user1Id = '123456789';
      const user2Id = '987654321';

      await marriageModel.removeMarriage(user1Id, user2Id);

      const status1 = await marriageModel.checkMarriageStatus(user1Id);
      const status2 = await marriageModel.checkMarriageStatus(user2Id);

      expect(status1.isMarried).toBe(false);
      expect(status2.isMarried).toBe(false);
    });
  });

  describe('getMarriageDate', () => {
    it('should return marriage date for married couple', async () => {
      const user1Id = '123456789';
      const user2Id = '987654321';

      await marriageModel.addMarriage(user1Id, user2Id);
      const date = await marriageModel.getMarriageDate(user1Id);
      const date2 = await marriageModel.getMarriageDate(user2Id);

      expect(date).toBeDefined();
      expect(new Date(date)).toBeInstanceOf(Date);
      expect(date2).toBeDefined();
      expect(new Date(date2)).toBeInstanceOf(Date);
    });

    it('should return null for non-married couple', async () => {
      const user1Id = '123456789';
      const user2Id = '987654321';

      const date = await marriageModel.getMarriageDate(user1Id);
      const date2 = await marriageModel.getMarriageDate(user2Id);
      expect(date).toBeNull();
      expect(date2).toBeNull();
    });

    it('should return same date regardless of user order', async () => {
      const user1Id = '123456789';
      const user2Id = '987654321';

      await marriageModel.addMarriage(user1Id, user2Id);
      const date1 = await marriageModel.getMarriageDate(user1Id);
      const date2 = await marriageModel.getMarriageDate(user2Id);

      expect(date1).toBe(date2);
    });
  });

  describe('getMarriageBenefits', () => {
    it('should return 1.1 if the user is married', async () => {
      const userId = '123456789';
      await marriageModel.addMarriage(userId, '987654321');
      const benefits = await marriageModel.getMarriageBenefits(userId);
      expect(benefits).toBe(1.1);
    });

    it('should return 1 if the user is single', async () => {
      const userId = '123456789';
      const benefits = await marriageModel.getMarriageBenefits(userId);
      expect(benefits).toBe(1);
    });
  });
});
