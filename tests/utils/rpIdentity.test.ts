import { describe, it, expect } from 'bun:test';
import {
  generateCharId, validateCharName, matchMentions, applyUserVar, formatCharHandle, type SpawnLike,
} from '../../utils/rpIdentity';

describe('rpIdentity.applyUserVar', () => {
  it('substitutes {user} when a name is given (self-mode)', () => {
    expect(applyUserVar('Hello {user}!', 'Finch')).toBe('Hello Finch!');
    expect(applyUserVar('{user} and {user}', 'Finch')).toBe('Finch and Finch');
  });

  it('leaves the token literal when name is null (all-mode)', () => {
    expect(applyUserVar('Hello {user}!', null)).toBe('Hello {user}!');
  });

  it('is a no-op when there is no token', () => {
    expect(applyUserVar('no variables here', 'Finch')).toBe('no variables here');
  });
});

describe('rpIdentity.generateCharId', () => {
  it('produces 6-char lowercase alphanumeric ids', () => {
    for (let i = 0; i < 100; i += 1) {
      expect(generateCharId()).toMatch(/^[a-z0-9]{6}$/);
    }
  });
});

describe('rpIdentity.validateCharName', () => {
  it('accepts simple names', () => {
    expect(validateCharName('aventurine')).toBeNull();
    expect(validateCharName('Aven_2')).toBeNull();
  });

  it('rejects dashes, overlong names, and malformed spacing', () => {
    expect(validateCharName('aven-turine')).not.toBeNull();
    expect(validateCharName('a'.repeat(33))).not.toBeNull();
    expect(validateCharName('')).not.toBeNull();
    expect(validateCharName('aven  turine')).not.toBeNull(); // doubled space
  });

  it('allows single spaces between words', () => {
    expect(validateCharName('Silver Wolf')).toBeNull();
    expect(validateCharName('a b c')).toBeNull();
    expect(validateCharName('a'.repeat(32))).toBeNull();
  });

  it('rejects Discord-reserved names', () => {
    expect(validateCharName('everyone')).not.toBeNull();
    expect(validateCharName('here')).not.toBeNull();
    expect(validateCharName('mydiscordbot')).not.toBeNull();
    expect(validateCharName('clyde2')).not.toBeNull();
  });
});

describe('rpIdentity.matchMentions', () => {
  const spawns: SpawnLike[] = [
    { spawnId: 1, charId: 'a2e4se', nameLower: 'aventurine' },
    { spawnId: 2, charId: 'd23efg', nameLower: 'aventurine' }, // same name, different id
    { spawnId: 3, charId: 'zzz999', nameLower: 'bob' },
  ];

  it('matches a unique name', () => {
    const { matched, ambiguous } = matchMentions('hey @bob how are you', spawns);
    expect(matched.map((m) => m.spawnId)).toEqual([3]);
    expect(ambiguous).toHaveLength(0);
  });

  it('flags an ambiguous bare name as ambiguous', () => {
    const { matched, ambiguous } = matchMentions('yo @aventurine', spawns);
    expect(matched).toHaveLength(0);
    expect(ambiguous).toHaveLength(1);
    expect(ambiguous[0].candidates.map((c) => c.spawnId).sort()).toEqual([1, 2]);
  });

  it('disambiguates with a name-idprefix handle', () => {
    const { matched, ambiguous } = matchMentions('@aventurine-a2e are you there', spawns);
    expect(matched.map((m) => m.spawnId)).toEqual([1]);
    expect(ambiguous).toHaveLength(0);
  });

  it('disambiguates a mixed-case name-idprefix handle', () => {
    const { matched, ambiguous } = matchMentions('@Aventurine-A2E are you there', spawns);
    expect(matched.map((m) => m.spawnId)).toEqual([1]);
    expect(ambiguous).toHaveLength(0);
  });

  it('matches by id (full or prefix)', () => {
    expect(matchMentions('@a2e4se', spawns).matched.map((m) => m.spawnId)).toEqual([1]);
    expect(matchMentions('@zzz', spawns).matched.map((m) => m.spawnId)).toEqual([3]);
  });

  it('matches a unique name prefix', () => {
    expect(matchMentions('@bo', spawns).matched.map((m) => m.spawnId)).toEqual([3]);
  });

  it('does not trigger mid-word (e.g. emails)', () => {
    expect(matchMentions('mail me at someone@bob.example', spawns).matched).toHaveLength(0);
  });

  it('dedupes a character mentioned two ways in one message', () => {
    const { matched } = matchMentions('@bob aka @zzz999', spawns);
    expect(matched.map((m) => m.spawnId)).toEqual([3]);
  });

  it('matches multiple distinct characters in one message', () => {
    const { matched } = matchMentions('@bob and @aventurine-d23 hi', spawns);
    expect(matched.map((m) => m.spawnId).sort()).toEqual([2, 3]);
  });
});

describe('rpIdentity.formatCharHandle', () => {
  it('strips spaces so the handle stays a single parseable token', () => {
    expect(formatCharHandle('Silver Wolf', 'silw01')).toBe('@SilverWolf-silw01');
    expect(formatCharHandle('bob', 'bob123')).toBe('@bob-bob123');
  });
});

describe('rpIdentity.matchMentions with spaced names', () => {
  const spawns: SpawnLike[] = [
    { spawnId: 1, charId: 'silw01', nameLower: 'silver wolf' },
    { spawnId: 2, charId: 'bob123', nameLower: 'bob' },
  ];

  it('matches a spaced name written as one token (any case)', () => {
    expect(matchMentions('hey @SilverWolf', spawns).matched.map((m) => m.spawnId)).toEqual([1]);
    expect(matchMentions('yo @silverwolf ok', spawns).matched.map((m) => m.spawnId)).toEqual([1]);
  });

  it('matches a spaced name by its first-word prefix', () => {
    expect(matchMentions('@Silver you there', spawns).matched.map((m) => m.spawnId)).toEqual([1]);
  });

  it('disambiguates a spaced name with the stripped id handle', () => {
    expect(matchMentions('@SilverWolf-silw01 hi', spawns).matched.map((m) => m.spawnId)).toEqual([1]);
  });
});
