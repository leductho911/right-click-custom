/**
 * Background Service Worker for Smart Context Menu
 * Handles context menu creation, dynamic title updates based on selected text, and click actions.
 */

import { extractNumberOrExpression, applyRuleToNumber } from './utils/math-parser.js';
import { getSettings, DEFAULT_SETTINGS } from './utils/storage.js';

// Cache of current calculations for quick retrieval on click
let currentCalculations = {};
let lastSelectionText = '';

// Rebuild queue lock to prevent concurrent context menu creation races
let isRebuilding = false;
let pendingRebuild = false;

// Safe wrapper for chrome.contextMenus.create that prevents Unchecked runtime.lastError
function safeCreateMenu(options) {
  return new Promise((resolve) => {
    try {
      chrome.contextMenus.create(options, () => {
        if (chrome.runtime.lastError) {
          // Handled gracefully without raising an Unchecked runtime.lastError
        }
        resolve();
      });
    } catch (e) {
      resolve();
    }
  });
}

// Safe wrapper for chrome.contextMenus.update
function safeUpdateMenu(id, options) {
  try {
    chrome.contextMenus.update(id, options, () => {
      if (chrome.runtime.lastError) {
        // Handled gracefully
      }
    });
  } catch (e) {}
}

// Safe wrapper for chrome.contextMenus.removeAll
function safeRemoveAllMenus() {
  return new Promise((resolve) => {
    try {
      chrome.contextMenus.removeAll(() => {
        if (chrome.runtime.lastError) {
          // Handled gracefully
        }
        resolve();
      });
    } catch (e) {
      resolve();
    }
  });
}

// Rebuild context menus from saved settings with mutex protection
async function rebuildContextMenu() {
  if (isRebuilding) {
    pendingRebuild = true;
    return;
  }
  isRebuilding = true;

  try {
    await safeRemoveAllMenus();

    const settings = await getSettings();
    const rules = (settings.rules || []).filter(r => r.enabled);
    const menuMode = settings.menuMode || 'submenu';

    if (rules.length === 0) {
      await safeCreateMenu({
        id: 'no_rules_info',
        title: '⚙️ Configure Math Rules in Settings',
        contexts: ['selection']
      });
      return;
    }

    if (menuMode === 'submenu') {
      // Create parent menu item
      await safeCreateMenu({
        id: 'parent_math_root',
        title: '🧮 Custom Math',
        contexts: ['selection']
      });

      // Create child items for each enabled rule
      for (const rule of rules) {
        await safeCreateMenu({
          id: rule.id,
          parentId: 'parent_math_root',
          title: rule.name,
          contexts: ['selection']
        });
      }

      // Add separator and settings shortcut
      await safeCreateMenu({
        id: 'separator_settings',
        parentId: 'parent_math_root',
        type: 'separator',
        contexts: ['selection']
      });

      await safeCreateMenu({
        id: 'open_settings_menu',
        parentId: 'parent_math_root',
        title: '⚙️ Settings & Custom Formulas...',
        contexts: ['selection']
      });
    } else {
      // Root mode: display active items directly in the context menu
      for (const rule of rules) {
        await safeCreateMenu({
          id: rule.id,
          title: `🧮 ${rule.name}`,
          contexts: ['selection']
        });
      }

      await safeCreateMenu({
        id: 'open_settings_menu',
        title: '⚙️ Math Settings...',
        contexts: ['selection']
      });
    }

    // If we have a cached selection, update titles immediately
    if (lastSelectionText) {
      await updateMenuTitlesForText(lastSelectionText);
    }
  } catch (error) {
    console.error('Failed to rebuild context menu:', error);
  } finally {
    isRebuilding = false;
    if (pendingRebuild) {
      pendingRebuild = false;
      await rebuildContextMenu();
    }
  }
}

// Update context menu item titles with the evaluated math results
async function updateMenuTitlesForText(rawText) {
  if (!rawText) return;
  lastSelectionText = rawText;

  const extract = extractNumberOrExpression(rawText);
  if (!extract || !extract.isValid) {
    // Reset to default titles
    await resetMenuTitles();
    return;
  }

  const settings = await getSettings();
  const rules = (settings.rules || []).filter(r => r.enabled);
  const menuMode = settings.menuMode || 'submenu';

  currentCalculations = {};

  // If in submenu mode, update parent menu title with input preview
  if (menuMode === 'submenu') {
    const previewNum = extract.number !== null ? extract.number : extract.cleaned;
    safeUpdateMenu('parent_math_root', {
      title: `🧮 Math (${previewNum})`
    });
  }

  // Update each rule item with the calculated result
  for (const rule of rules) {
    const res = applyRuleToNumber(rule, extract.number, rawText);
    currentCalculations[rule.id] = {
      rule: rule,
      input: extract.number,
      result: res.value,
      formatted: res.formatted,
      success: res.success,
      error: res.error
    };

    const prefix = menuMode === 'root' ? '🧮 ' : '';
    let itemTitle = '';

    if (res.success) {
      itemTitle = `${prefix}${rule.name}: ${res.formatted}`;
    } else {
      itemTitle = `${prefix}${rule.name}: (Error)`;
    }

    safeUpdateMenu(rule.id, { title: itemTitle });
  }

  // Refresh context menu if browser supports refresh()
  if (chrome.contextMenus && typeof chrome.contextMenus.refresh === 'function') {
    try {
      chrome.contextMenus.refresh();
    } catch (e) {}
  }
}

