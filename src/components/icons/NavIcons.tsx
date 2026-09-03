import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface IconProps {
  color?: string;
  size?: number;
}

const baseProps = (color: string, sw = 1.8) => ({
  fill: 'none' as const,
  stroke: color,
  strokeWidth: sw,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const HomeIcon: React.FC<IconProps> = ({ color = '#7C7595', size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M 4 11 L 12 4 L 20 11 L 20 19 Q 20 21 18 21 L 14 21 L 14 15 L 10 15 L 10 21 L 6 21 Q 4 21 4 19 Z" {...baseProps(color)} />
  </Svg>
);

export const BrowseIcon: React.FC<IconProps> = ({ color = '#7C7595', size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M 4 6 Q 4 5 5 5 L 11 5 L 12 7 L 12 19 L 5 19 Q 4 19 4 18 Z" {...baseProps(color)} />
    <Path d="M 12 7 L 13 5 L 19 5 Q 20 5 20 6 L 20 18 Q 20 19 19 19 L 12 19" {...baseProps(color)} />
    <Path d="M 7 10 L 9 10 M 7 13 L 9 13" {...baseProps(color, 1.3)} />
    <Path d="M 15 10 L 17 10 M 15 13 L 17 13" {...baseProps(color, 1.3)} />
  </Svg>
);

export const SessionsIcon: React.FC<IconProps> = ({ color = '#7C7595', size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M 14 3 L 6 13 L 11 13 L 10 21 L 18 11 L 13 11 Z" {...baseProps(color)} />
  </Svg>
);

export const LibraryIcon: React.FC<IconProps> = ({ color = '#7C7595', size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    {/* Clipboard board */}
    <Path d="M 6 5 L 18 5 L 18 21 L 6 21 Z" {...baseProps(color)} />
    {/* Clip tab at top center */}
    <Path
      d="M 9 3 Q 9 2 12 2 Q 15 2 15 3 L 15 5 L 9 5 Z"
      fill={color}
      stroke="none"
    />
    {/* Lines on clipboard */}
    <Path d="M 9 10 L 15 10 M 9 13 L 15 13 M 9 16 L 12.5 16" {...baseProps(color, 1.5)} />
  </Svg>
);

export const ProfileIcon: React.FC<IconProps> = ({ color = '#7C7595', size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="8" r="4" {...baseProps(color)} />
    <Path d="M 4 21 Q 4 14 12 14 Q 20 14 20 21" {...baseProps(color)} />
  </Svg>
);

export const SearchIcon: React.FC<IconProps> = ({ color = '#7C7595', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="10.5" cy="10.5" r="6" {...baseProps(color)} />
    <Path d="M 14.7 14.7 L 20 20" {...baseProps(color)} />
  </Svg>
);

export const SavedIcon: React.FC<IconProps & { filled?: boolean }> = ({ color = '#7C7595', size = 22, filled = false }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M 5 4 Q 5 3 6 3 L 18 3 Q 19 3 19 4 L 19 21 L 12 16 L 5 21 Z"
      {...baseProps(color)}
      fill={filled ? color : 'none'}
    />
  </Svg>
);

export const BellIcon: React.FC<IconProps> = ({ color = '#7C3AED', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M 12 3 Q 6 3 6 11 L 6 15 L 4 18 L 20 18 L 18 15 L 18 11 Q 18 3 12 3 Z" {...baseProps(color)} />
    <Path d="M 10 21 Q 11 22 12 22 Q 13 22 14 21" {...baseProps(color)} />
  </Svg>
);
