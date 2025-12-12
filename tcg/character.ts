/* eslint-disable */
import Canvas from 'canvas';
import { TitleDesc } from './titleDesc';
import { Rarity } from './rarity';
import { Background } from './background';
import { Skill } from './skill';
import { Ability } from './ability';
import { Card } from './interfaces/card';

/**
 * A single character card and their stats
 * @param name - The name of the character
 * @param titleDesc - The title and description of the character
 * @param rarity - The rarity of the character
 * @param hp - Max HP of the character
 * @param type - The type/element of the character
 * @param image - Character image used for generating the card
 * @param background - Background used for generating the card
 * @param skills - A list of skills the character can use
 * @param abilities - A list of passive abilities the character has
 */
export class Character implements Card {
  name: string;
  titleDesc: TitleDesc;
  rarity: Rarity;
  hp: number;
  type: string;
  image: string;
  background: Background;
  skills: Skill[];
  abilities: Ability[];

  constructor(name: string, titleDesc: TitleDesc, rarity: Rarity, hp: number, type: string, image: string, background: Background, skills: Skill[] = [], abilities: Ability[] = []) {
    this.name = name;
    this.titleDesc = titleDesc;
    this.rarity = rarity;
    this.hp = hp;
    this.type = type;
    this.image = image;
    this.background = background;
    this.skills = skills;
    this.abilities = abilities;
  }

  async generateCard() {
    const canvas = Canvas.createCanvas(1080, 1920);
    const ctx = canvas.getContext('2d');

    // Set background
    await this.background.draw(ctx);

    try {
      const typeImage = await Canvas.loadImage(`./tcg/assets/types/${this.type.toLowerCase()}.png`);
      ctx.drawImage(typeImage, 0, 0, 128, 128);
    } catch (error) {
      console.warn(`Type image not found for: ${this.type}`);
    }

    // Draw HP on the rightmost side
    ctx.font = '48px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'right';
    ctx.fillText(`HP:`, 1048, 32);

    ctx.font = '64px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.hp}`, 1048, 96);

    await this.rarity.draw(ctx);

    ctx.font = '96px "Bahnschrift"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.fillText(this.name, 144, 96);

    let currentY = await this.titleDesc.draw(ctx, 192);

    // Draw image and background
    ctx.fillStyle = '#000000';
    ctx.fillRect(64, currentY, 956, 512);

    const image = await Canvas.loadImage(this.image);
    ctx.drawImage(image, 64, currentY, 956, 512);

    currentY += 512 + 96;

    for (const skill of this.skills) {
      currentY = await skill.draw(ctx, currentY);
    }

    for (const ability of this.abilities) {
      currentY = await ability.draw(ctx, currentY);
    }

    return canvas;
  }
}