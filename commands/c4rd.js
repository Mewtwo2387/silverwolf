const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { Command } = require('./classes/command');
const { Character } = require('../tcg/character.ts');
const { Background, BackgroundType, TopBarType } = require('../tcg/background.ts');
const { Rarity } = require('../tcg/rarity.ts');
const { Skill } = require('../tcg/skill.ts');
const { Ability } = require('../tcg/ability.ts');
const { TitleDesc } = require('../tcg/titleDesc.ts');
const { Element } = require('../tcg/element.ts');
const { RangeType } = require('../tcg/rangeType.ts');

class C4rd extends Command {
  constructor(client) {
    super(client, 'c4rd', 'Generate a custom card', [
      {
        name: 'name',
        type: 3,
        description: 'The name of the character',
        required: true,
      },
      {
        name: 'title',
        type: 3,
        description: 'The title of the character',
        required: true,
      },
      {
        name: 'description',
        type: 3,
        description: 'The description of the character',
        required: true,
      },
      {
        name: 'rarity',
        type: 4,
        description: 'The rarity of the character (1-6 stars)',
        required: true,
        min_value: 1,
        max_value: 6,
      },
      {
        name: 'hp',
        type: 4,
        description: 'The HP of the character',
        required: true,
        min_value: 1,
        max_value: 9999,
      },
      {
        name: 'type',
        type: 3,
        description: 'The type of the character',
        required: true,
        choices: [
          { name: 'Fairy', value: 'fairy' },
          { name: 'Quantum', value: 'quantum' },
          { name: 'Imaginary', value: 'imaginary' },
          { name: 'Physical', value: 'physical' },
          { name: 'Anemo', value: 'anemo' },
          { name: 'Electro', value: 'electro' },
          { name: 'Cryo', value: 'cryo' },
          { name: 'Pyro', value: 'pyro' },
          { name: 'Geo', value: 'geo' },
          { name: 'Dendro', value: 'dendro' },
          { name: 'Hydro', value: 'hydro' },
        ],
      },
      {
        name: 'image',
        type: 3,
        description: 'URL of the character image',
        required: true,
      },
      {
        name: 'border_color',
        type: 3,
        description: 'Border color (hex code)',
        required: true,
      },
      {
        name: 'background_type',
        type: 3,
        description: 'Type of background',
        required: true,
        choices: [
          { name: 'Solid', value: 'solid' },
          { name: 'Gradient', value: 'gradient' },
          { name: 'Image', value: 'image' },
        ],
      },
      {
        name: 'top_bar_type',
        type: 3,
        description: 'Type of top bar',
        required: true,
        choices: [
          { name: 'Solid', value: 'solid' },
          { name: 'Translucent', value: 'translucent' },
          { name: 'Fade', value: 'fade' },
        ],
      },
      {
        name: 'background_color',
        type: 3,
        description: 'Background color (hex code)',
        required: false,
      },
      {
        name: 'background_color2',
        type: 3,
        description: 'Second background color for gradient (hex code)',
        required: false,
      },
      {
        name: 'background_image',
        type: 3,
        description: 'URL of background image',
        required: false,
      },
      {
        name: 'top_bar_color',
        type: 3,
        description: 'Top bar color (hex code)',
        required: false,
      },
      {
        name: 'top_bar_opacity',
        type: 10,
        description: 'Top bar opacity (0-1) if translucent or fade',
        required: false,
      },
      {
        name: 'top_bar_opacity2',
        type: 10,
        description: 'Second top bar opacity for fade (0-1)',
        required: false,
      },
      {
        name: 'title_color',
        type: 3,
        description: 'Title description color (hex code)',
        required: false,
      },
      {
        name: 'attacks',
        type: 3,
        description: 'semicolon-separated list of attacks,description,damage,cost',
        required: false,
      },
      {
        name: 'abilities',
        type: 3,
        description: 'semicolon-separated list of abilities,description',
        required: false,
      },
    ]);
  }

