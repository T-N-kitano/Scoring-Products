const STORAGE_KEYS = {
  PRODUCTS: 'tanomu_products_v2',
  COLUMNS: 'tanomu_columns_v2',
  RULES: 'tanomu_rules_v1',
  ADMIN_PASSWORD_HASH: 'tanomu_admin_password_hash_v1',
};

const DEFAULT_PRODUCTS = [
  { id: 'p1', name: '力めし(70g)', points: 0.8, weight: 70, type: '常温' },
  { id: 'p2', name: '力だし', points: 0.6, weight: 112, type: '常温' },
  { id: 'p3', name: '納豆', points: 1.2, weight: 55, type: '冷蔵' },
  { id: 'p4', name: 'とろろ', points: 1, weight: 65, type: '冷蔵' },
  { id: 'p5', name: '焼のり(18g)', points: 1.36, weight: 18, type: '常温' },
];

const DEFAULT_RULES = [
  {
    id: 'r_hijiki',
    matchType: 'contains',
    matchValue: 'ひじきのり',
    comparator: '>',
    threshold: 125,
    severity: 'danger',
    message: 'ひじきのりは1箱あたり125個まで（破損リスク）',
  },
  {
    id: 'r_tarako',
    matchType: 'contains',
    matchValue: 'たらこのり',
    comparator: '>',
    threshold: 125,
    severity: 'danger',
    message: 'たらこのりは1箱あたり125個まで（破損リスク）',
  },
  {
    id: 'r_furikake',
    matchType: 'contains',
    matchValue: 'ふりかけ',
    comparator: '>',
    threshold: 80,
    severity: 'warn',
    message: 'ふりかけは重量制限のため1箱80袋まで（常温20kg/冷蔵15kgの目安）',
  },
];

function $(id) {
  return document.getElementById(id);
}

function generateId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function safeParseJSON(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function loadProducts() {
  const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
  if (!raw) return DEFAULT_PRODUCTS.slice();
  const parsed = safeParseJSON(raw, null);
  return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_PRODUCTS.slice();
}

function saveProducts(products) {
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
}

function loadRules() {
  const raw = localStorage.getItem(STORAGE_KEYS.RULES);
  if (!raw) return DEFAULT_RULES.slice();
  const parsed = safeParseJSON(raw, null);
  return Array.isArray(parsed) ? parsed : DEFAULT_RULES.slice();
}

function saveRules(rules) {
  localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
}

function loadColumns() {
  const raw = localStorage.getItem(STORAGE_KEYS.COLUMNS);
  if (!raw) return [];
  const parsed = safeParseJSON(raw, null);
  return Array.isArray(parsed) ? parsed : [];
}

function saveColumns(columns) {
  localStorage.setItem(STORAGE_KEYS.COLUMNS, JSON.stringify(columns));
}

async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function loadAdminPasswordHash() {
  return localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD_HASH) || null;
}

function saveAdminPasswordHash(hash) {
  localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORD_HASH, hash);
}

function createColumn(products) {
  const counts = {};
  products.forEach((p) => {
    counts[p.id] = 0;
  });
  return { id: generateId('col'), counts };
}

function normalizeColumns(products, columns) {
  const ids = new Set(products.map((p) => p.id));
  columns.forEach((c) => {
    Object.keys(c.counts || {}).forEach((pid) => {
      if (!ids.has(pid)) delete c.counts[pid];
    });
    products.forEach((p) => {
      if (typeof c.counts[p.id] !== 'number') c.counts[p.id] = Number(c.counts[p.id] || 0);
      if (!(p.id in c.counts)) c.counts[p.id] = 0;
    });
  });
}

