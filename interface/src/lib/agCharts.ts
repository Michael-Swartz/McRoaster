// AG Charts module registration
// This must be imported before using AgCharts components

if (typeof window !== 'undefined') {
  // Import all community modules to auto-register them
  import('ag-charts-community');
}

export {}; // Make this a module