  async run(interaction) {
    try {
      // Get all the parameters
      const name = interaction.options.getString('name');
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const rarity = interaction.options.getInteger('rarity');
      const hp = interaction.options.getInteger('hp');
      const type = interaction.options.getString('type');
      const elementKey = type ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() : '';
      const element = Element[elementKey];
      if (element === undefined) {
        await interaction.editReply('Invalid element type.');
        return;
      }
      const image = interaction.options.getString('image');
      const borderColor = interaction.options.getString('border_color');
      const backgroundType = interaction.options.getString('background_type');
      const topBarType = interaction.options.getString('top_bar_type');
      let backgroundTypeInternal;
      let backgroundOptions;
      let topBarTypeInternal;
      let topBarOptions;
      switch (backgroundType) {
        case 'solid': {
          const backgroundColor = interaction.options.getString('background_color');
          if (!backgroundColor) {
            await interaction.editReply('Background color is required when using solid background type.');
            return;
          }
          backgroundOptions = {
            color: backgroundColor,
          };
          backgroundTypeInternal = BackgroundType.Solid;
          break;
        }
        case 'gradient': {
          const backgroundColor = interaction.options.getString('background_color');
          const backgroundColor2 = interaction.options.getString('background_color2');
          if (!backgroundColor || !backgroundColor2) {
            await interaction.editReply('Both background colors are required when using gradient background type.');
            return;
          }
          backgroundOptions = {
            color1: backgroundColor,
            color2: backgroundColor2,
          };
          backgroundTypeInternal = BackgroundType.Gradient;
          break;
        }
        case 'image': {
          const backgroundImage = interaction.options.getString('background_image');
          if (!backgroundImage) {
            await interaction.editReply('Background image URL is required when using image background type.');
            return;
          }
          backgroundOptions = {
            image: backgroundImage,
          };
          backgroundTypeInternal = BackgroundType.Image;
          break;
        }
        default: {
          await interaction.editReply('Invalid background type.');
          return;
        }
      }
      switch (topBarType) {
        case 'solid': {
          const topBarColor = interaction.options.getString('top_bar_color');
          if (!topBarColor) {
            await interaction.editReply('Top bar color is required when using solid top bar type.');
            return;
          }
          topBarOptions = {
            color: topBarColor,
          };
          topBarTypeInternal = TopBarType.Solid;
          break;
        }
        case 'translucent': {
          const topBarColor = interaction.options.getString('top_bar_color');
          const topBarOpacity = interaction.options.getNumber('top_bar_opacity');
          if (!topBarColor || topBarOpacity == null) {
            await interaction.editReply('Top bar color and opacity are required when using translucent top bar type.');
            return;
          }
          topBarOptions = {
            color: topBarColor,
            opacity: topBarOpacity,
          };
          topBarTypeInternal = TopBarType.Translucent;
          break;
        }
        case 'fade': {
          const topBarColor = interaction.options.getString('top_bar_color');
          const topBarOpacity = interaction.options.getNumber('top_bar_opacity');
          const topBarOpacity2 = interaction.options.getNumber('top_bar_opacity2');
          if (!topBarColor || topBarOpacity == null || topBarOpacity2 == null) {
            await interaction.editReply('Top bar color, opacity, and opacity2 are required when using fade top bar type.');
            return;
          }
          topBarOptions = {
            color: topBarColor,
            opacity1: topBarOpacity,
            opacity2: topBarOpacity2,
          };
          topBarTypeInternal = TopBarType.Fade;
          break;
        }
        default: {
          await interaction.editReply('Invalid top bar type.');
          return;
        }
      }

      const titleColor = interaction.options.getString('title_color') || '#777777';
      const attacks = interaction.options.getString('attacks');
      const abilities = interaction.options.getString('abilities');

      const attacksArray = [];
      const abilitiesArray = [];

      if (attacks) {
        const attackEntries = attacks.split(';').map((attack) => attack.trim()).filter(Boolean);
        const parsedAttacks = attackEntries.map((attack) => attack.split(',').map((part) => part.trim()));

        if (parsedAttacks.some((params) => params.length !== 4)) {
          await interaction.editReply('Invalid attack format. Expected: name,description,damage,cost');
          return;
        }

        const attackObjects = parsedAttacks.map(([attackName, attackDescription, attackDamageRaw, attackCostRaw]) => {
          const attackDamage = Number(attackDamageRaw);
          const attackCost = Number(attackCostRaw);
          return {
            attackName,
            attackDescription,
            attackDamage,
            attackCost,
            hasInvalidNumbers: Number.isNaN(attackDamage) || Number.isNaN(attackCost),
          };
        });

        if (attackObjects.some((attack) => attack.hasInvalidNumbers)) {
          await interaction.editReply('Invalid attack format. Damage and cost must be numbers.');
          return;
        }

        attackObjects.forEach((attack) => {
          attacksArray.push(
            new Skill(
              attack.attackName,
              attack.attackDescription,
              attack.attackDamage,
              attack.attackCost,
              RangeType.SingleOpponent,
              [],
            ),
          );
        });
      }

      if (abilities) {
        const abilityEntries = abilities.split(';').map((ability) => ability.trim()).filter(Boolean);
        const parsedAbilities = abilityEntries.map((ability) => ability.split(',').map((part) => part.trim()));

        if (parsedAbilities.some((params) => params.length !== 2)) {
          await interaction.editReply('Invalid ability format. Expected: name,description');
          return;
        }

        parsedAbilities.forEach(([abilityName, abilityDescription]) => {
          abilitiesArray.push(new Ability(abilityName, abilityDescription, []));
        });
      }

      // Create the card
      const card = new Character(
        name,
        new TitleDesc(title, description, titleColor),
        new Rarity(rarity),
        hp,
        element,
        image,
        new Background(backgroundTypeInternal, backgroundOptions, borderColor, topBarTypeInternal, topBarOptions),
        attacksArray,
        abilitiesArray,
      );

      // Generate the card
      const canvas = await card.generateCard();
      const buffer = canvas.toBuffer('image/png');

      // Create attachment
      const attachment = new AttachmentBuilder(buffer, { name: `${name.toLowerCase().replace(/\s+/g, '_')}_card.png` });

      // Create embed
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`Generated Card: ${name}`)
        .setImage(`attachment://${attachment.name}`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed], files: [attachment] });
    } catch (error) {
      console.error('Error generating card:', error);
      await interaction.editReply('An error occurred while generating the card. Please check your parameters and try again.');
    }
  }
}

module.exports = C4rd;
