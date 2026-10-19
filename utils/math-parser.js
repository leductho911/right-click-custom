/**
 * Safe Math Expression Parser and Formatter for Chrome Extension
 * Supports arithmetic (+, -, *, /, %, ^), functions (sqrt, abs, round, etc.), and variables (x, n).
 */

// Cleans input string and extracts numeric value or math expression
export function extractNumberOrExpression(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  let text = rawText.trim();
  if (!text) return null;

  // If text contains pure arithmetic with operators (e.g. "12 + 4 * 3"),
  // we check if it is directly evaluatable
  const isDirectExpression = /^[0-9\s.+\-*/%^()a-zA-Z]+$/.test(text) &&
    /[+\-*/%^]/.test(text) &&
    !/[a-wy-z]/i.test(text.replace(/(sqrt|abs|round|floor|ceil|min|max|pow|sin|cos|tan|pi|e)/gi, ''));

  // Clean currency symbols and special characters
  const cleaned = text
    .replace(/[$€£¥₫₹₩₽₺₴₿]/g, '')
    .trim();

  // Try extracting number
  let numericValue = null;

  // Handle European vs US number formatting
  // Check for "1.234,56" vs "1,234.56"
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(cleaned)) {
    // European with thousands dot and decimal comma: 1.234,56 -> 1234.56
    numericValue = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  } else if (/^\d+,\d+$/.test(cleaned) && !/^\d+,\d{3}$/.test(cleaned)) {
    // Decimal comma: 12,5 or 99,99 -> 12.5
    numericValue = parseFloat(cleaned.replace(',', '.'));
  } else {
    // Standard US/international: remove commas as thousands separators
    const standardCleaned = cleaned.replace(/,/g, '');
    const match = standardCleaned.match(/-?\d+(\.\d+)?/);
    if (match) {
      numericValue = parseFloat(match[0]);
    }
  }

  return {
    raw: rawText,
    cleaned: cleaned,
    number: numericValue,
    isDirectExpression: isDirectExpression,
    isValid: numericValue !== null && !isNaN(numericValue)
  };
}

