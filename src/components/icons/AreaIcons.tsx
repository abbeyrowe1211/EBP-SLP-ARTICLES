import React from 'react';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

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

export const FluencyIcon: React.FC<IconProps> = ({ color = '#BE185D', size = 26 }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32">
    <Path d="M 5 11 Q 9 8 13 11 T 21 11 T 27 10" {...baseProps(color)} />
    <Path d="M 5 16 Q 9 13 13 16 T 21 16 T 27 15" {...baseProps(color)} />
    <Path d="M 5 21 Q 9 18 13 21 T 21 21 T 27 20" {...baseProps(color)} />
    <Circle cx="6" cy="9" r="0.7" fill={color} />
  </Svg>
);

export const VoiceResonanceIcon: React.FC<IconProps> = ({ color = '#C2410C', size = 26 }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32">
    <Path d="M 7 13 L 7 19 L 11 19 L 16 23 L 16 9 L 11 13 Z" {...baseProps(color)} />
    <Path d="M 19 12 Q 22 16 19 20" {...baseProps(color, 1.5)} />
    <Path d="M 22 9 Q 27 16 22 23" {...baseProps(color, 1.5)} opacity={0.7} />
  </Svg>
);

export const LanguageIcon: React.FC<IconProps> = ({ color = '#7E22CE', size = 26 }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32">
    <Path d="M 5 9 Q 5 5 9 5 L 23 5 Q 27 5 27 9 L 27 18 Q 27 22 23 22 L 14 22 L 9 27 L 10 22 Q 5 22 5 18 Z" {...baseProps(color)} />
    <Path d="M 9 11 Q 13 10 17 11" {...baseProps(color)} />
    <Path d="M 9 14.5 Q 13 13.5 21 14.5" {...baseProps(color)} />
    <Path d="M 9 18 Q 13 17 19 18" {...baseProps(color)} />
    <Circle cx="20" cy="11" r="0.8" fill={color} />
  </Svg>
);

export const SwallowingIcon: React.FC<IconProps> = ({ color = '#1D4ED8', size = 26 }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32">
    <Path d="M 9 8 L 10 25 Q 10 27 12 27 L 20 27 Q 22 27 22 25 L 23 8 Z" {...baseProps(color)} />
    <Path d="M 9 8 L 23 8" {...baseProps(color, 1.6)} />
    <Path d="M 16 4 Q 13 5 13 8" {...baseProps(color, 1.4)} strokeDasharray="2 1.5" />
    <Circle cx="16" cy="4" r="0.7" fill={color} />
    <Path d="M 11.5 13 Q 16 11 20.5 13" {...baseProps(color, 1.2)} opacity={0.7} />
    <Path d="M 12 18 Q 16 16 20 18" {...baseProps(color, 1.2)} opacity={0.6} />
  </Svg>
);

export const CogCommIcon: React.FC<IconProps> = ({ color = '#B45309', size = 26 }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32">
    <Path d="M 10 12 Q 8 8 12 7 Q 14 4 17 6 Q 21 5 22 9 Q 26 10 25 14 Q 27 18 24 19 Q 25 23 21 23 Q 19 26 16 24 Q 13 26 11 23 Q 7 23 8 19 Q 5 17 7 13 Q 6 10 10 12 Z" {...baseProps(color)} />
    <Path d="M 16 8 L 16 24" {...baseProps(color, 1.2)} />
    <Path d="M 11 13 Q 13 12 14 13" {...baseProps(color, 1.2)} />
    <Path d="M 18 13 Q 20 12 22 13" {...baseProps(color, 1.2)} />
    <Path d="M 11 19 Q 13 18 14 19" {...baseProps(color, 1.2)} />
    <Path d="M 18 19 Q 20 18 22 19" {...baseProps(color, 1.2)} />
  </Svg>
);

export const AacIcon: React.FC<IconProps> = ({ color = '#059669', size = 26 }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32">
    <Rect x="5" y="5" width="22" height="22" rx="3" {...baseProps(color)} />
    <Line x1="5" y1="16" x2="27" y2="16" {...baseProps(color)} />
    <Line x1="12.5" y1="5" x2="12.5" y2="27" {...baseProps(color)} />
    <Line x1="20" y1="5" x2="20" y2="27" {...baseProps(color)} />
    <Circle cx="8.7" cy="11" r="0.9" fill={color} />
    <Circle cx="16.2" cy="11" r="0.9" fill={color} />
    <Circle cx="23.5" cy="11" r="0.9" fill={color} />
    <Circle cx="8.7" cy="22" r="0.9" fill={color} />
    <Circle cx="16.2" cy="22" r="0.9" fill={color} />
    <Circle cx="23.5" cy="22" r="0.9" fill={color} />
  </Svg>
);

export const MotorSpeechIcon: React.FC<IconProps> = ({ color = '#0F766E', size = 26 }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32">
    {/* Lips outline */}
    <Path d="M 8 14 Q 12 11 16 13 Q 20 11 24 14 Q 26 18 16 22 Q 6 18 8 14 Z" {...baseProps(color)} />
    {/* Cupid's bow top line */}
    <Path d="M 8 14 Q 12 16 16 14 Q 20 16 24 14" {...baseProps(color, 1.2)} />
    {/* Sound waves right */}
    <Path d="M 26 12 Q 28 16 26 20" {...baseProps(color, 1.4)} opacity={0.6} />
    <Path d="M 28 10 Q 31 16 28 22" {...baseProps(color, 1.2)} opacity={0.4} />
  </Svg>
);

export const GeneralPracticeIcon: React.FC<IconProps> = ({ color = '#4338CA', size = 26 }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32">
    {/* Clipboard body */}
    <Path d="M 11 6 L 8 6 Q 5 6 5 9 L 5 26 Q 5 28 8 28 L 24 28 Q 27 28 27 26 L 27 9 Q 27 6 24 6 L 21 6" {...baseProps(color)} />
    {/* Clipboard top clip */}
    <Path d="M 11 5 Q 11 3 16 3 Q 21 3 21 5 L 21 7 Q 21 9 16 9 Q 11 9 11 7 Z" {...baseProps(color)} />
    {/* Checkmark */}
    <Path d="M 10 18 L 14 22 L 22 13" {...baseProps(color, 2)} />
  </Svg>
);

export const PillarsIcon: React.FC<IconProps> = ({ color = '#5B21B6', size = 26 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M 3 6 L 21 6" {...baseProps(color)} />
    <Path d="M 4 9 L 20 9" {...baseProps(color)} />
    <Path d="M 4 19 L 20 19" {...baseProps(color)} />
    <Path d="M 6 9 L 6 19" {...baseProps(color, 2)} />
    <Path d="M 10 9 L 10 19" {...baseProps(color, 2)} />
    <Path d="M 14 9 L 14 19" {...baseProps(color, 2)} />
    <Path d="M 18 9 L 18 19" {...baseProps(color, 2)} />
    <Path d="M 3 22 L 21 22" {...baseProps(color)} />
  </Svg>
);