function computeTotals(products, columns) {
  let totalPoints = 0;
  let totalWeightRoom = 0;
  let totalWeightCold = 0;

  const perColumn = {};

  columns.forEach((col) => {
    let colPoints = 0;
    let colWeightRoom = 0;
    let colWeightCold = 0;

    products.forEach((p) => {
      const count = Number(col.counts[p.id] || 0);
      if (!count) return;
      colPoints += Number(p.points || 0) * count;
      const wt = Number(p.weight || 0) * count;
      if (p.type === '冷蔵') colWeightCold += wt;
      else colWeightRoom += wt;
    });

    totalPoints += colPoints;
    totalWeightRoom += colWeightRoom;
    totalWeightCold += colWeightCold;

    perColumn[col.id] = { points: colPoints, weightRoom: colWeightRoom, weightCold: colWeightCold };
  });

  return { totalPoints, totalWeightRoom, totalWeightCold, perColumn };
}

function matchProductName(productName, rule) {
  const name = String(productName || '');
  const needle = String(rule.matchValue || '');
  if (!needle) return false;
  if (rule.matchType === 'equals') return name === needle;
  return name.includes(needle);
}

function compare(a, op, b) {
  if (op === '>=') return a >= b;
  if (op === '==') return a === b;
  if (op === '<=') return a <= b;
  if (op === '<') return a < b;
  return a > b; // default ">"
}

function evaluateRulesForColumn(products, column, rules) {
  const results = [];
  rules.forEach((rule) => {
    const threshold = Number(rule.threshold || 0);
    if (!rule.matchValue) return;

    let countSum = 0;
    products.forEach((p) => {
      if (!matchProductName(p.name, rule)) return;
      countSum += Number(column.counts[p.id] || 0);
    });

    const triggered = compare(countSum, rule.comparator || '>', threshold);
    if (triggered) {
      results.push({
        ruleId: rule.id,
        severity: rule.severity || 'danger',
        message: rule.message || `${rule.matchValue} が ${threshold} を超過`,
        currentCount: countSum,
        threshold,
      });
    }
  });
  return results;
}

function renderRulesTable(rules, onChange) {
  const tbody = $('rulesTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  rules.forEach((r) => {
    const tr = document.createElement('tr');

    const tdDelete = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.textContent = '×';
    delBtn.className = 'column-delete-btn';
    delBtn.addEventListener('click', () => {
      if (!confirm('このルールを削除しますか？')) return;
      const idx = rules.findIndex((x) => x.id === r.id);
      if (idx >= 0) {
        rules.splice(idx, 1);
        saveRules(rules);
        onChange();
      }
    });
    tdDelete.appendChild(delBtn);

    const tdCond = document.createElement('td');
    tdCond.style.minWidth = '180px';
    const wrapCond = document.createElement('div');
    wrapCond.style.display = 'grid';
    wrapCond.style.gridTemplateColumns = '120px 1fr';
    wrapCond.style.gap = '6px';
    const selMatch = document.createElement('select');
    [
      { value: 'contains', label: '含む' },
      { value: 'equals', label: '一致' },
    ].forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      selMatch.appendChild(opt);
    });
    selMatch.value = r.matchType || 'contains';
    selMatch.addEventListener('change', () => {
      r.matchType = selMatch.value;
      saveRules(rules);
      onChange();
    });
    const inpNeedle = document.createElement('input');
    inpNeedle.type = 'text';
    inpNeedle.value = r.matchValue || '';
    inpNeedle.placeholder = '例: ひじきのり';
    inpNeedle.addEventListener('change', () => {
      r.matchValue = inpNeedle.value;
      saveRules(rules);
      onChange();
    });
    wrapCond.appendChild(selMatch);
    wrapCond.appendChild(inpNeedle);
    tdCond.appendChild(wrapCond);

    const tdCount = document.createElement('td');
    tdCount.style.minWidth = '140px';
    const wrapCount = document.createElement('div');
    wrapCount.style.display = 'grid';
    wrapCount.style.gridTemplateColumns = '70px 1fr';
    wrapCount.style.gap = '6px';
    const selOp = document.createElement('select');
    ['>', '>=', '==', '<=', '<'].forEach((op) => {
      const opt = document.createElement('option');
      opt.value = op;
      opt.textContent = op;
      selOp.appendChild(opt);
    });
    selOp.value = r.comparator || '>';
    selOp.addEventListener('change', () => {
      r.comparator = selOp.value;
      saveRules(rules);
      onChange();
    });
    const inpTh = document.createElement('input');
    inpTh.type = 'number';
    inpTh.inputMode = 'numeric';
    inpTh.min = '0';
    inpTh.step = '1';
    inpTh.value = Number(r.threshold || 0);
    inpTh.addEventListener('change', () => {
      r.threshold = Number(inpTh.value || 0);
      saveRules(rules);
      onChange();
    });
    wrapCount.appendChild(selOp);
    wrapCount.appendChild(inpTh);
    tdCount.appendChild(wrapCount);

    const tdAction = document.createElement('td');
    tdAction.style.minWidth = '220px';
    const wrapAction = document.createElement('div');
    wrapAction.style.display = 'grid';
    wrapAction.style.gridTemplateColumns = '110px 1fr';
    wrapAction.style.gap = '6px';
    const selSev = document.createElement('select');
    [
      { value: 'danger', label: '警告（赤）' },
      { value: 'warn', label: '注意（橙）' },
    ].forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      selSev.appendChild(opt);
    });
    selSev.value = r.severity || 'danger';
    selSev.addEventListener('change', () => {
      r.severity = selSev.value;
      saveRules(rules);
      onChange();
    });
    const inpMsg = document.createElement('input');
    inpMsg.type = 'text';
    inpMsg.value = r.message || '';
    inpMsg.placeholder = '例: 1箱125個まで';
    inpMsg.addEventListener('change', () => {
      r.message = inpMsg.value;
      saveRules(rules);
      onChange();
    });
    wrapAction.appendChild(selSev);
    wrapAction.appendChild(inpMsg);
    tdAction.appendChild(wrapAction);

    tr.appendChild(tdDelete);
    tr.appendChild(tdCond);
    tr.appendChild(tdCount);
    tr.appendChild(tdAction);
    tbody.appendChild(tr);
  });
}

