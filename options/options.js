/**
 * Settings / Options Page Logic for Smart Math Context Menu
 */

import { extractNumberOrExpression, applyRuleToNumber } from '../utils/math-parser.js';
import {
  getSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  DEFAULT_RULES,
  PRESET_LIBRARY,
  COLOR_STYLES,
  generateRuleId
} from '../utils/storage.js';

let currentSettings = { ...DEFAULT_SETTINGS };
let editingRuleId = null;

// DOM Elements
const testInput = document.getElementById('test-input');
const testClearBtn = document.getElementById('test-clear-btn');
const simMenuPreview = document.getElementById('sim-menu-preview');
const rulesContainer = document.getElementById('rules-container');
const rulesCountSpan = document.getElementById('rules-count');
const activeRulesCountSpan = document.getElementById('active-rules-count');
const addRuleBtn = document.getElementById('add-rule-btn');
const resetRulesBtn = document.getElementById('reset-rules-btn');
const quickPresetBtn = document.getElementById('quick-preset-btn');
const presetCategoriesContainer = document.getElementById('preset-categories-container');

// General preferences DOM
const colorSwatchesContainer = document.getElementById('color-swatches-container');
const appearanceModeRadios = document.querySelectorAll('input[name="appearanceMode"]');
const menuModeRadios = document.querySelectorAll('input[name="menuMode"]');
const copyOnClickToggle = document.getElementById('setting-copyOnClick');
const showToastToggle = document.getElementById('setting-showToast');
const replaceSelectionToggle = document.getElementById('setting-replaceSelection');
const toastThemeSelect = document.getElementById('setting-toastTheme');
const toastDurationRange = document.getElementById('setting-toastDuration');
const toastDurationLabel = document.getElementById('toast-duration-label');
const exportBtn = document.getElementById('export-btn');
const importFileInput = document.getElementById('import-file');

// Modal Elements
const ruleModal = document.getElementById('rule-modal');
const modalTitle = document.getElementById('modal-title');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const ruleForm = document.getElementById('rule-form');
const formRuleId = document.getElementById('form-rule-id');
const formRuleName = document.getElementById('form-rule-name');
const formRuleFormula = document.getElementById('form-rule-formula');
const formRulePrefix = document.getElementById('form-rule-prefix');
const formRuleSuffix = document.getElementById('form-rule-suffix');
const formRuleDecimals = document.getElementById('form-rule-decimals');
const formRuleThousands = document.getElementById('form-rule-thousands');
const modalTestResult = document.getElementById('modal-test-result');
const settingsToast = document.getElementById('settings-toast');

// Navigation Tabs
const navButtons = document.querySelectorAll('.nav-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');

const tabMeta = {
  'rules-tab': {
    title: 'Custom Math Rules',
    subtitle: 'Configure the math formulas and conversions shown when you right-click selected numbers.'
  },
  'presets-tab': {
    title: 'Preset Formulas Library',
    subtitle: 'Pick popular pre-made financial, unit, and scientific conversions.'
  },
  'settings-tab': {
    title: 'General Preferences',
    subtitle: 'Customize right-click menu placement, notifications, and click behaviors.'
  },
  'help-tab': {
    title: 'Syntax & Formula Guide',
    subtitle: 'Learn how to write algebraic equations and use supported math functions.'
  }
};

// Initialize
async function initOptions() {
  setupNavigation();
  setupEventListeners();
  renderPresetsLibrary();
  await loadAndRender();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOptions);
} else {
  initOptions();
}

// Setup sidebar tab navigation
function setupNavigation() {
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      navButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const pane = document.getElementById(targetTab);
      if (pane) pane.classList.add('active');

      if (tabMeta[targetTab]) {
        pageTitle.textContent = tabMeta[targetTab].title;
        pageSubtitle.textContent = tabMeta[targetTab].subtitle;
      }
    });
  });
}

