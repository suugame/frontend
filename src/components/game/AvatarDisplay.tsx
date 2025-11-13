import Avatar from 'boring-avatars';
import { getElementColors, getMonsterTypeVariant } from '@/utils/gameHelpers';

interface AvatarDisplayProps {
  name: string;
  element?: number;
  monsterType?: number;
  isGoldenMonster?: boolean;
  size?: number;
  flipHorizontal?: boolean;
}

export default function AvatarDisplay({
  name,
  element,
  monsterType,
  isGoldenMonster = false,
  size = 120,
  flipHorizontal = false,
}: AvatarDisplayProps) {
  const colors = isGoldenMonster
    ? ['#FFD700', '#FFA500', '#FF8C00', '#FF6347', '#FF4500']
    : element !== undefined
      ? getElementColors(element)
      : ['#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e'];

  // Determine variant by monsterType; default to 'beam' if unspecified
  const variant = monsterType !== undefined 
    ? getMonsterTypeVariant(monsterType)
    : 'beam';

  const avatarElement = (
    <Avatar
      name={name}
      colors={colors}
      variant={variant}
      size={size}
    />
  );

  if (flipHorizontal) {
    return <div className="transform scale-x-[-1]">{avatarElement}</div>;
  }

  return avatarElement;
}

