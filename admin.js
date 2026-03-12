(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }

  function renderProductTable(products, onChange) {
    var tbody = $('productTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    products.forEach(function (p) {
      var tr = document.createElement('tr');
      tr.setAttribute('data-id', p.id);

      var tdDel = document.createElement('td');
      var btnDel = document.createElement('button');
      btnDel.textContent = '×';
      btnDel.className = 'column-delete-btn';
      btnDel.onclick = function() {
        if(confirm('本当に削除しますか？')) {
          var idx = products.findIndex(x => x.id === p.id);
          if (idx > -1) {
            products.splice(idx, 1);
            saveProducts(products); 

            tr.remove(); 
            
       
            
            alert('削除しました。');
          }
        }
      };
      tdDel.appendChild(btnDel);
      tr.appendChild(tdDel);

      var tdHandle = document.createElement('td');
      tdHandle.className = 'handle';
      tdHandle.textContent = '≡';
      tr.appendChild(tdHandle);

      var tdName = document.createElement('td');
      var inpN = document.createElement('input');
      inpN.className = 'table-input';
      inpN.value = p.name || '';
      inpN.onchange = function() { p.name = this.value; saveProducts(products); };
      tdName.appendChild(inpN);
      tr.appendChild(tdName);

      var tdCat = document.createElement('td');
      var inpC = document.createElement('input');
      inpC.className = 'table-input';
      inpC.value = p.category || '';
      inpC.onchange = function() { p.category = this.value; saveProducts(products); };
      tdCat.appendChild(inpC);
      tr.appendChild(tdCat);

      var tdPts = document.createElement('td');
      var inpP = document.createElement('input');
      inpP.className = 'table-input';
      inpP.type = 'number';
      inpP.step = '0.01';
      inpP.value = p.points || 0;
      inpP.onchange = function() { p.points = parseFloat(this.value) || 0; saveProducts(products); };
      tdPts.appendChild(inpP);
      tr.appendChild(tdPts);

      var tdWgt = document.createElement('td');
      var inpW = document.createElement('input');
      inpW.className = 'table-input';
      inpW.type = 'number';
      inpW.value = p.weight || 0;
      inpW.onchange = function() { p.weight = parseInt(this.value, 10) || 0; saveProducts(products); };
      tdWgt.appendChild(inpW);
      tr.appendChild(tdWgt);

      var tdType = document.createElement('td');
      var sel = document.createElement('select');
      sel.className = 'table-input';
      ['常温', '冷蔵'].forEach(function(t) {
        var opt = document.createElement('option');
        opt.value = t; opt.textContent = t;
        if(p.type === t) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.onchange = function() { p.type = this.value; saveProducts(products); };
      tdType.appendChild(sel);
      tr.appendChild(tdType);

      tbody.appendChild(tr);
    });

    if (window.Sortable) {
      Sortable.create(tbody, {
        handle: '.handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: function () {
          var newOrder = [];
          tbody.querySelectorAll('tr').forEach(function (row) {
            var id = row.getAttribute('data-id');
            var item = products.find(x => x.id === id);
            if (item) newOrder.push(item);
          });
          products.length = 0;
          newOrder.forEach(item => products.push(item));
          saveProducts(products);
        }
      });
    }
  }

  function runAdmin() {
    var products = loadProducts();
    var rules = loadRules();

    if (products.length === 0 && typeof DEFAULT_PRODUCTS !== 'undefined') {
      products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
      saveProducts(products);
    }

    $('exportMasterBtn').onclick = function() {
      var blob = new Blob([JSON.stringify({ products, rules }, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'data.json';
      a.click();
    };

    $('addProductBtn').onclick = function() {
      products.push({ id: 'p' + Date.now(), name: '新商品', category: '', points: 1, weight: 100, type: '常温' });
      saveProducts(products);
      renderProductTable(products, function() { renderProductTable(products, arguments.callee); });
    };

    renderProductTable(products, function() { renderProductTable(products, arguments.callee); });
  }

  window.addEventListener('DOMContentLoaded', function() {
    var main = $('adminMain');
    if (main) main.hidden = false;
    runAdmin();
  });
})();