// Setup Event Listeners
function setupEventListeners() {
  // Test input updates
  testInput.addEventListener('input', () => {
    updateSimulatorPreview();
    updateRuleCardsPreviews();
  });

  testClearBtn.addEventListener('click', () => {
    testInput.value = '';
    testInput.focus();
    updateSimulatorPreview();
    updateRuleCardsPreviews();
  });

  // Modal actions
  addRuleBtn.addEventListener('click', () => openRuleModal());
  modalCloseBtn.addEventListener('click', closeRuleModal);
  modalCancelBtn.addEventListener('click', closeRuleModal);

  ruleModal.addEventListener('click', (e) => {
    if (e.target === ruleModal) closeRuleModal();
  });

  // Form input live test in modal
  [formRuleFormula, formRulePrefix, formRuleSuffix, formRuleDecimals, formRuleThousands].forEach(el => {
    el.addEventListener('input', updateModalPreview);
    el.addEventListener('change', updateModalPreview);
  });

  // Save rule form
  ruleForm.addEventListener('submit', handleSaveRule);

  // Reset rules button
  resetRulesBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all rules to defaults? Custom rules will be replaced.')) {
      currentSettings.rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
      await persistSettings('Reset to default rules');
      renderRulesList();
      updateSimulatorPreview();
    }
  });

  // Quick preset button
  quickPresetBtn.addEventListener('click', () => {
    const presetNavBtn = document.querySelector('.nav-btn[data-tab="presets-tab"]');
    if (presetNavBtn) presetNavBtn.click();
  });

  // Appearance mode radio changes
  appearanceModeRadios.forEach(radio => {
    radio.addEventListener('change', async (e) => {
      if (e.target.checked) {
        currentSettings.appearanceMode = e.target.value;
        document.documentElement.setAttribute('data-appearance', e.target.value);
        await persistSettings(`Appearance set to ${e.target.value}`);
      }
    });
  });

  // Preferences changes
  menuModeRadios.forEach(radio => {
    radio.addEventListener('change', async (e) => {
      if (e.target.checked) {
        currentSettings.menuMode = e.target.value;
        await persistSettings('Menu mode updated');
        updateSimulatorPreview();
      }
    });
  });

  copyOnClickToggle.addEventListener('change', async (e) => {
    currentSettings.copyOnClick = e.target.checked;
    await persistSettings('Click behavior updated');
  });

  showToastToggle.addEventListener('change', async (e) => {
    currentSettings.showToast = e.target.checked;
    await persistSettings('Toast setting updated');
  });

  replaceSelectionToggle.addEventListener('change', async (e) => {
    currentSettings.replaceSelection = e.target.checked;
    await persistSettings('Replace selection setting updated');
  });

  toastThemeSelect.addEventListener('change', async (e) => {
    currentSettings.toastTheme = e.target.value;
    await persistSettings('Toast theme updated');
  });

  toastDurationRange.addEventListener('input', (e) => {
    const sec = (parseInt(e.target.value, 10) / 1000).toFixed(1);
    toastDurationLabel.textContent = `${sec}s`;
  });

  toastDurationRange.addEventListener('change', async (e) => {
    currentSettings.toastDuration = parseInt(e.target.value, 10);
    await persistSettings('Toast duration updated');
  });

  // Export / Import
  exportBtn.addEventListener('click', handleExport);
  importFileInput.addEventListener('change', handleImport);
}