function renderProductTable(products, columns, onChange) {
  const tbody = $('productTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  products.forEach((p) => {
    const tr = document.createElement('tr');

    const tdDelete = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.textContent = '×';
    delBtn.className = 'column-delete-btn';
    delBtn.addEventListener('click', () => {
      if (!confirm(`「${p.name}」を削除しますか？`)) return;
      const idx = products.findIndex((x) => x.id === p.id);
      if (idx >= 0) {
        products.splice(idx, 1);
        columns.forEach((c) => {
          delete c.counts[p.id];
        });
        saveProducts(products);
        saveColumns(columns);
        onChange();
      }
    });
    tdDelete.appendChild(delBtn);

    const tdName = document.createElement('td');
    const inpName = document.createElement('input');
    inpName.type = 'text';
    inpName.value = p.name;
    inpName.addEventListener('change', () => {
      p.name = inpName.value;
      saveProducts(products);
      onChange();
    });
    tdName.appendChild(inpName);

    const tdPoints = document.createElement('td');
    const inpPoints = document.createElement('input');
    inpPoints.type = 'number';
    inpPoints.step = '0.01';
    inpPoints.inputMode = 'decimal';
    inpPoints.value = Number(p.points || 0);
    inpPoints.addEventListener('change', () => {
      p.points = Number(inpPoints.value || 0);
      saveProducts(products);
      onChange();
    });
    tdPoints.appendChild(inpPoints);

    const tdWeight = document.createElement('td');
    const inpWeight = document.createElement('input');
    inpWeight.type = 'number';
    inpWeight.step = '1';
    inpWeight.inputMode = 'decimal';
    inpWeight.value = Number(p.weight || 0);
    inpWeight.addEventListener('change', () => {
      p.weight = Number(inpWeight.value || 0);
      saveProducts(products);
      onChange();
    });
    tdWeight.appendChild(inpWeight);

    const tdType = document.createElement('td');
    const selType = document.createElement('select');
    ['常温', '冷蔵'].forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      selType.appendChild(o);
    });
    selType.value = p.type || '常温';
    selType.addEventListener('change', () => {
      p.type = selType.value;
      saveProducts(products);
      onChange();
    });
    tdType.appendChild(selType);

    tr.appendChild(tdDelete);
    tr.appendChild(tdName);
    tr.appendChild(tdPoints);
    tr.appendChild(tdWeight);
    tr.appendChild(tdType);

    tbody.appendChild(tr);
  });
}

