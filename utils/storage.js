/**
 * Storage and Settings Management for Smart Context Menu Extension
 */

export const DEFAULT_RULES = [
  {
    id: 'vat_10',
    name: 'Add 10% Tax / VAT',
    formula: 'x * 1.10',
    prefix: '$',
    suffix: '',
    decimals: 2,
    useThousands: true,
    enabled: true
  },
  {
    id: 'discount_20',
    name: '20% Off (Discount)',
    formula: 'x * 0.80',
    prefix: '$',
    suffix: '',
    decimals: 2,
    useThousands: true,
    enabled: true
  },
  {
    id: 'tip_18',
    name: '18% Tip',
    formula: 'x * 0.18',
    prefix: '$',
    suffix: '',
    decimals: 2,
    useThousands: true,
    enabled: true
  },
  {
    id: 'currency_eur',
    name: 'USD → EUR',
    formula: 'x * 0.92',
    prefix: '€',
    suffix: '',
    decimals: 2,
    useThousands: true,
    enabled: false
  },
  {
    id: 'double_val',
    name: 'Double (2x)',
    formula: 'x * 2',
    prefix: '',
    suffix: '',
    decimals: 'auto',
    useThousands: true,
    enabled: false
  },
  {
    id: 'half_val',
    name: 'Half (÷2)',
    formula: 'x / 2',
    prefix: '',
    suffix: '',
    decimals: 'auto',
    useThousands: true,
    enabled: false
  },
  {
    id: 'eval_direct',
    name: 'Evaluate Math Expression',
    formula: 'x',
    prefix: '=',
    suffix: '',
    decimals: 'auto',
    useThousands: true,
    enabled: true
  }
];

export const PRESET_LIBRARY = [
  {
    category: 'Taxes & Tips',
    presets: [
      { name: 'Add 5% Sales Tax', formula: 'x * 1.05', prefix: '$', decimals: 2 },
      { name: 'Add 10% VAT / GST', formula: 'x * 1.10', prefix: '$', decimals: 2 },
      { name: 'Add 15% Tip', formula: 'x * 0.15', prefix: '$', decimals: 2 },
      { name: 'Add 20% Tip', formula: 'x * 0.20', prefix: '$', decimals: 2 },
      { name: 'Total + 18% Tip', formula: 'x * 1.18', prefix: '$', decimals: 2 },
    ]
  },
  {
    category: 'Discounts & Sales',
    presets: [
      { name: '10% Off', formula: 'x * 0.90', prefix: '$', decimals: 2 },
      { name: '20% Off', formula: 'x * 0.80', prefix: '$', decimals: 2 },
      { name: '25% Off', formula: 'x * 0.75', prefix: '$', decimals: 2 },
      { name: '50% Off (Half Price)', formula: 'x * 0.50', prefix: '$', decimals: 2 },
      { name: 'Calculate 30% Savings', formula: 'x * 0.30', prefix: '$', decimals: 2 }
    ]
  },
  {
    category: 'Unit & Currency Conversions',
    presets: [
      { name: 'USD to EUR', formula: 'x * 0.92', prefix: '€', decimals: 2 },
      { name: 'EUR to USD', formula: 'x * 1.09', prefix: '$', decimals: 2 },
      { name: 'Kilograms to Pounds (kg → lbs)', formula: 'x * 2.20462', suffix: 'lbs', decimals: 2 },
      { name: 'Pounds to Kilograms (lbs → kg)', formula: 'x / 2.20462', suffix: 'kg', decimals: 2 },
      { name: 'Miles to Kilometers (mi → km)', formula: 'x * 1.60934', suffix: 'km', decimals: 2 },
      { name: 'Fahrenheit to Celsius (°F → °C)', formula: '(x - 32) * 5 / 9', suffix: '°C', decimals: 1 },
      { name: 'Celsius to Fahrenheit (°C → °F)', formula: 'x * 9 / 5 + 32', suffix: '°F', decimals: 1 }
    ]
  },
  {
    category: 'Developer & Math',
    presets: [
      { name: 'Pixels to REM (base 16)', formula: 'x / 16', suffix: 'rem', decimals: 3 },
      { name: 'REM to Pixels (base 16)', formula: 'x * 16', suffix: 'px', decimals: 1 },
      { name: 'Square Root (√x)', formula: 'sqrt(x)', decimals: 3 },
      { name: 'Squared (x²)', formula: 'x ^ 2', decimals: 'auto' },
      { name: 'Calculate Percentage (x / 100)', formula: 'x / 100', suffix: '', decimals: 4 }
    ]
  }
];

export const COLOR_STYLES = [
  { id: 'indigo', name: 'Electric Indigo', hex: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1, #a855f7)' },
  { id: 'cyan', name: 'Cyber Cyan', hex: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)' },
  { id: 'emerald', name: 'Emerald Jade', hex: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #059669)' },
  { id: 'purple', name: 'Neon Purple', hex: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #ec4899)' },
  { id: 'amber', name: 'Sunset Amber', hex: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)' },
  { id: 'rose', name: 'Crimson Rose', hex: '#f43f5e', gradient: 'linear-gradient(135deg, #f43f5e, #be123c)' },
  { id: 'mono', name: 'Minimal Mono', hex: '#94a3b8', gradient: 'linear-gradient(135deg, #cbd5e1, #64748b)' }
];

export const DEFAULT_SETTINGS = {
  menuMode: 'submenu', // 'submenu' or 'root'
  colorStyle: 'indigo', // 'indigo', 'cyan', 'emerald', 'purple', 'amber', 'rose', 'mono'
  appearanceMode: 'dark', // 'dark', 'midnight', 'light'
  copyOnClick: true,
  showToast: true,
  replaceSelection: false,
  toastDuration: 2500,
  toastTheme: 'modern-dark', // 'modern-dark', 'glass', 'neon'
  rules: DEFAULT_RULES
};

const STORAGE_KEY = 'smart_context_settings';

// Load settings from chrome.storage with fallback
export async function getSettings() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    try {
      const data = await chrome.storage.sync.get(STORAGE_KEY);
      if (data && data[STORAGE_KEY]) {
        return {
          ...DEFAULT_SETTINGS,
          ...data[STORAGE_KEY],
          rules: Array.isArray(data[STORAGE_KEY].rules) ? data[STORAGE_KEY].rules : DEFAULT_RULES
        };
      }
    } catch (e) {
      console.warn('Error reading from chrome.storage.sync:', e);
    }
  }

  // Fallback to localStorage if in options test or fallback mode
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    // ignore
  }

  return DEFAULT_SETTINGS;
}

// Save settings to chrome.storage
export async function saveSettings(settings) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...settings
  };

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: merged });
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (e) {
    // ignore
  }

  return merged;
}

// Helper to generate unique rule ID
export function generateRuleId() {
  return 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}
