import React, { createContext, useContext, useState } from 'react';
import { SanctuaryColors } from './theme';

interface ThemeContextType {
  colors: typeof SanctuaryColors;
  themeName: 'sanctuary';
}

const defaultCtx: ThemeContextType = {
  colors: SanctuaryColors,
  themeName: 'sanctuary',
};

export const ThemeContext = createContext<ThemeContextType>(defaultCtx);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [colors] = useState(SanctuaryColors);

  return (
    <ThemeContext.Provider value={{ colors, themeName: 'sanctuary' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
