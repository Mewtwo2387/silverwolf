export interface CharacterTextColors {
  nameFill: string;
  nameStroke: string;
  hpLabelFill: string;
  hpLabelStroke: string;
  hpValueFill: string;
  hpValueStroke: string;
  titleFill: string;
  titleStroke: string;
  titleDescFill: string;
  titleDescStroke: string;
  skillNameFill: string;
  skillNameStroke: string;
  skillDamageFill: string;
  skillDamageStroke: string;
  skillCostFill: string;
  skillCostStroke: string;
  skillDescFill: string;
  skillDescStroke: string;
  abilityNameFill: string;
  abilityNameStroke: string;
  abilityDescFill: string;
  abilityDescStroke: string;
}

export const DEFAULT_CHARACTER_TEXT_COLORS: CharacterTextColors = {
  nameFill: '#FFF6DC',
  nameStroke: '#1D130A',
  hpLabelFill: '#F7E5B8',
  hpLabelStroke: '#24190F',
  hpValueFill: '#FFFFFF',
  hpValueStroke: '#1A1A1A',
  titleFill: '#FFF2C7',
  titleStroke: '#2A1F16',
  titleDescFill: '#FFFFFF',
  titleDescStroke: '#1F1F1F',
  skillNameFill: '#FFF0C5',
  skillNameStroke: '#2A1F15',
  skillDamageFill: '#FFFFFF',
  skillDamageStroke: '#1A1A1A',
  skillCostFill: '#E9F6FF',
  skillCostStroke: '#13212B',
  skillDescFill: '#FFFFFF',
  skillDescStroke: '#1F1F1F',
  abilityNameFill: '#FFF0C5',
  abilityNameStroke: '#2A1F15',
  abilityDescFill: '#FFFFFF',
  abilityDescStroke: '#1F1F1F',
};

/**
 * Produce a complete CharacterTextColors object by applying any provided overrides to the defaults.
 *
 * @param textColors - Partial overrides for the default character text color values
 * @returns A `CharacterTextColors` object with default values overridden by properties from `textColors` where provided
 */
export function resolveCharacterTextColors(
  textColors?: Partial<CharacterTextColors>,
): CharacterTextColors {
  return {
    ...DEFAULT_CHARACTER_TEXT_COLORS,
    ...(textColors || {}),
  };
}
