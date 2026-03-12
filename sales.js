(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }

  function renderProductList(el, products, col) {
    if (!el) return;
    el.innerHTML = '';
    var sorted = products.slice().sort(function(a, b) {
      return (a.category || '未分類').localeCompare(b.category || '未分類', 'ja');
    });

    var currentCat = null;
    sorted.forEach(function (p) {
      if ((p.category || '未分類') !== currentCat) {
        currentCat = p.category || '未分類';
        var h = document.createElement('div');
        h.style.cssText = 'grid-column:1/-1;padding:4px 10px;font-weight:bold;background:#e2e8f0;margin-top:10px;border-radius:4px;font-size:0.85rem;color:#475569;';
        h.textContent = '【' + currentCat + '】';
        el.appendChild(h);
      }

      var row = document.createElement('div');
      row.className = 'product-row';
      // 縦幅を抑えるために padding を 4px に縮小
      row.style.cssText = 'display:flex;align-items:center;padding:4px 2px;border-bottom:1px solid #edf2f7;gap:5px;';
      
      var count = col.counts[p.id] || 0;
      var subPts = (p.points * count).toFixed(1);
      var subWgt = p.weight * count;

      row.innerHTML = `
        <div style="flex:1;min-width:0;display:flex;align-items:baseline;gap:6px;">
          <div style="font-size:1.05rem;font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;">${p.name}</div>
          <div style="font-size:0.9rem;color:#888;white-space:nowrap;">${p.points}点/${p.weight}g</div>
        </div>
        <div style="width:55px;">
          <input type="text" inputmode="numeric" class="count-input" value="${count === 0 ? '' : count}" 
                 style="width:100%;text-align:center;padding:5px 0;border:1px solid #cbd5e0;border-radius:4px;font-size:1.1rem;height:34px;">
        </div>
        <div style="width:75px;text-align:right;font-size:1.1rem;line-height:1.1;color:var(--accent-2);font-weight:bold;">
          <div>${subPts}<span style="font-size:0.6rem;margin-left:1px;">点</span></div>
          <div style="font-size:0.9rem;color:#718096;font-weight:normal;">${subWgt}g</div>
        </div>
      `;

      var input = row.querySelector('input');
      input.addEventListener('input', function () {
        var val = input.value.replace(/\D/g, '').slice(0, 4);
        input.value = val;
        var n = parseInt(val, 10) || 0;
        col.counts[p.id] = n;
        saveColumns([col]);
        
        var subDiv = row.children[2];
        subDiv.children[0].innerHTML = (p.points * n).toFixed(1) + '<span style="font-size:0.6rem;margin-left:1px;">点</span>';
        subDiv.children[1].textContent = (p.weight * n) + 'g';
        updateSummary(products, col);
      });
      el.appendChild(row);
    });
  }

  function updateSummary(products, col) {
    var s = calculateTotal(products, [col]);
    $('totalPointsRoom').textContent = s.totalPointsRoom.toFixed(1);
    $('totalPointsCold').textContent = s.totalPointsCold.toFixed(1);
    $('totalWeight').textContent = s.totalWeightRoom + ' g';
    $('totalWeightCold').textContent = s.totalWeightCold + ' g';
  }

  window.addEventListener('DOMContentLoaded', function () {
    var products = loadProducts();
    var col = loadColumns()[0] || { id: 'c1', counts: {} };

    renderProductList($('productsContainer'), products, col);
    updateSummary(products, col);

    $('refreshMasterBtn').addEventListener('click', function () {
      var cb = '?t=' + new Date().getTime();
      
      fetch('./data.json' + cb, { cache: 'no-cache' })
        .then(res => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then(data => {
          if (data && data.products) {
            saveProducts(data.products);
            alert('最新データを読み込みました。');
            location.reload();
          }
        })
        .catch(err => {
          console.error(err);
          alert('更新に失敗しました。サーバに data.json があるか確認してください。');
        });
    });

    $('resetCountsBtn').addEventListener('click', function () {
      if (confirm('リセットしますか？')) {
        col.counts = {};
        saveColumns([col]);
        location.reload();
      }
    });
  });
})();