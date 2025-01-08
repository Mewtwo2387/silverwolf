const { format, antiFormat, getPrefix, getNumberFromPrefix } = require('../utils/math');

describe('prefixes', () => {
    test('tier 1', () => {
        expect(getPrefix(0)).toBe("K");
        expect(getPrefix(1)).toBe("M");
        expect(getPrefix(9)).toBe("No");
    });
    test('tier 2', () => {
        expect(getPrefix(10)).toBe("Dc");
        expect(getPrefix(11)).toBe("UDc");
        expect(getPrefix(69)).toBe("NoSxg");
    });
    test('tier 3', () => {
        expect(getPrefix(100)).toBe("Ce");
        expect(getPrefix(101)).toBe("UCe");
        expect(getPrefix(999)).toBe("NoNgNe");
        expect(getPrefix(1000)).toBe("OWO");
    });
});

describe('anti-prefixes', () => {
    test('tier 1', () => {
        expect(getNumberFromPrefix("K")).toBe(0);
        expect(getNumberFromPrefix("M")).toBe(1);
        expect(getNumberFromPrefix("No")).toBe(9);
    });
    test('tier 2', () => {
        expect(getNumberFromPrefix("Dc")).toBe(10);
        expect(getNumberFromPrefix("UDc")).toBe(11);
        expect(getNumberFromPrefix("NoSxg")).toBe(69);
    });
    test('tier 3', () => {
        expect(getNumberFromPrefix("Ce")).toBe(100);
        expect(getNumberFromPrefix("UCe")).toBe(101);
        expect(getNumberFromPrefix("NoNgNe")).toBe(999);
    });
    test('invalid', () => {
        expect(getNumberFromPrefix("")).toBe(-1);
        expect(getNumberFromPrefix("U")).toBe(-1);
        expect(getNumberFromPrefix("SW")).toBe(-1);
        expect(getNumberFromPrefix("Silverwolf is really fucking hot")).toBe(-1);
    });
});

describe('formatting numbers', () => {
    test('numbers below 1000', () => {
        expect(format(123)).toBe("123");
        expect(format(123.45)).toBe("123.45");
        expect(format(123.456)).toBe("123.46");
        expect(format(0.123456)).toBe("0.12");
    });
    test('commas', () => {
        expect(format(1234)).toBe("1,234");
        expect(format(123456.789)).toBe("123,456.79");
    });
    test('shortening', () => {
        expect(format(1234567)).toBe("1.235M");
        expect(format(123456789)).toBe("123.457M");
        expect(format(1234567890)).toBe("1.235B");
        expect(format(1e33)).toBe("1.000Dc");
    });
    test('custom shortening', () => {
        expect(format(123, false, 1)).toBe("123");
        expect(format(1234, false, 1)).toBe("1.234K");
        expect(format(1234567890, false, 12)).toBe("1,234,567,890");
        expect(format(1234567890123, false, 12)).toBe("1.235T");
    });
    test('always fixed', () => {
        expect(format(0.123456, true)).toBe("0.12");
        expect(format(0.1, true)).toBe("0.10");
        expect(format(1, true)).toBe("1.00");
        expect(format(1234.56789, true)).toBe("1,234.57");
        expect(format(123456789.123456, true)).toBe("123,456,789.12");
    });
});

describe('anti-formatting numbers', () => {
    test('pure numerical', () => {
        expect(antiFormat("123")).toBe(123);
        expect(antiFormat("123.456")).toBe(123.456);
        expect(antiFormat("1000000000000")).toBe(1e12);
    });
    test('with prefixes', () => {
        expect(antiFormat("1.235M")).toBe(1235000);
        expect(antiFormat("123.457M")).toBe(123457000);
        expect(antiFormat("1.235B")).toBe(1235000000);
        expect(antiFormat("1.000Dc")).toBe(1e33);
        expect(antiFormat("0Qa")).toBe(0);
    });
    test('with commas', () => {
        expect(antiFormat("1,234")).toBe(1234);
        expect(antiFormat("1,234,567.89")).toBe(1234567.89);
    });
    test('invalid', () => {
        expect(antiFormat("")).toBeNaN();
        expect(antiFormat("Dc")).toBeNaN();
        expect(antiFormat("123Silverwolf is really fucking hot")).toBeNaN();
        expect(antiFormat("1U")).toBeNaN();
    });
});
