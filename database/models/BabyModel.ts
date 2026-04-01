import { log } from '../../utils/log';
import babyQueries from '../queries/babyQueries';
import { camelToSnake } from '../../utils/caseConvert';
import type Database from '../Database';

class BabyModel {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async createBaby(motherId: string, fatherId: string): Promise<void> {
    await this.db.user.getUser(motherId);
    await this.db.user.getUser(fatherId);
    const query = babyQueries.CREATE_BABY;
    await this.db.executeQuery(query, [motherId, fatherId]);
  }

  async getBabyById(id: number): Promise<Record<string, any> | null> {
    const query = babyQueries.GET_BABY_BY_ID;
    return this.db.executeSelectQuery(query, [id]);
  }

  async getBabiesByParentId(parentId: string): Promise<Record<string, any>[]> {
    const query = babyQueries.GET_BABIES_BY_PARENT;
    return this.db.executeSelectAllQuery(query, [parentId, parentId]);
  }

  async getAllBabies(): Promise<Record<string, any>[]> {
    const query = babyQueries.GET_ALL_BABIES;
    return this.db.executeSelectAllQuery(query);
  }

  async updateBabyAttr(id: number, attr: string, value: any): Promise<void> {
    const snakeAttr = camelToSnake(attr);
    const query = babyQueries.SET_BABY_ATTR(snakeAttr);
    await this.db.executeQuery(query, [value, id]);
  }

  async addBabyAttr(id: number, attr: string, value: any): Promise<void> {
    const snakeAttr = camelToSnake(attr);
    const query = babyQueries.ADD_BABY_ATTR(snakeAttr);
    await this.db.executeQuery(query, [value, id]);
  }

  async deleteBaby(id: number): Promise<void> {
    const query = babyQueries.DELETE_BABY;
    await this.db.executeQuery(query, [id]);
  }

  async updateBabyStatus(id: number, status: string): Promise<void> {
    return this.updateBabyAttr(id, 'status', status);
  }

  async updateBabyName(id: number, name: string): Promise<void> {
    return this.updateBabyAttr(id, 'name', name);
  }

  async updateBabyBirthday(id: number): Promise<void> {
    const query = babyQueries.SET_BABY_BIRTHDAY;
    await this.db.executeQuery(query, [id]);
  }

  async babyIsUnborn(id: number): Promise<boolean> {
    const baby = await this.getBabyById(id);
    return baby?.status === 'unborn';
  }

  async bornBaby(id: number): Promise<boolean> {
    if (!(await this.babyIsUnborn(id))) {
      log('Baby is not unborn');
      return false;
    }
    await this.updateBabyAttr(id, 'status', 'born');
    await this.updateBabyBirthday(id);
    const baby = await this.getBabyById(id);
    log(`Baby ${id} was born. Mother: ${baby?.mother_id}, Father: ${baby?.father_id}, Status: ${baby?.status}, Birthday: ${baby?.born}`);
    return true;
  }

  // eslint-disable-next-line max-len
  async updateBabyJob(id: number, job: string, pingerTarget: string | null = null, pingerChannel: string | null = null): Promise<boolean> {
    await this.updateBabyAttr(id, 'job', job);
    if (pingerTarget) {
      await this.updateBabyAttr(id, 'pingerTarget', pingerTarget);
      await this.updateBabyAttr(id, 'pingerChannel', pingerChannel);
    }
    log(`Updated job to ${job} for baby ${id}. Pinger target: ${pingerTarget}, Pinger channel: ${pingerChannel}`);
    return true;
  }

  async levelUpBaby(id: number): Promise<boolean> {
    await this.addBabyAttr(id, 'level', 1);
    log(`Baby ${id} leveled up.`);
    return true;
  }

  async incrementNuggieClaimerStats(id: number, claimed: number): Promise<boolean> {
    await this.addBabyAttr(id, 'nuggieClaimerClaims', 1);
    await this.addBabyAttr(id, 'nuggieClaimerClaimed', claimed);
    log(`Baby ${id} claimed ${claimed} nuggies.`);
    return true;
  }

  // eslint-disable-next-line max-len
  async incrementGamblerStats(id: number, games: number, wins: number, losses: number, creditsGambled: number, creditsWon: number): Promise<void> {
    await this.addBabyAttr(id, 'gamblerGames', games);
    await this.addBabyAttr(id, 'gamblerWins', wins);
    await this.addBabyAttr(id, 'gamblerLosses', losses);
    await this.addBabyAttr(id, 'gamblerCreditsGambled', creditsGambled);
    await this.addBabyAttr(id, 'gamblerCreditsWon', creditsWon);
    log(`Baby ${id} incremented gambler stats.`);
  }

  async incrementPingerPings(id: number): Promise<boolean> {
    await this.addBabyAttr(id, 'pingerPings', 1);
    log(`Baby ${id} incremented pinger pings.`);
    return true;
  }
}

export default BabyModel;
