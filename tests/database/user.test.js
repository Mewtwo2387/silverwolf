const fs = require('fs');
const Database = require('../../database/Database');

describe('UserModel', () => {
  let db;
  let userModel;
  const testDbPath = './test.db';

  beforeAll(() => {
    // Create test database
    db = new Database(testDbPath);
    db.init();
    userModel = db.user;
  });

  afterAll(() => {
    // Close database connection and delete test database
    db.db.close();
    fs.unlinkSync(testDbPath);
  });

  beforeEach(async () => {
    // Clear the User table before each test
    await db.executeQuery('DELETE FROM User');
  });

  describe('getUser', () => {
    it('should create a new user if user does not exist', async () => {
      const userId = '123456789';
      const user = await userModel.getUser(userId);
      expect(user).toBeDefined();
      expect(user.id).toBe(userId);
    });

    it('should return existing user if user exists', async () => {
      const userId = '123456789';
      await userModel.createUser(userId);
      const user = await userModel.getUser(userId);
      expect(user).toBeDefined();
      expect(user.id).toBe(userId);
    });

    it('should calculate net winnings', async () => {
      const userId = '123456789';
      await userModel.createUser(userId);
      await userModel.setUserAttr(userId, 'slotsRelativeWon', 10);
      await userModel.setUserAttr(userId, 'slotsAmountWon', 100);
      await userModel.setUserAttr(userId, 'slotsTimesPlayed', 5);
      await userModel.setUserAttr(userId, 'slotsAmountGambled', 50);
      const user = await userModel.getUser(userId);
      expect(user.slotsRelativeNetWinnings).toBe(5);
      expect(user.slotsNetWinnings).toBe(50);
    });
  });

  describe('addUserAttr', () => {
    it('should add value to user attribute', async () => {
      const userId = '123456789';
      await userModel.createUser(userId);
      await userModel.addUserAttr(userId, 'dinonuggies', 100);
      const user = await userModel.getUser(userId);
      expect(user.dinonuggies).toBe(100);
    });

    it('should increment existing attribute value', async () => {
      const userId = '123456789';
      await userModel.createUser(userId);
      await userModel.addUserAttr(userId, 'dinonuggies', 100);
      await userModel.addUserAttr(userId, 'dinonuggies', 50);
      const user = await userModel.getUser(userId);
      expect(user.dinonuggies).toBe(150);
    });

    it('should create a new user if user does not exist', async () => {
      const userId = '123456789';
      await userModel.addUserAttr(userId, 'dinonuggies', 100);
      const user = await userModel.getUser(userId);
      expect(user.dinonuggies).toBe(100);
    });

    it('should not update attribute if value is null', async () => {
      const userId = '123456789';
      await userModel.createUser(userId);
      await userModel.addUserAttr(userId, 'dinonuggies', null);
      const user = await userModel.getUser(userId);
      expect(user.dinonuggies).toBe(0);
    });
  });

  describe('setUserAttr', () => {
    it('should set user attribute to specified value', async () => {
      const userId = '123456789';
      await userModel.createUser(userId);
      await userModel.setUserAttr(userId, 'dinonuggies', 200);
      const user = await userModel.getUser(userId);
      expect(user.dinonuggies).toBe(200);
    });

    it('should overwrite existing attribute value', async () => {
      const userId = '123456789';
      await userModel.createUser(userId);
      await userModel.setUserAttr(userId, 'dinonuggies', 100);
      await userModel.setUserAttr(userId, 'dinonuggies', 200);
      const user = await userModel.getUser(userId);
      expect(user.dinonuggies).toBe(200);
    });

    it('should create a new user if user does not exist', async () => {
      const userId = '123456789';
      await userModel.setUserAttr(userId, 'dinonuggies', 200);
      const user = await userModel.getUser(userId);
      expect(user.dinonuggies).toBe(200);
    });

    it('should not update attribute if value is null', async () => {
      const userId = '123456789';
      await userModel.createUser(userId);
      await userModel.setUserAttr(userId, 'dinonuggies', 100);
      await userModel.setUserAttr(userId, 'dinonuggies', null);
      const user = await userModel.getUser(userId);
      expect(user.dinonuggies).toBe(100);
    });

    it('should still update dinonuggies_last_claimed if value is null', async () => {
      const userId = '123456789';
      await userModel.createUser(userId);
      await userModel.setUserAttr(userId, 'dinonuggiesLastClaimed', '2024-01-01T12:00:00.000Z');
      await userModel.setUserAttr(userId, 'dinonuggiesLastClaimed', null);
      const user = await userModel.getUser(userId);
      expect(user.dinonuggiesLastClaimed).toBe(null);
    });
  });

  describe('getEveryoneAttr and getEveryoneAttrCount', () => {
    it('should return sorted list of users by attribute', async () => {
      const users = [
        { id: '1', dinonuggies: 300 },
        { id: '2', dinonuggies: 100 },
        { id: '3', dinonuggies: 200 },
      ];

      await Promise.all(users.map(async (user) => {
        await userModel.createUser(user.id);
        await userModel.setUserAttr(user.id, 'dinonuggies', user.dinonuggies);
      }));

      const result = await userModel.getEveryoneAttr('dinonuggies');
      const count = await userModel.getEveryoneAttrCount('dinonuggies');
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('3');
      expect(result[2].id).toBe('2');
      expect(count).toBe(3);
    });

    it('should skip users with 0', async () => {
      const users = [
        { id: '1', dinonuggies: 300 },
        { id: '2', dinonuggies: 0 },
        { id: '3', dinonuggies: 200 },
      ];

      await Promise.all(users.map(async (user) => {
        await userModel.createUser(user.id);
        await userModel.setUserAttr(user.id, 'dinonuggies', user.dinonuggies);
      }));

      const result = await userModel.getEveryoneAttr('dinonuggies');
      const count = await userModel.getEveryoneAttrCount('dinonuggies');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('3');
      expect(count).toBe(2);
    });

    it('should not have a limit if not specified', async () => {
      await Promise.all(Array.from({ length: 100 }, async (_, i) => {
        await userModel.createUser(i.toString());
        await userModel.setUserAttr(i.toString(), 'dinonuggies', i);
      }));

      const result = await userModel.getEveryoneAttr('dinonuggies');
      const count = await userModel.getEveryoneAttrCount('dinonuggies');
      expect(result).toHaveLength(99);
      expect(count).toBe(99);
    });

    it('should respect limit and offset', async () => {
      const users = [
        { id: '1', dinonuggies: 300 },
        { id: '2', dinonuggies: 100 },
        { id: '3', dinonuggies: 200 },
      ];

      await Promise.all(users.map(async (user) => {
        await userModel.createUser(user.id);
        await userModel.setUserAttr(user.id, 'dinonuggies', user.dinonuggies);
      }));

      const result = await userModel.getEveryoneAttr('dinonuggies', 2, 1);
      const count = await userModel.getEveryoneAttrCount('dinonuggies');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('3');
      expect(result[1].id).toBe('2');
      expect(count).toBe(3);
    });
  });

  describe('getRelativeNetWinnings and getRelativeNetWinningsCount', () => {
    it('should calculate relative net winnings', async () => {
      const userId = '123456789';
      await userModel.createUser(userId);
      await userModel.setUserAttr(userId, 'slotsRelativeWon', 10);
      await userModel.setUserAttr(userId, 'slotsTimesPlayed', 5);
      const result = await userModel.getRelativeNetWinnings('slots');
      const count = await userModel.getRelativeNetWinningsCount('slots');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(userId);
      expect(result[0].relativeWon).toBe(5); // 10 - 5 = 5
      expect(count).toBe(1);
    });

    it('should sort by relative net winnings', async () => {
      const userId = '123456789';
      await userModel.createUser(userId);
      await userModel.setUserAttr(userId, 'slotsRelativeWon', 10);
      await userModel.setUserAttr(userId, 'slotsTimesPlayed', 5);
      const userId2 = '987654321';
      await userModel.createUser(userId2);
      await userModel.setUserAttr(userId2, 'slotsRelativeWon', 8);
      await userModel.setUserAttr(userId2, 'slotsTimesPlayed', 2);
      const result = await userModel.getRelativeNetWinnings('slots');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(userId2);
      expect(result[1].id).toBe(userId);
      expect(result[0].relativeWon).toBe(6);
      expect(result[1].relativeWon).toBe(5);
      const count = await userModel.getRelativeNetWinningsCount('slots');
      expect(count).toBe(2);
    });
  });

  describe('getAllRelativeNetWinnings and getAllRelativeNetWinningsCount', () => {
    it('should calculate total relative net winnings across all games', async () => {
      const userId = '123456789';
      await userModel.createUser(userId);
      // Slots: 10 - 5 = 5
      await userModel.setUserAttr(userId, 'slotsRelativeWon', 10);
      await userModel.setUserAttr(userId, 'slotsTimesPlayed', 5);
      // Blackjack: 8 - 3 = 5
      await userModel.setUserAttr(userId, 'blackjackRelativeWon', 8);
      await userModel.setUserAttr(userId, 'blackjackTimesPlayed', 3);
      // Roulette: 6 - 2 = 4
      await userModel.setUserAttr(userId, 'rouletteRelativeWon', 6);
      await userModel.setUserAttr(userId, 'rouletteTimesPlayed', 2);
      const result = await userModel.getAllRelativeNetWinnings();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(userId);
      expect(result[0].relativeWon).toBe(14); // 5 + 5 + 4 = 14
      const count = await userModel.getAllRelativeNetWinningsCount();
      expect(count).toBe(1);
    });

    it('should sort by relative net winnings', async () => {
      const userId = '123456789';
      await userModel.createUser(userId);
      await userModel.setUserAttr(userId, 'slotsRelativeWon', 10);
      await userModel.setUserAttr(userId, 'slotsTimesPlayed', 5);
      const userId2 = '987654321';
      await userModel.createUser(userId2);
      await userModel.setUserAttr(userId2, 'slotsRelativeWon', 10);
      await userModel.setUserAttr(userId2, 'slotsTimesPlayed', 5);
      await userModel.setUserAttr(userId2, 'blackjackRelativeWon', 8);
      await userModel.setUserAttr(userId2, 'blackjackTimesPlayed', 3);
      const result = await userModel.getAllRelativeNetWinnings();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(userId2);
      expect(result[1].id).toBe(userId);
      expect(result[0].relativeWon).toBe(10);
      expect(result[1].relativeWon).toBe(5);
      const count = await userModel.getAllRelativeNetWinningsCount();
      expect(count).toBe(2);
    });
  });

  describe('getUsersWithBirthday', () => {
    it('should return users with birthday on specified date', async () => {
      const userId = '123456789';
      await userModel.createUser(userId);
      const birthday = '2024-01-01T12:00:00.000Z';
      await userModel.setUserAttr(userId, 'birthdays', birthday);
      const result = await userModel.getUsersWithBirthday('01-01T12');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(userId);
    });

    it('should not return users with birthday on different date', async () => {
      const userId = '123456789';
      await userModel.createUser(userId);
      const birthday = '2024-01-01T12:00:00.000Z';
      await userModel.setUserAttr(userId, 'birthdays', birthday);
      const result = await userModel.getUsersWithBirthday('01-02T12');
      expect(result).toHaveLength(0);
    });
  });
});
