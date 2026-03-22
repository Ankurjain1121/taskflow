import { THEME_PALETTES, DARK_THEME_PALETTES } from '../../../core/constants/color-palettes';
import { LightTheme, DarkTheme } from '../../../shared/types/theme.types';
import { ThemeService } from '../../../core/services/theme.service';
import { CommandAction } from './command-palette.component';

/**
 * Builds command palette actions for switching light and dark themes.
 */
export function buildThemeActions(themeService: ThemeService): CommandAction[] {
  const lightActions: CommandAction[] = Object.entries(THEME_PALETTES).map(
    ([id, palette]) => ({
      id: `theme-light-${id}`,
      icon: 'sun',
      label: `Theme: ${palette.name} (Light)`,
      action: () => themeService.setLightTheme(id as LightTheme),
    }),
  );
  const darkActions: CommandAction[] = Object.entries(DARK_THEME_PALETTES).map(
    ([id, palette]) => ({
      id: `theme-dark-${id}`,
      icon: 'moon',
      label: `Theme: ${palette.name} (Dark)`,
      action: () => themeService.setDarkTheme(id as DarkTheme),
    }),
  );
  return [...lightActions, ...darkActions];
}