// Tokenizer for mathematical expressions
function tokenize(expr) {
  const tokens = [];
  let i = 0;
  const str = expr.trim();

  while (i < str.length) {
    const char = str[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Number (including decimal)
    if (/\d/.test(char) || (char === '.' && i + 1 < str.length && /\d/.test(str[i + 1]))) {
      let numStr = '';
      while (i < str.length && (/\d/.test(str[i]) || str[i] === '.')) {
        numStr += str[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
      continue;
    }

    // Identifiers (functions or variables: x, n, sqrt, round, etc.)
    if (/[a-zA-Z_]/.test(char)) {
      let ident = '';
      while (i < str.length && /[a-zA-Z0-9_]/.test(str[i])) {
        ident += str[i];
        i++;
      }
      tokens.push({ type: 'IDENTIFIER', value: ident.toLowerCase() });
      continue;
    }

    // Two-character operators (e.g., **)
    if (char === '*' && str[i + 1] === '*') {
      tokens.push({ type: 'OPERATOR', value: '^' });
      i += 2;
      continue;
    }

    // Single-character operators and parentheses
    if ('+-*/%^() ,'.includes(char)) {
      if (char !== ' ' && char !== ',') {
        tokens.push({ type: char === '(' || char === ')' ? 'PAREN' : 'OPERATOR', value: char });
      } else if (char === ',') {
        tokens.push({ type: 'COMMA', value: ',' });
      }
      i++;
      continue;
    }

    // Unknown char, skip
    i++;
  }

  return tokens;
}

// Shunting-yard algorithm to evaluate infix expressions safely
export function evaluateMath(expression, variables = {}) {
  try {
    if (!expression || typeof expression !== 'string') {
      return { success: false, error: 'Empty formula' };
    }

    const tokens = tokenize(expression);
    if (tokens.length === 0) {
      return { success: false, error: 'No tokens found' };
    }

    // Operator precedence and associativity
    const precedence = {
      '+': 1,
      '-': 1,
      '*': 2,
      '/': 2,
      '%': 2,
      '^': 3,
      'u-': 4 // unary minus
    };

    const associativity = {
      '+': 'L',
      '-': 'L',
      '*': 'L',
      '/': 'L',
      '%': 'L',
      '^': 'R',
      'u-': 'R'
    };

    const outputQueue = [];
    const operatorStack = [];
    let prevToken = null;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type === 'NUMBER') {
        outputQueue.push(token);
      } else if (token.type === 'IDENTIFIER') {
        const val = token.value;
        if (val in variables) {
          outputQueue.push({ type: 'NUMBER', value: Number(variables[val]) });
        } else if (val === 'pi') {
          outputQueue.push({ type: 'NUMBER', value: Math.PI });
        } else if (val === 'e') {
          outputQueue.push({ type: 'NUMBER', value: Math.E });
        } else {
          // Function call: e.g. sqrt, abs, round, ceil, floor, sin, cos, tan
          operatorStack.push({ type: 'FUNCTION', value: val });
        }
      } else if (token.type === 'COMMA') {
        while (
          operatorStack.length > 0 &&
          operatorStack[operatorStack.length - 1].value !== '('
        ) {
          outputQueue.push(operatorStack.pop());
        }
      } else if (token.type === 'OPERATOR') {
        let op = token.value;

        // Detect unary minus
        if (op === '-' && (!prevToken || (prevToken.type === 'OPERATOR') || (prevToken.type === 'PAREN' && prevToken.value === '('))) {
          op = 'u-';
        }

        while (
          operatorStack.length > 0 &&
          operatorStack[operatorStack.length - 1].type !== 'PAREN' &&
          (
            (associativity[op] === 'L' && (precedence[op] <= precedence[operatorStack[operatorStack.length - 1].value])) ||
            (associativity[op] === 'R' && (precedence[op] < precedence[operatorStack[operatorStack.length - 1].value]))
          )
        ) {
          outputQueue.push(operatorStack.pop());
        }
        operatorStack.push({ type: 'OPERATOR', value: op });
      } else if (token.type === 'PAREN') {
        if (token.value === '(') {
          operatorStack.push(token);
        } else if (token.value === ')') {
          while (
            operatorStack.length > 0 &&
            operatorStack[operatorStack.length - 1].value !== '('
          ) {
            outputQueue.push(operatorStack.pop());
          }
          if (operatorStack.length === 0) {
            return { success: false, error: 'Mismatched parentheses' };
          }
          operatorStack.pop(); // Pop '('

          // If top of stack is a function, pop it to output
          if (operatorStack.length > 0 && operatorStack[operatorStack.length - 1].type === 'FUNCTION') {
            outputQueue.push(operatorStack.pop());
          }
        }
      }
      prevToken = token;
    }

    while (operatorStack.length > 0) {
      const op = operatorStack.pop();
      if (op.type === 'PAREN') {
        return { success: false, error: 'Mismatched parentheses' };
      }
      outputQueue.push(op);
    }

    // Evaluate RPN queue
    const evalStack = [];

    for (const item of outputQueue) {
      if (item.type === 'NUMBER') {
        evalStack.push(item.value);
      } else if (item.type === 'OPERATOR') {
        if (item.value === 'u-') {
          if (evalStack.length < 1) return { success: false, error: 'Invalid unary expression' };
          const a = evalStack.pop();
          evalStack.push(-a);
        } else {
          if (evalStack.length < 2) return { success: false, error: 'Malformed expression' };
          const b = evalStack.pop();
          const a = evalStack.pop();
          let res = 0;
          switch (item.value) {
            case '+': res = a + b; break;
            case '-': res = a - b; break;
            case '*': res = a * b; break;
            case '/':
              if (b === 0) return { success: false, error: 'Division by zero' };
              res = a / b;
              break;
            case '%': res = a % b; break;
            case '^': res = Math.pow(a, b); break;
            default: return { success: false, error: `Unknown operator: ${item.value}` };
          }
          evalStack.push(res);
        }
      } else if (item.type === 'FUNCTION') {
        const fn = item.value;
        if (['sqrt', 'abs', 'round', 'floor', 'ceil', 'sin', 'cos', 'tan', 'log'].includes(fn)) {
          if (evalStack.length < 1) return { success: false, error: `Missing argument for ${fn}` };
          const a = evalStack.pop();
          let res = 0;
          switch (fn) {
            case 'sqrt': res = Math.sqrt(a); break;
            case 'abs': res = Math.abs(a); break;
            case 'round': res = Math.round(a); break;
            case 'floor': res = Math.floor(a); break;
            case 'ceil': res = Math.ceil(a); break;
            case 'sin': res = Math.sin(a); break;
            case 'cos': res = Math.cos(a); break;
            case 'tan': res = Math.tan(a); break;
            case 'log': res = Math.log(a); break;
          }
          evalStack.push(res);
        } else if (['min', 'max', 'pow'].includes(fn)) {
          if (evalStack.length < 2) return { success: false, error: `Missing arguments for ${fn}` };
          const b = evalStack.pop();
          const a = evalStack.pop();
          let res = 0;
          if (fn === 'min') res = Math.min(a, b);
          else if (fn === 'max') res = Math.max(a, b);
          else if (fn === 'pow') res = Math.pow(a, b);
          evalStack.push(res);
        } else {
          return { success: false, error: `Unsupported function: ${fn}` };
        }
      }
    }

    if (evalStack.length !== 1) {
      return { success: false, error: 'Evaluation failed' };
    }

    const finalVal = evalStack[0];
    if (isNaN(finalVal) || !isFinite(finalVal)) {
      return { success: false, error: 'Result is undefined or infinity' };
    }

    return { success: true, result: finalVal };
  } catch (err) {
    return { success: false, error: err.message || 'Error evaluating formula' };
  }
}

// Executes a rule on a given number x or raw expression
export function applyRuleToNumber(rule, numberValue, rawText = '') {
  let formula = (rule.formula || 'x').trim();

  // If user formula is "x" or empty and selection is an expression (e.g. "45 + 10 * 2"),
  // evaluate the selection directly
  if ((formula === 'x' || formula === '') && rawText && /[+\-*/%^]/.test(rawText)) {
    formula = rawText.replace(/[$€£¥₫₹₩₽₺₴₿]/g, '').trim();
  }

  const evalRes = evaluateMath(formula, {
    x: numberValue,
    n: numberValue
  });

  if (!evalRes.success) {
    return {
      success: false,
      error: evalRes.error,
      formatted: `Error: ${evalRes.error}`
    };
  }

  const formatted = formatResult(evalRes.result, {
    decimals: rule.decimals,
    useThousands: rule.useThousands !== false,
    prefix: rule.prefix || '',
    suffix: rule.suffix || ''
  });

  return {
    success: true,
    value: evalRes.result,
    formatted: formatted
  };
}

// Format the numeric result with decimals, prefix, suffix, and thousand separators
export function formatResult(value, options = {}) {
  const {
    decimals = 2,
    useThousands = true,
    prefix = '',
    suffix = ''
  } = options;

  let numStr = '';
  if (decimals === 'auto' || decimals === '' || decimals === undefined || decimals === null) {
    // Keep reasonable precision, trim trailing zero decimals
    numStr = (Math.round(value * 10000) / 10000).toString();
  } else {
    const decNum = Math.max(0, Math.min(10, parseInt(decimals, 10)));
    numStr = value.toFixed(decNum);
  }

  if (useThousands) {
    const parts = numStr.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    numStr = parts.join('.');
  }

  const pre = prefix ? `${prefix} ` : '';
  const suf = suffix ? ` ${suffix}` : '';

  // Compact prefix spacing for common symbols: $, €, £
  const cleanPrefix = /^[$€£¥₫₹₩]/.test(prefix) ? prefix : pre;

  return `${cleanPrefix}${numStr}${suf}`.trim();
}
