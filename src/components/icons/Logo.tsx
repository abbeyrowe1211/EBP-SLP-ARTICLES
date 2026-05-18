import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Rect, Path, G } from 'react-native-svg';

interface Props {
  size?: number;
}

export const Logo: React.FC<Props> = ({ size = 56 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#F5F3FF" />
        <Stop offset="100%" stopColor="#DDD6FE" />
      </LinearGradient>
    </Defs>
    <Rect x="0" y="0" width="100" height="100" rx="22" ry="22" fill="url(#bgGrad)" />
    <G transform="translate(14, 22)">
      <Path
        d="M 8,18 C 6,12 10,6 17,7 C 19,3 27,3 30,8 C 35,7 39,11 38,16 C 42,18 42,26 38,28 C 39,33 33,37 28,34 C 25,38 17,38 14,33 C 8,33 5,28 8,24 C 4,22 4,19 8,18 Z"
        fill="white"
        stroke="#A78BFA"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Path d="M 14,16 Q 19,14 23,16" stroke="#A78BFA" strokeWidth={1.1} fill="none" strokeLinecap="round" />
      <Path d="M 14,22 Q 19,20 23,22" stroke="#A78BFA" strokeWidth={1.1} fill="none" strokeLinecap="round" />
      <Path d="M 14,28 Q 19,26 23,28" stroke="#A78BFA" strokeWidth={1.1} fill="none" strokeLinecap="round" />
      <Path d="M 24,10 L 24,34" stroke="#A78BFA" strokeWidth={1.1} fill="none" strokeLinecap="round" />
    </G>
    <G transform="translate(50, 38)">
      <Path
        d="M 8,4 Q 8,0 12,0 L 36,0 Q 40,0 40,4 L 40,18 Q 40,22 36,22 L 20,22 L 14,28 L 15,22 L 12,22 Q 8,22 8,18 Z"
        fill="#C4B5FD"
        opacity={0.92}
        stroke="#A78BFA"
        strokeWidth={1.2}
      />
    </G>
  </Svg>
);
