/* eslint-disable */
import Canvas from 'canvas';
import { TitleDesc } from './titleDesc';
import { Rarity } from './rarity';
import { Background } from './background';
import { Skill } from './skill';
import { Ability } from './ability';
import { Card } from './interfaces/card';
import { Element } from './element';

/**
 * A single character card and their stats
 * @param name - The name of the character
 * @param titleDesc - The title and description of the character
 * @param rarity - The rarity of the character
 * @param hp - Max HP of the character
 * @param element - The type/element of the character
 * @param image - Character image used for generating the card
 * @param background - Background used for generating the card
 * @param skills - A list of skills the character can use
 * @param abilities - A list of passive abilities the character has
 * @param defaultActiveSkillIndices - Optional: which skill indices are available in the default/base form. If not specified, all skills are available.
 */
export class Character implements Card {
  name: string;
  titleDesc: TitleDesc;
  rarity: Rarity;
  hp: number;
  element: Element;
  image: string;
  background: Background;
  skills: Skill[];
  abilities: Ability[];
  defaultActiveSkillIndices?: number[];

  constructor(name: string, titleDesc: TitleDesc, rarity: Rarity, hp: number, element: Element, image: string, background: Background, skills: Skill[] = [], abilities: Ability[] = [], defaultActiveSkillIndices?: number[]) {
    this.name = name;
    this.titleDesc = titleDesc;
    this.rarity = rarity;
    this.hp = hp;
    this.element = element;
    this.image = image;
    this.background = background;
    this.skills = skills;
    this.abilities = abilities;
    this.defaultActiveSkillIndices = defaultActiveSkillIndices;
  }

  async generateCard() {
    const canvas = Canvas.createCanvas(1080, 1920);
    const ctx = canvas.getContext('2d');

    // Set background
    await this.background.draw(ctx);

    try {
      const elementImage = await Canvas.loadImage(`./tcg/assets/elements/${this.element}.png`);
      ctx.drawImage(elementImage, 0, 0, 128, 128);
    } catch (error) {
      console.warn(`Element image not found for: ${this.element}`);
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