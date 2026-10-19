/**
 * Popup Logic for Smart Math Extension
 */

import { extractNumberOrExpression, applyRuleToNumber } from '../utils/math-parser.js';
import { getSettings } from '../utils/storage.js';

const popupInput = document.getElementById('popup-input');
const popupClearBtn = document.getElementById('popup-clear-btn');
const popupResultsList = document.getElementById('popup-results-list');
const openOptionsBtn = document.getElementById('open-options-btn');
const manageRulesLink = document.getElementById('manage-rules-link');
const copiedToast = document.getElementById('copied-toast');

let cachedRules = [];

async function initPopup() {
  const settings = await getSettings();
  cachedRules = (settings.rules || []).filter(r => r.enabled);

  // Apply chosen color theme and appearance mode
  document.documentElement.setAttribute('data-color-style', settings.colorStyle || 'indigo');
  document.documentElement.setAttribute('data-appearance', settings.appearanceMode || 'dark');

  // Try to grab currently selected text from the active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection().toString().trim()
      });
      if (result) {
        popupInput.value = result;
      }
    }
  } catch (e) {
    // Tab scripting might not be permitted on restricted pages (e.g. chrome://)
  }

  renderResults();

  // Event Listeners
  popupInput.addEventListener('input', renderResults);
  popupClearBtn.addEventListener('click', () => {
    popupInput.value = '';
    popupInput.focus();
    renderResults();
  });

  const openSettings = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/options.html'));
    }
  };

  openOptionsBtn.addEventListener('click', openSettings);
  manageRulesLink.addEventListener('click', openSettings);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPopup);
} else {
  initPopup();
}

function renderResults() {
  popupResultsList.innerHTML = '';
  const rawText = popupInput.value.trim() || '100';
  const extract = extractNumberOrExpression(rawText);
  const testNum = extract && extract.isValid ? extract.number : 100;

  if (cachedRules.length === 0) {
    popupResultsList.innerHTML = `
      <div style="text-align:center; padding: 20px; color: var(--text-dim);">
        No active rules. Click below to add rules in Settings.
      </div>
    `;
    return;
  }

  cachedRules.forEach(rule => {
    const res = applyRuleToNumber(rule, testNum, rawText);
    const item = document.createElement('div');
    item.className = 'popup-result-item';
    item.innerHTML = `
      <div class="result-item-left">
        <span class="result-rule-name">${escapeHtml(rule.name)}</span>
        <span class="result-rule-formula">${escapeHtml(rule.formula)}</span>
      </div>
      <div class="result-item-right">${escapeHtml(res.formatted)}</div>
    `;

    item.addEventListener('click', async () => {
      await navigator.clipboard.writeText(res.formatted);
      showCopiedToast();
    });

    popupResultsList.appendChild(item);
  });
}

let toastTimer = null;
function showCopiedToast() {
  clearTimeout(toastTimer);
  copiedToast.classList.remove('hidden');
  toastTimer = setTimeout(() => {
    copiedToast.classList.add('hidden');
  }, 1200);
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
