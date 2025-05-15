const { camelToSnake, snakeToCamel } = require('../utils/caseConvert');

describe('camelToSnake', () => {
  test('doesn\'t change lowercase', () => {
    expect(camelToSnake('lowercase')).toBe('lowercase');
  });
  test('changes camelCase to snake_case', () => {
    expect(camelToSnake('camelCase')).toBe('camel_case');
    expect(camelToSnake('camelCaseCase')).toBe('camel_case_case');
    expect(camelToSnake('cCCCCCCamelCase')).toBe('c_c_c_c_c_c_camel_case');
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
});
