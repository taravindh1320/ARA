import { themeQuartz, colorSchemeDark } from 'ag-grid-community';

/**
 * Shared AG Grid v35 theme for all ARA grid screens.
 * Uses the new theme API introduced in AG Grid v33.
 */
export const araGridTheme = themeQuartz
  .withPart(colorSchemeDark)
  .withParams({
    // Colors
    backgroundColor:              '#111d2c',
    chromeBackgroundColor:        '#152236',
    oddRowBackgroundColor:        '#111d2c',
    rowHoverColor:                '#1a2c44',
    selectedRowBackgroundColor:   'rgba(0, 196, 179, 0.10)',
    foregroundColor:              '#dde8f5',
    borderColor:                  '#18304e',
    cellTextColor:                '#dde8f5',

    // Range selection
    rangeSelectionBorderColor:    'rgba(0, 196, 179, 0.45)',

    // Structure
    rowBorder:                    { style: 'solid', width: 1, color: '#18304e' },
    wrapperBorder:                false,
    columnBorder:                 false,
    headerColumnResizeHandleColor: '#1f4068',

    // Sizing
    rowHeight:                    36,
    headerHeight:                 38,
    cellHorizontalPadding:        10,
    cellHorizontalPaddingScale:   1,
    fontFamily:                   { googleFont: 'Inter' },
    fontSize:                     12,
  });
