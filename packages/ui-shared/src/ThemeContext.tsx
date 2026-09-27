import React, { createContext, useContext, useState } from 'react';
import { SajiwaColors } from './theme';

interface ThemeContextType {
  colors: typeof SajiwaColors;
  themeName: 'sajiwa';
}

const defaultCtx: ThemeContextType = {
  colors: SajiwaColors,
  themeName: 'sajiwa',
};

export const ThemeContext = createContext<ThemeContextType>(defaultCtx);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [colors] = useState(SajiwaColors);

  return (
    <ThemeContext.Provider value={{ colors, themeName: 'sajiwa' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