// Render interactive color swatches in Settings
function renderColorSwatches() {
  if (!colorSwatchesContainer) return;
  colorSwatchesContainer.innerHTML = '';

  const activeColor = currentSettings.colorStyle || 'indigo';

  COLOR_STYLES.forEach(color => {
    const card = document.createElement('div');
    card.className = `swatch-card ${color.id === activeColor ? 'active' : ''}`;
    card.setAttribute('data-color-id', color.id);
    card.title = `Select ${color.name}`;

    card.innerHTML = `
      <div class="swatch-circle" style="background: ${color.gradient || color.hex};"></div>
      <span class="swatch-name">${escapeHtml(color.name)}</span>
    `;

    card.addEventListener('click', async () => {
      currentSettings.colorStyle = color.id;
      document.documentElement.setAttribute('data-color-style', color.id);

      // Update active state in UI
      colorSwatchesContainer.querySelectorAll('.swatch-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      await persistSettings(`Color style changed to ${color.name}`);
    });

    colorSwatchesContainer.appendChild(card);
  });
}

// Load settings from storage
async function loadAndRender() {
  currentSettings = await getSettings();

  // Apply color style and appearance to page root
  const activeColor = currentSettings.colorStyle || 'indigo';
  const activeAppearance = currentSettings.appearanceMode || 'dark';
  document.documentElement.setAttribute('data-color-style', activeColor);
  document.documentElement.setAttribute('data-appearance', activeAppearance);

  // Render color swatches
  renderColorSwatches();

  // Populate appearance mode
  appearanceModeRadios.forEach(radio => {
    radio.checked = radio.value === activeAppearance;
  });

  // Populate preferences tab
  menuModeRadios.forEach(radio => {
    radio.checked = radio.value === (currentSettings.menuMode || 'submenu');
  });
  copyOnClickToggle.checked = currentSettings.copyOnClick !== false;
  showToastToggle.checked = currentSettings.showToast !== false;
  replaceSelectionToggle.checked = currentSettings.replaceSelection === true;
  toastThemeSelect.value = currentSettings.toastTheme || 'modern-dark';
  toastDurationRange.value = currentSettings.toastDuration || 2500;
  toastDurationLabel.textContent = `${((currentSettings.toastDuration || 2500) / 1000).toFixed(1)}s`;

  renderRulesList();
  updateSimulatorPreview();
}

// Render the rules list in tab 1
function renderRulesList() {
  rulesContainer.innerHTML = '';
  const rules = currentSettings.rules || [];

  const enabledCount = rules.filter(r => r.enabled).length;
  rulesCountSpan.textContent = rules.length;
  activeRulesCountSpan.textContent = enabledCount;

  if (rules.length === 0) {
    rulesContainer.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md);">
        <p style="font-size: 15px; margin-bottom: 12px;">No math rules configured yet.</p>
        <button id="empty-add-btn" class="btn btn-primary btn-sm">Add Your First Rule</button>
      </div>
    `;
    document.getElementById('empty-add-btn')?.addEventListener('click', () => openRuleModal());
    return;
  }

  const rawTest = testInput.value.trim() || '100';
  const extract = extractNumberOrExpression(rawTest);
  const testNum = extract && extract.isValid ? extract.number : 100;

  rules.forEach((rule, index) => {
    const card = document.createElement('div');
    card.className = `rule-card ${rule.enabled ? '' : 'disabled'}`;
    card.setAttribute('data-id', rule.id);

    const testRes = applyRuleToNumber(rule, testNum, rawTest);

    card.innerHTML = `
      <div class="rule-card-left">
        <div class="rule-order-controls">
          <button class="order-btn up-btn" title="Move Up" ${index === 0 ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="18 15 12 9 6 15" stroke-width="2.5"></polyline></svg>
          </button>
          <button class="order-btn down-btn" title="Move Down" ${index === rules.length - 1 ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="6 9 12 15 18 9" stroke-width="2.5"></polyline></svg>
          </button>
        </div>

        <div class="rule-main-info">
          <div class="rule-title-row">
            <span class="rule-name">${escapeHtml(rule.name)}</span>
            <span class="rule-formula-badge">${escapeHtml(rule.formula)}</span>
          </div>
          <div class="rule-meta-row">
            <span>Result: <span class="rule-preview-result" id="preview-${rule.id}">${testRes.formatted}</span></span>
            ${rule.prefix ? `<span>Prefix: "<code>${escapeHtml(rule.prefix)}</code>"</span>` : ''}
            ${rule.suffix ? `<span>Suffix: "<code>${escapeHtml(rule.suffix)}</code>"</span>` : ''}
            <span>Decimals: ${rule.decimals}</span>
          </div>
        </div>
      </div>

      <div class="rule-card-right">
        <div class="rule-actions">
          <button class="action-icon-btn edit-btn" title="Edit Rule">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke-width="2"></path></svg>
          </button>
          <button class="action-icon-btn duplicate-btn" title="Duplicate Rule">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" stroke-width="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke-width="2"></path></svg>
          </button>
          <button class="action-icon-btn delete-btn" title="Delete Rule">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6" stroke-width="2"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke-width="2"></path></svg>
          </button>
        </div>

        <label class="switch" title="Toggle Enabled / Disabled">
          <input type="checkbox" class="toggle-rule-btn" ${rule.enabled ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
    `;

    // Hook up card buttons
    card.querySelector('.up-btn')?.addEventListener('click', () => moveRule(index, -1));
    card.querySelector('.down-btn')?.addEventListener('click', () => moveRule(index, 1));
    card.querySelector('.edit-btn')?.addEventListener('click', () => openRuleModal(rule));
    card.querySelector('.duplicate-btn')?.addEventListener('click', () => duplicateRule(rule));
    card.querySelector('.delete-btn')?.addEventListener('click', () => deleteRule(rule.id));
    card.querySelector('.toggle-rule-btn')?.addEventListener('change', (e) => toggleRule(rule.id, e.target.checked));

    rulesContainer.appendChild(card);
  });
}

// Update the result badges on rule cards
function updateRuleCardsPreviews() {
  const rawTest = testInput.value.trim() || '100';
  const extract = extractNumberOrExpression(rawTest);
  const testNum = extract && extract.isValid ? extract.number : 100;

  (currentSettings.rules || []).forEach(rule => {
    const el = document.getElementById(`preview-${rule.id}`);
    if (el) {
      const res = applyRuleToNumber(rule, testNum, rawTest);
      el.textContent = res.formatted;
    }
  });
}

// Update live context menu simulator
function updateSimulatorPreview() {
  const rawTest = testInput.value.trim() || '100';
  const extract = extractNumberOrExpression(rawTest);
  const testNum = extract && extract.isValid ? extract.number : 100;
  const menuMode = currentSettings.menuMode || 'submenu';
  const rules = (currentSettings.rules || []).filter(r => r.enabled);

  simMenuPreview.innerHTML = '';

  if (rules.length === 0) {
    simMenuPreview.innerHTML = `
      <div class="sim-menu-item" style="color: var(--text-muted);">
        <span>⚙️ No active rules. Enable or add rules below.</span>
      </div>
    `;
    return;
  }

  if (menuMode === 'submenu') {
    // Parent item
    const parent = document.createElement('div');
    parent.className = 'sim-menu-item sim-menu-parent';
    parent.innerHTML = `
      <span class="item-title">🧮 Custom Math (${testNum})</span>
      <span style="font-size: 10px;">▶</span>
    `;
    simMenuPreview.appendChild(parent);

    // Child items
    const subContainer = document.createElement('div');
    subContainer.className = 'sim-menu-sub';

    rules.forEach(rule => {
      const res = applyRuleToNumber(rule, testNum, rawTest);
      const item = document.createElement('div');
      item.className = 'sim-menu-item';
      item.innerHTML = `
        <span class="item-title">${escapeHtml(rule.name)}:</span>
        <span class="item-result">${res.formatted}</span>
      `;
      item.addEventListener('click', () => {
        showToastNotice(`Simulated click: Copied "${res.formatted}" to clipboard!`);
      });
      subContainer.appendChild(item);
    });

    const sep = document.createElement('div');
    sep.className = 'sim-menu-separator';
    subContainer.appendChild(sep);

    const settingsItem = document.createElement('div');
    settingsItem.className = 'sim-menu-item';
    settingsItem.style.color = '#94a3b8';
    settingsItem.innerHTML = `<span>⚙️ Math Settings...</span>`;
    subContainer.appendChild(settingsItem);

    simMenuPreview.appendChild(subContainer);
  } else {
    // Root mode
    rules.forEach(rule => {
      const res = applyRuleToNumber(rule, testNum, rawTest);
      const item = document.createElement('div');
      item.className = 'sim-menu-item';
      item.innerHTML = `
        <span class="item-title">🧮 ${escapeHtml(rule.name)}:</span>
        <span class="item-result">${res.formatted}</span>
      `;
      item.addEventListener('click', () => {
        showToastNotice(`Simulated click: Copied "${res.formatted}" to clipboard!`);
      });
      simMenuPreview.appendChild(item);
    });

    const sep = document.createElement('div');
    sep.className = 'sim-menu-separator';
    simMenuPreview.appendChild(sep);

    const settingsItem = document.createElement('div');
    settingsItem.className = 'sim-menu-item';
    settingsItem.style.color = '#94a3b8';
    settingsItem.innerHTML = `<span>⚙️ Math Settings...</span>`;
    simMenuPreview.appendChild(settingsItem);
  }
}

// Move rule up or down in the array
async function moveRule(index, direction) {
  const newIndex = index + direction;
  const rules = currentSettings.rules;
  if (newIndex < 0 || newIndex >= rules.length) return;

  const [moved] = rules.splice(index, 1);
  rules.splice(newIndex, 0, moved);

  await persistSettings('Rules reordered');
  renderRulesList();
  updateSimulatorPreview();
}

// Toggle enabled status of a rule
async function toggleRule(ruleId, isEnabled) {
  const rule = currentSettings.rules.find(r => r.id === ruleId);
  if (rule) {
    rule.enabled = isEnabled;
    await persistSettings(`Rule ${isEnabled ? 'enabled' : 'disabled'}`);
    renderRulesList();
    updateSimulatorPreview();
  }
}

// Duplicate an existing rule
async function duplicateRule(rule) {
  const newRule = {
    ...rule,
    id: generateRuleId(),
    name: `${rule.name} (Copy)`
  };
  currentSettings.rules.push(newRule);
  await persistSettings(`Duplicated "${rule.name}"`);
  renderRulesList();
  updateSimulatorPreview();
}

// Delete a rule
async function deleteRule(ruleId) {
  const rule = currentSettings.rules.find(r => r.id === ruleId);
  if (!rule) return;

  if (confirm(`Are you sure you want to delete the rule "${rule.name}"?`)) {
    currentSettings.rules = currentSettings.rules.filter(r => r.id !== ruleId);
    await persistSettings(`Deleted rule "${rule.name}"`);
    renderRulesList();
    updateSimulatorPreview();
  }
}

// Open modal for add or edit
function openRuleModal(rule = null) {
  editingRuleId = rule ? rule.id : null;
  modalTitle.textContent = rule ? 'Edit Math Rule' : 'Add Math Rule';

  formRuleId.value = rule ? rule.id : '';
  formRuleName.value = rule ? rule.name : '';
  formRuleFormula.value = rule ? rule.formula : 'x * 1.10';
  formRulePrefix.value = rule ? (rule.prefix || '') : '';
  formRuleSuffix.value = rule ? (rule.suffix || '') : '';
  formRuleDecimals.value = rule ? (rule.decimals !== undefined ? rule.decimals : '2') : '2';
  formRuleThousands.checked = rule ? (rule.useThousands !== false) : true;

  updateModalPreview();
  ruleModal.classList.remove('hidden');
  formRuleName.focus();
}

// Close modal
function closeRuleModal() {
  ruleModal.classList.add('hidden');
  editingRuleId = null;
  ruleForm.reset();
}

// Live preview inside the modal
function updateModalPreview() {
  const dummyRule = {
    formula: formRuleFormula.value.trim() || 'x',
    prefix: formRulePrefix.value,
    suffix: formRuleSuffix.value,
    decimals: formRuleDecimals.value,
    useThousands: formRuleThousands.checked
  };

  const res = applyRuleToNumber(dummyRule, 100);
  if (res.success) {
    modalTestResult.textContent = res.formatted;
    modalTestResult.style.color = 'var(--accent-green)';
  } else {
    modalTestResult.textContent = res.formatted;
    modalTestResult.style.color = 'var(--accent-red)';
  }
}

// Handle save rule form submission
async function handleSaveRule(e) {
  e.preventDefault();

  const name = formRuleName.value.trim();
  const formula = formRuleFormula.value.trim();
  const prefix = formRulePrefix.value.trim();
  const suffix = formRuleSuffix.value.trim();
  const decimals = formRuleDecimals.value;
  const useThousands = formRuleThousands.checked;

  if (!name || !formula) {
    alert('Please enter both a name and a formula.');
    return;
  }

  // Validate formula with x=100
  const validation = applyRuleToNumber({ formula, decimals, prefix, suffix, useThousands }, 100);
  if (!validation.success) {
    alert(`Invalid formula: ${validation.error}`);
    return;
  }

  if (editingRuleId) {
    // Update existing rule
    const index = currentSettings.rules.findIndex(r => r.id === editingRuleId);
    if (index !== -1) {
      currentSettings.rules[index] = {
        ...currentSettings.rules[index],
        name,
        formula,
        prefix,
        suffix,
        decimals,
        useThousands
      };
    }
  } else {
    // Add new rule
    const newRule = {
      id: generateRuleId(),
      name,
      formula,
      prefix,
      suffix,
      decimals,
      useThousands,
      enabled: true
    };
    currentSettings.rules.push(newRule);
  }

  await persistSettings(editingRuleId ? 'Rule updated' : 'New rule created');
  closeRuleModal();
  renderRulesList();
  updateSimulatorPreview();
}

// Render Presets Tab
function renderPresetsLibrary() {
  presetCategoriesContainer.innerHTML = '';

  PRESET_LIBRARY.forEach(cat => {
    const block = document.createElement('div');
    block.className = 'preset-category-block';

    block.innerHTML = `
      <div class="preset-category-title">
        <span>${escapeHtml(cat.category)}</span>
      </div>
      <div class="preset-cards-grid"></div>
    `;

    const grid = block.querySelector('.preset-cards-grid');

    cat.presets.forEach(p => {
      const card = document.createElement('div');
      card.className = 'preset-card';

      card.innerHTML = `
        <div>
          <div class="preset-card-title">${escapeHtml(p.name)}</div>
          <div class="preset-card-formula">${escapeHtml(p.formula)}</div>
        </div>
        <div class="preset-card-actions">
          <button class="btn btn-primary btn-sm add-preset-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:14px;height:14px;"><line x1="12" y1="5" x2="12" y2="19" stroke-width="2"/><line x1="5" y1="12" x2="19" y2="12" stroke-width="2"/></svg>
            Add Rule
          </button>
        </div>
      `;

      card.querySelector('.add-preset-btn').addEventListener('click', async () => {
        const newRule = {
          id: generateRuleId(),
          name: p.name,
          formula: p.formula,
          prefix: p.prefix || '',
          suffix: p.suffix || '',
          decimals: p.decimals !== undefined ? p.decimals : 2,
          useThousands: true,
          enabled: true
        };
        currentSettings.rules.push(newRule);
        await persistSettings(`Added preset "${p.name}"`);
        renderRulesList();
        updateSimulatorPreview();
        showToastNotice(`Added "${p.name}" to your rules!`);
      });

      grid.appendChild(card);
    });

    presetCategoriesContainer.appendChild(block);
  });
}

// Save settings to chrome.storage and notify background script
async function persistSettings(noticeMessage = '') {
  await saveSettings(currentSettings);

  // Notify background service worker to update context menus immediately
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ type: 'REBUILD_MENUS' }).catch(() => {});
  }

  if (noticeMessage) {
    showToastNotice(noticeMessage);
  }
}

// Show small notification toast on options page
let toastTimer = null;
function showToastNotice(msg) {
  clearTimeout(toastTimer);
  settingsToast.textContent = msg;
  settingsToast.classList.remove('hidden');

  toastTimer = setTimeout(() => {
    settingsToast.classList.add('hidden');
  }, 2200);
}

// Export settings as JSON
function handleExport() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentSettings, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', 'smart-math-settings.json');
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToastNotice('Settings exported successfully!');
}

// Import settings from JSON
function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      if (imported && Array.isArray(imported.rules)) {
        currentSettings = {
          ...DEFAULT_SETTINGS,
          ...imported
        };
        await persistSettings('Settings imported successfully!');
        await loadAndRender();
        showToastNotice('Settings imported and active!');
      } else {
        alert('Invalid configuration file format.');
      }
    } catch (err) {
      alert('Error parsing JSON file: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
