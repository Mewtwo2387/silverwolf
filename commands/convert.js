const { Command } = require('./classes/command');

class Convert extends Command {
  constructor(client) {
    super(
      client,
      'convert',
      'Convert units',
      [
        {
          name: 'from',
          type: 3,
          description: 'The unit to convert from',
          required: true,
          choices: [
            { name: 'Celsius', value: 'celsius' },
            { name: 'Fahrenheit', value: 'fahrenheit' },
            { name: 'Kelvin', value: 'kelvin' },
            { name: 'Gram', value: 'gram' },
            { name: 'Kilogram', value: 'kilogram' },
            { name: 'Pound', value: 'pound' },
            { name: 'Meter', value: 'meter' },
            { name: 'Foot', value: 'foot' },
            { name: 'Inch', value: 'inch' },
          ],
        },
        {
          name: 'to',
          type: 3,
          description: 'The unit to convert to',
          required: true,
          choices: [
            { name: 'Celsius', value: 'celsius' },
            { name: 'Fahrenheit', value: 'fahrenheit' },
            { name: 'Kelvin', value: 'kelvin' },
            { name: 'Gram', value: 'gram' },
            { name: 'Kilogram', value: 'kilogram' },
            { name: 'Pound', value: 'pound' },
            { name: 'Meter', value: 'meter' },
            { name: 'Foot', value: 'foot' },
            { name: 'Inch', value: 'inch' },
          ],
        },
        {
          name: 'input',
          type: 4,
          description: 'The value to convert',
          required: true,
        },
      ],
      { blame: 'ei' },
    );
  }

  async run(interaction) {
    const { options } = interaction;
    const fromUnit = options.getString('from').toLowerCase();
    const toUnit = options.getString('to').toLowerCase();
    const value = options.getInteger('input');

    const conversionFactors = {
      temperature: {
        celsius: { offset: 273.15, multiplier: 1 },
        fahrenheit: { offset: 459.67, multiplier: 5 / 9 },
        kelvin: { offset: 0, multiplier: 1 },
      },
      mass: {
        kilogram: { offset: 0, multiplier: 1 },
        gram: { offset: 0, multiplier: 0.001 },
        pound: { offset: 0, multiplier: 0.453592 },
      },
      length: {
        meter: { offset: 0, multiplier: 1 },
        foot: { offset: 0, multiplier: 0.3048 },
        inch: { offset: 0, multiplier: 0.0254 },
      },
    };

    function convertUnit(val, from, to, category) {
      const fromConversion = conversionFactors[category][from];
      const toConversion = conversionFactors[category][to];
      if (!fromConversion || !toConversion) return 'Invalid conversion';
      // eslint-disable-next-line no-mixed-operators
      return (val + fromConversion.offset) * fromConversion.multiplier
        // eslint-disable-next-line no-mixed-operators
        / toConversion.multiplier - toConversion.offset;
    }

    let category;
    if (['celsius', 'fahrenheit', 'kelvin'].includes(fromUnit)) {
      category = 'temperature';
    } else if (['gram', 'kilogram', 'pound'].includes(fromUnit)) {
      category = 'mass';
    } else if (['meter', 'foot', 'inch'].includes(fromUnit)) {
      category = 'length';
    } else {
      await interaction.editReply({ content: 'Invalid unit for conversion' });
      return;
    }

    const result = convertUnit(value, fromUnit, toUnit, category);
    if (result === 'Invalid conversion') {
      await interaction.editReply({ content: 'Invalid conversion' });
      return;
    }

    await interaction.editReply({ content: `${value} ${fromUnit} is ${result.toFixed(2)} ${toUnit}` });
  }
}

module.exports = Convert;