function renderColumns(products, columns, rules, totals, onChange) {
  const container = $('columnsContainer');
  container.innerHTML = '';

  columns.forEach((col, colIdx) => {
    const colDiv = document.createElement('div');
    colDiv.className = 'column-card';

    const header = document.createElement('div');
    header.className = 'column-header';

    const title = document.createElement('div');
    title.className = 'column-title';
    title.textContent = `列${colIdx + 1}`;

    const delBtn = document.createElement('button');
    delBtn.className = 'column-delete-btn';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', () => {
      if (!confirm('この列を削除しますか？')) return;
      const idx = columns.findIndex((c) => c.id === col.id);
      if (idx >= 0) {
        columns.splice(idx, 1);
        saveColumns(columns);
        onChange();
      }
    });

    header.appendChild(title);
    header.appendChild(delBtn);

    const summary = document.createElement('div');
    summary.className = 'column-summary';

    const info = totals.perColumn[col.id] || { points: 0, weightRoom: 0, weightCold: 0 };
    summary.innerHTML = `
      <div class="column-summary-label">点数</div>
      <div class="column-summary-value">${info.points.toFixed(1)}</div>
      <div class="column-summary-label">常温(g)</div>
      <div class="column-summary-value">${Math.round(info.weightRoom)}</div>
      <div class="column-summary-label">冷蔵(g)</div>
      <div class="column-summary-value">${Math.round(info.weightCold)}</div>
    `;

    const badges = document.createElement('div');
    badges.className = 'column-badges';

    const triggered = evaluateRulesForColumn(products, col, rules);
    triggered.forEach((t) => {
      const b = document.createElement('span');
      b.className = `badge ${t.severity === 'warn' ? 'badge-warn' : 'badge-danger'}`;
      b.textContent = t.message;
      badges.appendChild(b);
    });

    const table = document.createElement('table');
    table.className = 'column-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>商品</th>
        <th style="text-align:right;">個数</th>
        <th style="text-align:right;">点</th>
        <th style="text-align:right;">g</th>
      </tr>`;

    const tbody = document.createElement('tbody');

    products.forEach((p) => {
      const tr = document.createElement('tr');
      const count = Number(col.counts[p.id] || 0);
      const pts = count * Number(p.points || 0);
      const wt = count * Number(p.weight || 0);

      const tdName = document.createElement('td');
      tdName.textContent = p.name;

      const tdCount = document.createElement('td');
      tdCount.style.textAlign = 'right';
      const inpCount = document.createElement('input');
      inpCount.type = 'number';
      inpCount.inputMode = 'numeric';
      inpCount.min = '0';
      inpCount.value = count ? String(count) : '';
      inpCount.addEventListener('input', () => {
        const v = Number(inpCount.value || 0);
        col.counts[p.id] = v;
        saveColumns(columns);
        onChange();
      });
      tdCount.appendChild(inpCount);

      const tdPoints = document.createElement('td');
      tdPoints.style.textAlign = 'right';
      tdPoints.textContent = pts ? pts.toFixed(1) : '';

      const tdWeight = document.createElement('td');
      tdWeight.style.textAlign = 'right';
      tdWeight.textContent = wt ? Math.round(wt).toString() : '';

      tr.appendChild(tdName);
      tr.appendChild(tdCount);
      tr.appendChild(tdPoints);
      tr.appendChild(tdWeight);
      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);

    colDiv.appendChild(header);
    colDiv.appendChild(summary);
    if (badges.children.length > 0) colDiv.appendChild(badges);
    colDiv.appendChild(table);

    container.appendChild(colDiv);
  });
}

function updateUI(state) {
  const totals = computeTotals(state.products, state.columns);
  $('totalPoints').textContent = totals.totalPoints.toFixed(1);
  $('totalWeight').textContent = `${Math.round(totals.totalWeightRoom)} g`;
  $('totalWeightCold').textContent = `${Math.round(totals.totalWeightCold)} g`;

  renderColumns(state.products, state.columns, state.rules, totals, () => updateUI(state));
  if (state.adminUnlocked) {
    renderRulesTable(state.rules, () => updateUI(state));
    renderProductTable(state.products, state.columns, () => updateUI(state));
  }
}

function setupAdminUI(state) {
  const adminSection = $('adminSection');
  const modal = $('adminAuthModal');

  function showAdmin() {
    state.adminUnlocked = true;
    adminSection.hidden = false;
    updateUI(state);
  }

  function hideAdmin() {
    state.adminUnlocked = false;
    adminSection.hidden = true;
    updateUI(state);
  }

  $('openAdminBtn').addEventListener('click', () => {
    const savedHash = loadAdminPasswordHash();
    if (!savedHash) {
      if (
        confirm(
          '管理者パスワードが未設定です。\nこの端末で管理者メニューを開きますか？（開いたらすぐ設定してください）'
        )
      ) {
        showAdmin();
      }
      return;
    }
    modal.hidden = false;
    $('adminAuthPasswordInput').focus();
  });

  $('adminAuthCancelBtn').addEventListener('click', () => {
    $('adminAuthPasswordInput').value = '';
    modal.hidden = true;
  });

  $('adminAuthBtn').addEventListener('click', async () => {
    const savedHash = loadAdminPasswordHash();
    const input = $('adminAuthPasswordInput').value.trim();
    if (!input) {
      alert('パスワードを入力してください。');
      return;
    }
    const hash = await sha256(input);
    if (hash === savedHash) {
      $('adminAuthPasswordInput').value = '';
      modal.hidden = true;
      showAdmin();
    } else {
      alert('パスワードが違います。');
    }
  });

  $('closeAdminBtn').addEventListener('click', hideAdmin);

  $('saveSettingsBtn').addEventListener('click', async () => {
    const pw = $('adminPasswordInput').value.trim();
    if (!pw) {
      alert('パスワードを変更する場合のみ入力してください。');
      return;
    }
    const hash = await sha256(pw);
    saveAdminPasswordHash(hash);
    $('adminPasswordInput').value = '';
    alert('管理者パスワードを保存しました。');
  });
}

function setupApp() {
  const products = loadProducts();
  const rules = loadRules();
  let columns = loadColumns();
  if (columns.length === 0) {
    columns = [createColumn(products)];
    saveColumns(columns);
  }
  normalizeColumns(products, columns);
  saveColumns(columns);

  const state = {
    products,
    rules,
    columns,
    adminUnlocked: false,
  };

  $('addColumnBtn').addEventListener('click', () => {
    state.columns.push(createColumn(state.products));
    saveColumns(state.columns);
    updateUI(state);
  });

  $('addProductBtn').addEventListener('click', () => {
    const newProduct = {
      id: generateId('p'),
      name: '新商品',
      points: 1,
      weight: 100,
      type: '常温',
    };
    state.products.push(newProduct);
    state.columns.forEach((c) => {
      c.counts[newProduct.id] = 0;
    });
    saveProducts(state.products);
    saveColumns(state.columns);
    updateUI(state);
  });

  $('addRuleBtn').addEventListener('click', () => {
    state.rules.push({
      id: generateId('r'),
      matchType: 'contains',
      matchValue: '',
      comparator: '>',
      threshold: 0,
      severity: 'danger',
      message: '',
    });
    saveRules(state.rules);
    updateUI(state);
  });

  setupAdminUI(state);
  updateUI(state);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('service-worker.js').catch(() => {});
}

window.addEventListener('DOMContentLoaded', () => {
  setupApp();
  registerServiceWorker();
});

