import { Platform } from 'react-native';

export const colors = {
  night950: '#0C2927',
  night850: '#173832',
  plum700: '#2F4A3B',
  plum500: '#4F684F',
  lavender300: '#AEB9A8',
  lavender100: '#E2E5D9',
  ivory: '#F3EEE5',
  paper: '#EAE3D7',
  peach300: '#D2A17E',
  peach100: '#EEDDCF',
  text: '#23382D',
  textSecondary: '#59645B',
  inverse: '#F7F1E7',
  inverseSecondary: '#D9DED3',
  success: '#4D7058',
  warning: '#A36749',
  danger: '#A24F45',
  line: 'rgba(47,62,47,0.16)',
  white20: 'rgba(247,241,231,0.20)',
  white08: 'rgba(247,241,231,0.09)',
  transparent: 'transparent',
  gold: '#B5975D',
  fog: '#B7BDB6',
  placeholder: '#606B62',
  sage: '#7C8F78',
  clay: '#B47B5A',
} as const;

export const radii = { sm: 10, md: 16, lg: 22, xl: 30, pill: 999 } as const;
export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40 } as const;

export const shadow = Platform.OS === 'web'
  ? { boxShadow: '0 12px 34px rgba(35,56,45,0.12)' } as const
  : {
      shadowColor: '#1D3328',
      shadowOpacity: 0.13,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 5,
    } as const;

export const softShadow = Platform.OS === 'web'
  ? { boxShadow: '0 5px 18px rgba(35,56,45,0.08)' } as const
  : {
      shadowColor: '#1D3328',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 2,
    } as const;

export const font = {
  display: 'PlayfairDisplay_600SemiBold',
  displayMedium: 'PlayfairDisplay_500Medium',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;
