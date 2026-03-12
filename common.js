const STORAGE_KEYS = {
  PRODUCTS: 'tanomu_products_v2',
  COLUMNS: 'tanomu_columns_v2',
  RULES: 'tanomu_rules_v1',
  ADMIN_PASSWORD_HASH: 'tanomu_admin_password_hash_v1'
};

const DEFAULT_PRODUCTS = [
  { id: 'p1', name: '力めし(70g)', points: 0.8, weight: 70, type: '常温', category: '主食' },
  { id: 'p2', name: '力だし', points: 0.6, weight: 112, type: '常温', category: '調味料' },
  { id: 'p3', name: '納豆', points: 1.2, weight: 55, type: '冷蔵', category: 'おかず' },
  { id: 'p4', name: 'とろろ', points: 1, weight: 65, type: '冷蔵', category: 'おかず' },
  { id: 'p5', name: '焼のり(18g)', points: 1.36, weight: 18, type: '常温', category: '乾物' }
];

const DEFAULT_RULES = [];

function loadProducts() {
  var data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
  return data ? JSON.parse(data) : null;
}
function saveProducts(products) {
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
}
function loadRules() {
  var data = localStorage.getItem(STORAGE_KEYS.RULES);
  return data ? JSON.parse(data) : DEFAULT_RULES;
}
function saveRules(rules) {
  localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
}
function loadColumns() {
  var data = localStorage.getItem(STORAGE_KEYS.COLUMNS);
  return data ? JSON.parse(data) : [];
}
function saveColumns(cols) {
  localStorage.setItem(STORAGE_KEYS.COLUMNS, JSON.stringify(cols));
}

function calculateTotal(products, columns) {
  var tpRoom = 0, tpCold = 0, twRoom = 0, twCold = 0;
  columns.forEach(function (col) {
    products.forEach(function (p) {
      var count = col.counts[p.id] || 0;
      if (p.type === '冷蔵') {
        tpCold += p.points * count;
        twCold += p.weight * count;
      } else {
        tpRoom += p.points * count;
        twRoom += p.weight * count;
      }
    });
  });
  return {
    totalPointsRoom: tpRoom,
    totalPointsCold: tpCold,
    totalWeightRoom: twRoom,
    totalWeightCold: twCold
  };
}