export const fontFamily = {
  regular: 'Quicksand_400Regular',
  medium: 'Quicksand_500Medium',
  semibold: 'Quicksand_600SemiBold',
  bold: 'Quicksand_700Bold',
};

export const text = {
  // Card titles, button labels
  h1: { fontFamily: fontFamily.bold, fontSize: 28, letterSpacing: -0.5 },
  h2: { fontFamily: fontFamily.bold, fontSize: 22, letterSpacing: -0.4 },
  h3: { fontFamily: fontFamily.semibold, fontSize: 17 },
  h4: { fontFamily: fontFamily.semibold, fontSize: 14 },
  body: { fontFamily: fontFamily.medium, fontSize: 14 },
  bodySmall: { fontFamily: fontFamily.medium, fontSize: 12 },
  caption: { fontFamily: fontFamily.medium, fontSize: 11 },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  badge: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
};
