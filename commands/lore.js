/* eslint-disable no-useless-escape */
const Discord = require('discord.js');
const { Command } = require('./classes/command');

class Lore extends Command {
  constructor(client) {
    super(
      client,
      'lore',
      'send member lore',
      [{
        name: 'member',
        description: 'lore of the member',
        type: 3,
        required: true,
      }],
      { blame: 'ei' },
    );
  }

  async run(interaction) {
    switch (interaction.options.getString('member').toLowerCase()) {
      case 'doge': case 'kaitlin':
        interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AAAA')
            .setTitle('«« ━━ ✦・Doge Lore・✦ ━━ »»')
            .setDescription('### Lover of the TGP Queen\nDoge is doge.')
            .addFields({ name: 'Timezone', value: 'Vietnam (GMT+7)', inline: true })
            .addFields({ name: 'Staff', value: 'None', inline: true })
            .addFields({ name: 'Join Date', value: 'April \'22', inline: true })
            .addFields({ name: 'Pronouns', value: 'She/Her', inline: true })
            .addFields({ name: 'Veteran', value: 'Yes', inline: true })
            .addFields({ name: 'Basement Member', value: 'Yes', inline: true })
            .addFields({ name: 'Aliases', value: 'Doge\nDoge Man\nUnlimited Doge Works\nSosuke Aizen\nKarl\nKita\nKaitlin\nOkita\nFischl Simp\nVenfei\'s boyfriend\nLover of the TGP Queen\nHerrscher of Egg', inline: true })
            .addFields({ name: 'Matrix Relationships', value: '**Shipped with: ** Venfei\n**Married on: ** The Akagi\n**Simps for: ** Fischl (Not anymore)\n**Alt: ** Kira\n**Therapist: ** Jez\n**New Wife: ** Make it a Quote Bot', inline: true })
            .addFields({ name: 'Quotes', value: '*"I love Venfei"*\n*"Venfei is a nice roommate sexually"*\n*"I want to peg Venfei"*\n*"I pissed in your cereal"*\n*"I swear if Japan wins against Germany I am going to post myself wearing a maid dress"*', inline: true })
            .addFields({ name: 'Lore 1: Fischl Simp', value: 'Doge had an homework folder containing a lot of Fischl. He was originally a Fischl simp, but abandoned Fischl for Venfei.', inline: false })
            .addFields({ name: 'Lore 2: The tied up Fischl', value: 'Ei tied up Doge\'s Fischl to threaten Doge when Doge wants to send Ei grass.', inline: false })
            .addFields({ name: 'Lore 3: Dogefei', value: 'The best ship of TGP, Doge x Venfei. One of the 4 OG TGP Ships. They were married on The Akagi on April 18, 2022. Doge became a skinwalker on The Akagi, and later ate all the wedding cake. Doge wants to move to Australia for Venfei.', inline: false })
            .addFields({ name: 'Lore 4: Venfeifallen NFT', value: 'Doge drew a venfeifallen and got turned into an NFT by Ei.', inline: false })
            .addFields({ name: 'Lore 5: The bans', value: 'Doge was once the most warned member due to misspelling ningguang, and was banned by mistake for that which was removed a few days later. He then proceed to get banned a second time, for real, a month later. After living in the basement and undergo character development, his appeal half a year later was a success.', inline: false })
            .addFields({ name: 'Lore 6: The Kira alt', value: 'Doge used his alt Kira everytime he is banned. Which was incredibly obvious as it aligns with the time his main was banned, the time he eats, and also uses the same +7 timezone. His alt calls Venfei "bride", and beat Childe with Fischl.', inline: false })
            .addFields({ name: 'Lore 7: Character Development', value: 'Doge character developed from refusing all horni and getting warned for spamming non-horni in basement horni channels, to a degen.', inline: false })
            .addFields({ name: 'Lore 8: Broken Mic', value: 'Doge have a shitty mic when singing in the toilet in a TGP karaoke.', inline: false })
            .addFields({ name: 'Lore 9: Dignity Gambling', value: '"I swear if Japan wins against Germany I am going to post myself wearing a maid dress". Famous last words.', inline: false })
            .addFields({ name: 'Lore 10: Jez therapy', value: 'Doge got the worst possible self deprecation, and became the final boss of therapy. Jez tried giving him therapy in the basement.', inline: false })
            .addFields({ name: 'Lore 11: Stockfish', value: 'Cheater smh.', inline: false })
            .addFields({ name: 'Lore 12: Renvi Appreciation', value: 'Renvi loves doge\'s navel. That\'s it. I won\'t provide any more context.', inline: false })
            .addFields({ name: 'Lore 13: Herrscher of Egg', value: 'Doge wants to be a girl. And now Doge is a girl.', inline: false }),
          ],
        });
        break;
      case 'implicit':
        interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AAAA')
            .setTitle('«« (;  · \\\_ ·) Implicit lore (;  · \\\_ ·) »»')
            .setDescription('### (;  · \\\_ ·)\n(;  · \\\_ ·)(;  · \\\_ ·)(;  · \\\_ ·) (;  · \\\_ ·)(;  · \\\_ ·)(;  · \\\_ ·)(;  · \\\_ ·) (;  · \\\_ ·)(;  · \\\_ ·) (;  · \\\_ ·)(;  · \\\_ ·)(;  · \\\_ ·)(;  · \\\_ ·)')
            .addFields({ name: 'Timezone', value: 'GMT+8 (Philippines)', inline: true })
            .addFields({ name: 'Staff', value: 'Lore Team\nr/place staff', inline: true })
            .addFields({ name: 'Join Date', value: 'April \'22', inline: true })
            .addFields({ name: 'Pronouns', value: 'He/Him', inline: true })
            .addFields({ name: 'Veteran', value: 'Yes', inline: true })
            .addFields({ name: 'Basement Member', value: 'Yes', inline: true })
            .addFields({ name: 'Aliases', value: 'Implicit [insert anything]\n(;  · \\\_ ·)\nExplicit All', inline: true })
            .addFields({ name: 'Matrix Relationships', value: '(;  · \\\_ ·)', inline: true })
            .addFields({ name: 'Quotes', value: '(;  · \\\_ ·)', inline: true })
            .addFields({ name: 'Lore (;  · \\\_ ·): (;  · \\\_ ·)', value: '(;  · \\\_ ·)(;  · \\\_ ·) (;  · \\\_ ·)(;  · \\\_ ·)(;  · \\\_ ·)', inline: false }),
          ],
        });
        break;
      case 'akagi': case 'akagers':
        interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AAAA')
            .setTitle('«« ━━ ✦・Akagi Lore・✦ ━━ »»')
            .setDescription('### Sentient Aircraft Carrier\nAkagi is an IJN aircraft carrier disguised as a genderbent human being. Despite being an aircraft carrier, his iconic quote is "I am not an aircraft carrier".')
            .addFields({ name: 'Timezone', value: 'Phillipines (GMT+8)', inline: true })
            .addFields({ name: 'Staff', value: 'Event Team (Resigned)\nDesign Team\nr/place staff', inline: true })
            .addFields({ name: 'Join Date', value: 'April \'22', inline: true })
            .addFields({ name: 'Pronouns', value: 'He/Him', inline: true })
            .addFields({ name: 'Veteran', value: 'Yes', inline: true })
            .addFields({ name: 'Basement Member', value: 'Yes', inline: true })
            .addFields({ name: 'Aliases', value: 'Akagi\nAkagers\nAircraft Carrier\nHerrscher of Carriers\nAce person in horni server', inline: true })
            .addFields({ name: 'Matrix Relationships', value: '**Shipped with: ** Fit (Not anymore)\n**Mutualistic Grasseating: **Ei\n**Sisters: **Keq, Astro, Kaslanass, Lav\n**Alt: **Kaga', inline: true })
            .addFields({ name: 'Quotes', value: '*"I\'m not an aircraft carrier"*\n*"Fit is not my alt"*\n*"Akagi is flat"*', inline: true })
            .addFields({ name: 'Lore 1: Grasseating', value: 'Akagi likes eating grass. As an aircraft carrier, he consumes grass as fuel. He helps eat all the grass which Ei is allergic to.', inline: false })
            .addFields({ name: 'Lore 2: Dogefei Wedding', value: 'The wedding between Doge and Venfei happened on The Akagi. Akagi and Fit helped clean up the carrier for the wedding.', inline: false })
            .addFields({ name: 'Lore 3: Fitkagi', value: 'Akagi was shipped with Fit as one of the 4 OG TGP ships. They both have an irl relationship person now.', inline: false })
            .addFields({ name: 'Lore 4: Alts', value: 'Everyone, including fit, is an alt of Akagi.', inline: false })
            .addFields({ name: 'Lore 5: Genderbent Akagi', value: 'Akagi\'s friend drew a genderbent version of him. And then it\'s used in Project Keqei. And then Ei edited it to make it blush.', inline: false })
            .addFields({ name: 'Lore 6: EEE HEE HEE', value: 'EEE HEE HEE', inline: false })
            .addFields({ name: 'Lore 7: (not) ace person in horni server', value: 'He uhhh, you know what he did', inline: false })
            .addFields({ name: 'Lore 8: Piss', value: 'He was pissed on and turned bright yellow. He now unpissed.', inline: false }),
          ],
        });
        break;
      case 'jez': case 'xei': case 'xeiris':
        interaction.editReply('# XEIPIZZA');
        interaction.channel.send('<:yanfeismug:1136925353651228775>');
        interaction.channel.send({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AAAA')
            .setTitle('«« ━━ ✦・Jez Lore・✦ ━━ »»')
            .setDescription('### Sentient GPU\nIris XE supremacy')
            .addFields({ name: 'Timezone', value: 'Singapore (GMT+8)', inline: true })
            .addFields({ name: 'Staff', value: 'Basement Admin', inline: true })
            .addFields({ name: 'Join Date', value: 'November \'22', inline: true })
            .addFields({ name: 'Pronouns', value: 'He/Him', inline: true })
            .addFields({ name: 'Veteran', value: 'No (but entered vet chat via levels)', inline: true })
            .addFields({ name: 'Basement Member', value: 'Yes', inline: true })
            .addFields({ name: 'Aliases', value: 'Jez\nXei\nXel\nXeiris\nXelris\nArcXe\nIris Xe\nHerrscher of Lofi\nLofi\'s Husband\nMeltryllis Simp', inline: true })
            .addFields({ name: 'Matrix Relationships', value: '**Wife: ** Lofi Bot\n**Classmate: ** Mystic\n**Therapy on: ** Doge\n**Simps for: ** Meltryllis\n**Shipped with: ** Leon (I swear this was real)', inline: true }),
          ],
        });
        break;
      case 'karezi': case 'kareezers':
        interaction.editReply('childe');
        interaction.channel.send({ files: [{ attachment: 'https://media.tenor.com/lnf8yDfui1QAAAAC/lumine-lick.gif' }] });
        break;
      case 'jaydon':
        if (Math.random() < 0.5) {
          interaction.editReply('keqing');
          interaction.channel.send('<:yanfeismug:1136925353651228775>');
        } else {
          interaction.editReply('no keqing?');
        }
        break;
      case 'venfei':
        interaction.editReply('a'.repeat(Math.ceil(Math.random() * 25)));
        break;
      case 'dani': case 'danie': case 'jes': case 'jester':
        interaction.editReply('scarameow :3');
        break;
      case 'mistake':
        interaction.editReply(`[1:1] In the beginning when Mistake created the server,
[1:2] the server was a formless void and darkness covered the face of the deep, while a wind from Mistake swept over the face of the waters.
[1:3] Then Mistake said, "Let there be channels"; and there was channels.
[1:4] And Mistake saw that the channels was good; and Mistake separated the general chat from the place chat.
[1:5] Mistake called the channel #general, and there was \`#g #e #n #s #h #i #n\`.
[1:6] And Mistake said, "Let there be an incoming channel in the midst of the channels, and let it separate the channel from the channels."
[1:7] So Mistake made \`#incoming\` and separated the channels that were under the \`#incoming\` with another category. And it was so.`);
        break;
      case 'mystic':
        interaction.editReply('mommy');
        break;
      default:
        interaction.editReply('send me the lore');
    }
  }
}

module.exports = Lore;