// Reset menu titles when no number is selected
async function resetMenuTitles() {
  const settings = await getSettings();
  const rules = (settings.rules || []).filter(r => r.enabled);
  const menuMode = settings.menuMode || 'submenu';

  if (menuMode === 'submenu') {
    safeUpdateMenu('parent_math_root', {
      title: '🧮 Custom Math'
    });
  }

  for (const rule of rules) {
    const prefix = menuMode === 'root' ? '🧮 ' : '';
    safeUpdateMenu(rule.id, {
      title: `${prefix}${rule.name}`
    });
  }
}

// Initialize on install or startup
chrome.runtime.onInstalled.addListener(async (details) => {
  const data = await chrome.storage.sync.get('smart_context_settings');
  if (!data || !data.smart_context_settings) {
    // Setting this triggers chrome.storage.onChanged which will rebuild menus
    await chrome.storage.sync.set({ smart_context_settings: DEFAULT_SETTINGS });
  } else {
    await rebuildContextMenu();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await rebuildContextMenu();
});

// Watch for storage changes and rebuild menus dynamically
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.smart_context_settings) {
    rebuildContextMenu();
  }
});

// Dynamic context menu update onShown
if (chrome.contextMenus && chrome.contextMenus.onShown) {
  chrome.contextMenus.onShown.addListener(async (info, tab) => {
    if (info && info.selectionText) {
      await updateMenuTitlesForText(info.selectionText);
    }
  });
}

// Handle messages from content script (pre-emptive update on selection change)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SELECTION_UPDATED') {
    updateMenuTitlesForText(message.text);
    sendResponse({ status: 'ok' });
  } else if (message.type === 'REBUILD_MENUS') {
    rebuildContextMenu().then(() => sendResponse({ status: 'rebuilt' }));
    return true;
  } else if (message.type === 'GET_CALCULATION') {
    const extract = extractNumberOrExpression(message.text);
    if (extract && extract.isValid) {
      getSettings().then(settings => {
        const rules = (settings.rules || []).filter(r => r.enabled);
        const results = rules.map(rule => {
          const res = applyRuleToNumber(rule, extract.number, message.text);
          return {
            id: rule.id,
            name: rule.name,
            formula: rule.formula,
            success: res.success,
            formatted: res.formatted,
            value: res.value
          };
        });
        sendResponse({ success: true, results, input: extract.number });
      });
      return true;
    } else {
      sendResponse({ success: false, error: 'Not a valid number or expression' });
    }
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'open_settings_menu' || info.menuItemId === 'no_rules_info') {
    chrome.runtime.openOptionsPage();
    return;
  }

  const settings = await getSettings();
  const ruleId = info.menuItemId;
  const selectionText = info.selectionText || lastSelectionText;

  // Find calculation or calculate on the fly
  let calc = currentCalculations[ruleId];
  if (!calc && selectionText) {
    const extract = extractNumberOrExpression(selectionText);
    const rule = (settings.rules || []).find(r => r.id === ruleId);
    if (extract && extract.isValid && rule) {
      const res = applyRuleToNumber(rule, extract.number, selectionText);
      calc = {
        rule: rule,
        input: extract.number,
        result: res.value,
        formatted: res.formatted,
        success: res.success,
        error: res.error
      };
    }
  }

  if (!calc || !calc.success) {
    console.warn('No valid calculation found for clicked menu item:', ruleId);
    return;
  }

  // Send message to active tab to copy and display toast
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'DISPLAY_RESULT',
      payload: {
        formatted: calc.formatted,
        value: calc.result,
        ruleName: calc.rule.name,
        formula: calc.rule.formula,
        input: calc.input,
        copyOnClick: settings.copyOnClick !== false,
        showToast: settings.showToast !== false,
        replaceSelection: settings.replaceSelection === true,
        toastDuration: settings.toastDuration || 2500,
        toastTheme: settings.toastTheme || 'modern-dark',
        colorStyle: settings.colorStyle || 'indigo'
      }
    });
  }
});
