/**
 * Content Script for Smart Context Menu
 * Detects text selection, communicates with background worker, and renders floating toasts.
 */

let lastMouseX = window.innerWidth / 2;
let lastMouseY = window.innerHeight / 2;
let debounceTimer = null;
let activeToastContainer = null;

// Track cursor coordinates
document.addEventListener('mousemove', (e) => {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
}, { passive: true });

// Capture cursor and selection on right click
document.addEventListener('contextmenu', (e) => {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;

  const selection = window.getSelection().toString().trim();
  if (selection) {
    chrome.runtime.sendMessage({
      type: 'SELECTION_UPDATED',
      text: selection
    }).catch(() => {
      // Extension context might be invalidated during reload
    });
  }
}, { capture: true });

// Listen to selection changes to update context menu pre-emptively
document.addEventListener('selectionchange', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const selection = window.getSelection().toString().trim();
    if (selection && selection.length < 100) {
      chrome.runtime.sendMessage({
        type: 'SELECTION_UPDATED',
        text: selection
      }).catch(() => {});
    }
  }, 120);
});

// Copy text to clipboard helper
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    // Fallback below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch (err) {
    console.error('Fallback clipboard copy failed:', err);
    return false;
  }
}

// Replace selected text in active input/textarea if applicable
function tryReplaceSelection(newText) {
  const activeEl = document.activeElement;
  if (!activeEl) return false;

  const tagName = activeEl.tagName.toLowerCase();
  const isInput = tagName === 'input' && !['checkbox', 'radio', 'button', 'submit'].includes(activeEl.type);
  const isTextarea = tagName === 'textarea';

  if (isInput || isTextarea) {
    const start = activeEl.selectionStart;
    const end = activeEl.selectionEnd;
    if (typeof start === 'number' && typeof end === 'number' && start !== end) {
      const val = activeEl.value;
      activeEl.value = val.substring(0, start) + newText + val.substring(end);
      activeEl.selectionStart = activeEl.selectionEnd = start + newText.length;
      activeEl.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
  } else if (activeEl.isContentEditable) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(newText));
      return true;
    }
  }
  return false;
}

// Show floating toast HUD
function showToast(payload) {
  // Remove existing toast if any
  if (activeToastContainer) {
    activeToastContainer.remove();
    activeToastContainer = null;
  }

  const container = document.createElement('div');
  container.className = 'scm-toast-container';

  // Calculate position
  const pad = 16;
  const toastWidth = 280;
  const toastHeight = 90;

  let posX = lastMouseX + 12;
  let posY = lastMouseY + 12;

  // Keep within viewport boundaries
  if (posX + toastWidth > window.innerWidth - pad) {
    posX = lastMouseX - toastWidth - 12;
  }
  if (posY + toastHeight > window.innerHeight - pad) {
    posY = lastMouseY - toastHeight - 12;
  }
  if (posX < pad) posX = pad;
  if (posY < pad) posY = pad;

  container.style.left = `${posX}px`;
  container.style.top = `${posY}px`;

  const themeClass = `scm-theme-${payload.toastTheme || 'modern-dark'}`;
  const colorClass = `scm-color-${payload.colorStyle || 'indigo'}`;
  const badgeText = payload.copyOnClick ? 'Copied to Clipboard' : 'Calculated';

  const card = document.createElement('div');
  card.className = `scm-toast-card ${themeClass} ${colorClass}`;
  card.innerHTML = `
    <div class="scm-toast-header">
      <span class="scm-toast-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        ${badgeText}
      </span>
      <button class="scm-toast-close" title="Dismiss">&times;</button>
    </div>
    <div class="scm-toast-value">${escapeHtml(payload.formatted)}</div>
    <div class="scm-toast-details">
      <span class="scm-toast-rule">${escapeHtml(payload.ruleName)}</span>
      <span class="scm-toast-formula">(${escapeHtml(payload.formula)})</span>
    </div>
  `;

  // Dismiss on close button or click
  const closeBtn = card.querySelector('.scm-toast-close');
  const dismiss = () => {
    card.classList.add('scm-leaving');
    card.addEventListener('animationend', () => {
      container.remove();
      if (activeToastContainer === container) {
        activeToastContainer = null;
      }
    }, { once: true });
  };

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dismiss();
  });

  card.addEventListener('click', dismiss);

  container.appendChild(card);
  document.body.appendChild(container);
  activeToastContainer = container;

  // Auto-dismiss after duration
  setTimeout(() => {
    if (activeToastContainer === container) {
      dismiss();
    }
  }, payload.toastDuration || 2500);
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

// Listen for instructions from background worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'DISPLAY_RESULT') {
    const payload = request.payload;

    if (payload.copyOnClick) {
      copyToClipboard(payload.formatted);
    }

    if (payload.replaceSelection) {
      tryReplaceSelection(payload.formatted);
    }

    if (payload.showToast) {
      showToast(payload);
    }

    sendResponse({ success: true });
  }
});
