const {
  camelToSnake, snakeToCamel, snakeToCamelJSON, camelToSnakeJSON,
} = require('../utils/caseConvert');

describe('camelToSnake', () => {
  test('doesn\'t change lowercase', () => {
    expect(camelToSnake('lowercase')).toBe('lowercase');
  });
  test('changes camelCase to snake_case', () => {
    expect(camelToSnake('camelCase')).toBe('camel_case');
    expect(camelToSnake('camelCaseCase')).toBe('camel_case_case');
    expect(camelToSnake('cCCCCCCamelCase')).toBe('c_c_c_c_c_c_camel_case');
  });
  test('doesn\'t change snake_case', () => {
    expect(camelToSnake('snake_case')).toBe('snake_case');
    expect(camelToSnake('snake_case_case')).toBe('snake_case_case');
    expect(camelToSnake('s_n_a_k_e_case')).toBe('s_n_a_k_e_case');
  });
});

describe('snakeToCamel', () => {
  test('doesn\'t change lowercase', () => {
    expect(snakeToCamel('lowercase')).toBe('lowercase');
  });
  test('changes snake_case to camelCase', () => {
    expect(snakeToCamel('snake_case')).toBe('snakeCase');
    expect(snakeToCamel('snake_case_case')).toBe('snakeCaseCase');
    expect(snakeToCamel('s_n_a_k_e_case')).toBe('sNAKECase');
  });
  test('doesn\'t change camelCase', () => {
    expect(snakeToCamel('camelCase')).toBe('camelCase');
    expect(snakeToCamel('camelCaseCase')).toBe('camelCaseCase');
    expect(snakeToCamel('cCCCCCCamelCase')).toBe('cCCCCCCamelCase');
  });
});

describe('snakeToCamelJSON', () => {
  test('changes JSON with snake_case keys to camelCase keys', () => {
    expect(snakeToCamelJSON({ snake_case: 'value' })).toEqual({ snakeCase: 'value' });
    expect(snakeToCamelJSON({ snake_case_case: 'snek', snake_case: 'snake' })).toEqual({ snakeCaseCase: 'snek', snakeCase: 'snake' });
  });
});

describe('camelToSnakeJSON', () => {
  test('changes JSON with camelCase keys to snake_case keys', () => {
    expect(camelToSnakeJSON({ camelCase: 'value' })).toEqual({ camel_case: 'value' });
    expect(camelToSnakeJSON({ camelCaseCase: 'caml', camelCase: 'cam' })).toEqual({ camel_case_case: 'caml', camel_case: 'cam' });
  });
});
