import jSuites from 'jsuites';
window.jSuites = jSuites;
import jspreadsheet from 'jspreadsheet-ce';
import { showPrompt } from '../utils/modal.js';

let jspreadsheetInstance = null;
let formulaBarInput = null;
let selectedCellLabel = null;
let currentCellX = null;
let currentCellY = null;
let isFormulaBarUpdating = false;

// ==========================================
// ツールバー (Undo/Redo) の状態更新
// ==========================================
export function updateToolbarState(container) {
    if (!jspreadsheetInstance) return;
    const toolbar = container.querySelector('.jexcel_toolbar') || container.querySelector('.jspreadsheet_toolbar');
    if (!toolbar) return;
    
    const items = toolbar.querySelectorAll('i');
    let undoBtn, redoBtn;
    items.forEach(icon => {
        if (icon.textContent.trim() === 'undo') undoBtn = icon;
        if (icon.textContent.trim() === 'redo') redoBtn = icon;
    });
    
    if (undoBtn && redoBtn) {
        // インスタンスから確実な履歴状態を取得
        const instance = container.jexcel || jspreadsheetInstance;
        const history = instance.history || [];
        const historyIndex = instance.historyIndex !== undefined ? instance.historyIndex : -1;
        
        const canUndo = history.length > 0 && historyIndex >= 0;
        const canRedo = history.length > 0 && historyIndex < history.length - 1;

        // 見た目だけをグレーアウトする
        undoBtn.style.opacity = canUndo ? '1' : '0.3';
        undoBtn.style.cursor = canUndo ? 'pointer' : 'default';
        undoBtn.style.pointerEvents = canUndo ? 'auto' : 'none';
        
        redoBtn.style.opacity = canRedo ? '1' : '0.3';
        redoBtn.style.cursor = canRedo ? 'pointer' : 'default';
        redoBtn.style.pointerEvents = canRedo ? 'auto' : 'none';
    }
}

export function triggerToolbarUpdate(container) {
    setTimeout(() => updateToolbarState(container), 50);
}

function updateFormulaBarFromCell(instance, x, y) {
    if (!formulaBarInput || !selectedCellLabel) return;
    currentCellX = parseInt(x);
    currentCellY = parseInt(y);
    
    if (jspreadsheet.helpers && jspreadsheet.helpers.getColumnName) {
        selectedCellLabel.innerText = jspreadsheet.helpers.getColumnName(currentCellX) + (currentCellY + 1);
    } else {
        selectedCellLabel.innerText = '-';
    }

    if (!isFormulaBarUpdating && document.activeElement !== formulaBarInput) {
        const val = instance.getValueFromCoords(currentCellX, currentCellY);
        formulaBarInput.value = val !== null && val !== undefined ? val : '';
        formulaBarInput.disabled = false;
    }
}

function updateStatusBar(instance) {
    const avgEl = document.getElementById('statusAverage');
    const countEl = document.getElementById('statusCount');
    const sumEl = document.getElementById('statusSum');
    const avgValEl = document.getElementById('statusAverageVal');
    const countValEl = document.getElementById('statusCountVal');
    const sumValEl = document.getElementById('statusSumVal');

    if (!avgEl || !countEl || !sumEl) return;

    let sum = 0;
    let countNum = 0;
    let countTotal = 0;

    const selection = instance.selectedCell;
    if (selection) {
        const minX = Math.min(parseInt(selection[0]), parseInt(selection[2]));
        const maxX = Math.max(parseInt(selection[0]), parseInt(selection[2]));
        const minY = Math.min(parseInt(selection[1]), parseInt(selection[3]));
        const maxY = Math.max(parseInt(selection[1]), parseInt(selection[3]));

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const val = instance.getValueFromCoords(x, y);
                // null, undefined, 空文字 以外をカウント
                if (val !== null && val !== undefined && String(val).trim() !== '') {
                    countTotal++;
                    const num = Number(val);
                    if (!isNaN(num)) {
                        sum += num;
                        countNum++;
                    }
                }
            }
        }
    }

    if (countTotal > 1) { // 複数セル選択時のみ表示
        countEl.classList.remove('hidden');
        countValEl.innerText = countTotal;

        if (countNum > 0) {
            sumEl.classList.remove('hidden');
            // 小数第4位くらいまで表示
            sumValEl.innerText = sum.toLocaleString(undefined, { maximumFractionDigits: 4 });
            
            avgEl.classList.remove('hidden');
            const avg = sum / countNum;
            avgValEl.innerText = avg.toLocaleString(undefined, { maximumFractionDigits: 4 });
        } else {
            sumEl.classList.add('hidden');
            avgEl.classList.add('hidden');
        }
    } else {
        avgEl.classList.add('hidden');
        countEl.classList.add('hidden');
        sumEl.classList.add('hidden');
    }
}

// ==========================================
// JSpreadsheet 設定オブジェクトの生成
// ==========================================
function buildSpreadsheetConfig(container, tableData, originalFields) {
    const columnsConfig = originalFields.map(field => ({
        title: field.name,
        type: 'text',
        width: Math.max(100, field.name.length * 15)
    }));

    return {
        data: tableData,
        columns: columnsConfig,
        defaultColWidth: 150,
        tableOverflow: true,
        tableWidth: '100%',
        tableHeight: 'calc(100vh - 100px)', // ヘッダーと数式バー分を引いた高さ
        rowResize: true,
        columnDrag: true,
        columnSorting: false, // JSpreadsheet標準のソートを無効化（独自実装するため）
        wordWrap: false,
        parseFormulas: false,
        sorting: function(direction) {
            const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });
            return function(a, b) {
                const valA = String(a[1] || '');
                const valB = String(b[1] || '');
                return direction === 0 
                    ? collator.compare(valA, valB) 
                    : collator.compare(valB, valA);
            };
        },
        toolbar: [
            {
                type: 'i',
                content: 'undo',
                onclick: function() { 
                    const instance = container.jexcel || jspreadsheetInstance;
                    if (instance.history && instance.historyIndex >= 0) {
                        instance.undo(); 
                    }
                    triggerToolbarUpdate(container); 
                }
            },
            {
                type: 'i',
                content: 'redo',
                onclick: function() { 
                    const instance = container.jexcel || jspreadsheetInstance;
                    if (instance.history && instance.historyIndex < instance.history.length - 1) {
                        instance.redo(); 
                    }
                    triggerToolbarUpdate(container); 
                }
            }
        ],
        contextMenu: function(obj, x, y, e) {
            const items = [];
            if (obj.selectedCell === null) {
                obj.updateSelectionFromCoords(x || 0, y || 0);
            }

            if (y === null) {
                let startCol = parseInt(x);
                let numOfCols = 1;
                if (obj.selectedCell) {
                    const minX = Math.min(parseInt(obj.selectedCell[0]), parseInt(obj.selectedCell[2]));
                    const maxX = Math.max(parseInt(obj.selectedCell[0]), parseInt(obj.selectedCell[2]));
                    if (startCol >= minX && startCol <= maxX) {
                        startCol = minX;
                        numOfCols = maxX - minX + 1;
                    }
                }
                
                items.push({
                    title: '昇順で並べ替え (A→Z)',
                    onclick: function() { obj.orderBy(parseInt(x), 0); triggerToolbarUpdate(container); }
                });
                items.push({
                    title: '降順で並べ替え (Z→A)',
                    onclick: function() { obj.orderBy(parseInt(x), 1); triggerToolbarUpdate(container); }
                });
                items.push({ type: 'line' });
                items.push({
                    title: '列名を変更する',
                    onclick: function() {
                        const currentTitle = obj.getHeader(x);
                        showPrompt("列名の変更", "新しい列名を入力してください:", currentTitle, (newTitle) => {
                            if (newTitle !== undefined && newTitle !== null && newTitle.trim() !== '') {
                                obj.setHeader(x, newTitle.trim());
                                triggerToolbarUpdate(container);
                            }
                        });
                    }
                });
                items.push({ title: '左に列を挿入', onclick: function() { obj.insertColumn(1, parseInt(x), 1); } });
                items.push({ title: '右に列を挿入', onclick: function() { obj.insertColumn(1, parseInt(x), 0); } });
                items.push({ 
                    title: numOfCols > 1 ? `選択した ${numOfCols}列 を削除` : '選択した列を削除', 
                    onclick: function() { obj.deleteColumn(startCol, numOfCols); } 
                });
            } else if (x === null) {
                let startRow = parseInt(y);
                let numOfRows = 1;
                if (obj.selectedCell) {
                    const minY = Math.min(parseInt(obj.selectedCell[1]), parseInt(obj.selectedCell[3]));
                    const maxY = Math.max(parseInt(obj.selectedCell[1]), parseInt(obj.selectedCell[3]));
                    if (startRow >= minY && startRow <= maxY) {
                        startRow = minY;
                        numOfRows = maxY - minY + 1;
                    }
                }

                items.push({ title: '上に行を挿入', onclick: function() { obj.insertRow(1, parseInt(y), 1); } });
                items.push({ title: '下に行を挿入', onclick: function() { obj.insertRow(1, parseInt(y), 0); } });
                items.push({ 
                    title: numOfRows > 1 ? `選択した ${numOfRows}行 を削除` : '選択した行を削除', 
                    onclick: function() { obj.deleteRow(startRow, numOfRows); } 
                });
            } else {
                items.push({ title: 'コピー', onclick: function() { obj.copy(true); } });
                items.push({ title: '貼り付け', onclick: function() { 
                    navigator.clipboard.readText().then(text => {
                        let pasteX = x;
                        let pasteY = y;
                        if (obj.selectedCell) {
                            pasteX = Math.min(parseInt(obj.selectedCell[0]), parseInt(obj.selectedCell[2]));
                            pasteY = Math.min(parseInt(obj.selectedCell[1]), parseInt(obj.selectedCell[3]));
                        }
                        obj.paste(pasteX, pasteY, text);
                    });
                } });
            }
            return items;
        },
        onchange: (el, cell, x, y, value) => {
            triggerToolbarUpdate(container);
            if (currentCellX == x && currentCellY == y) {
                if (formulaBarInput && !isFormulaBarUpdating && document.activeElement !== formulaBarInput) {
                    formulaBarInput.value = value !== null && value !== undefined ? value : '';
                }
            }
            updateStatusBar(el.jexcel || jspreadsheetInstance);
        },
        onundo: (el) => {
            triggerToolbarUpdate(container);
            const instance = el.jexcel || jspreadsheetInstance;
            if (currentCellX !== null && currentCellY !== null) updateFormulaBarFromCell(instance, currentCellX, currentCellY);
            updateStatusBar(instance);
        },
        onredo: (el) => {
            triggerToolbarUpdate(container);
            const instance = el.jexcel || jspreadsheetInstance;
            if (currentCellX !== null && currentCellY !== null) updateFormulaBarFromCell(instance, currentCellX, currentCellY);
            updateStatusBar(instance);
        },
        oninsertrow: (el) => {
            triggerToolbarUpdate(container);
            const instance = el.jexcel || jspreadsheetInstance;
            if (currentCellX !== null && currentCellY !== null) updateFormulaBarFromCell(instance, currentCellX, currentCellY);
            updateStatusBar(instance);
        },
        ondeleterow: (el) => {
            triggerToolbarUpdate(container);
            const instance = el.jexcel || jspreadsheetInstance;
            if (currentCellX !== null && currentCellY !== null) updateFormulaBarFromCell(instance, currentCellX, currentCellY);
            updateStatusBar(instance);
        },
        oninsertcolumn: (el) => {
            triggerToolbarUpdate(container);
            const instance = el.jexcel || jspreadsheetInstance;
            if (currentCellX !== null && currentCellY !== null) updateFormulaBarFromCell(instance, currentCellX, currentCellY);
            updateStatusBar(instance);
        },
        ondeletecolumn: (el) => {
            triggerToolbarUpdate(container);
            const instance = el.jexcel || jspreadsheetInstance;
            if (currentCellX !== null && currentCellY !== null) updateFormulaBarFromCell(instance, currentCellX, currentCellY);
            updateStatusBar(instance);
        },
        onmoverow: (el) => {
            triggerToolbarUpdate(container);
            const instance = el.jexcel || jspreadsheetInstance;
            if (currentCellX !== null && currentCellY !== null) updateFormulaBarFromCell(instance, currentCellX, currentCellY);
            updateStatusBar(instance);
        },
        onmovecolumn: (el) => {
            triggerToolbarUpdate(container);
            const instance = el.jexcel || jspreadsheetInstance;
            if (currentCellX !== null && currentCellY !== null) updateFormulaBarFromCell(instance, currentCellX, currentCellY);
            updateStatusBar(instance);
        },
        onselection: (el, x1, y1, x2, y2) => {
            triggerToolbarUpdate(container);
            const instance = el.jexcel || jspreadsheetInstance;
            updateFormulaBarFromCell(instance, x1, y1);
            updateStatusBar(instance);
        }
    };
}

// ==========================================
// カスタムイベントのバインド
// ==========================================
function setupEditorEvents(container) {
    if (container.dataset.eventsBound) return;
    container.dataset.eventsBound = "true";
    
    container.addEventListener('mousedown', function(e) {
        if (e.target.tagName === 'TD' && e.target.closest('thead')) {
            const x = e.target.getAttribute('data-x');
            if (x !== null) {
                const rect = e.target.getBoundingClientRect();
                // 右端24pxの範囲（↓アイコン部分）をクリックした場合ソートを実行
                if (e.clientX > rect.right - 24) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const instance = container.jexcel || jspreadsheetInstance;
                    instance.orderBy(parseInt(x));
                    triggerToolbarUpdate(container);
                }
            }
        }
    }, true);

    container.addEventListener('dblclick', function(e) {
        if (e.target.tagName === 'TD' && e.target.closest('thead')) {
            const x = e.target.getAttribute('data-x');
            if (x !== null) {
                const instance = container.jexcel || jspreadsheetInstance;
                const currentTitle = instance.getHeader(parseInt(x));
                
                showPrompt("列名の変更", "新しい列名を入力してください:", currentTitle, (newTitle) => {
                    if (newTitle !== undefined && newTitle !== null && newTitle.trim() !== '') {
                        instance.setHeader(parseInt(x), newTitle.trim());
                        triggerToolbarUpdate(container);
                    }
                });
            }
        }
    });
}

// ==========================================
// JSpreadsheet CE v4 のソートUndo/Redoバグ修正パッチ
// ==========================================
function applyJSpreadsheetPatches(instance) {
    const originalSetHistory = instance.setHistory;
    instance.setHistory = function(changes) {
        if (changes && changes.action === 'orderBy') {
            // 変更前のソート状態を記録する
            let prevCol = null;
            let prevDir = null;
            for (let i = 0; i < this.headers.length; i++) {
                if (this.headers[i].classList.contains('arrow-down')) {
                    prevCol = i; prevDir = 0; break;
                } else if (this.headers[i].classList.contains('arrow-up')) {
                    prevCol = i; prevDir = 1; break;
                }
            }
            changes.previousSortColumn = prevCol;
            changes.previousSortDirection = prevDir;
        }
        originalSetHistory.call(this, changes);
    };

    const originalUndo = instance.undo;
    instance.undo = function() {
        const hIndex = this.historyIndex;
        if (hIndex >= 0) {
            const action = this.history[hIndex];
            originalUndo.call(this);
            
            if (action && action.action === 'orderBy') {
                // JSpreadsheetの誤った矢印復元を上書きして、正しい以前の状態に戻す
                for (let i = 0; i < this.headers.length; i++) {
                    this.headers[i].classList.remove('arrow-up', 'arrow-down');
                }
                if (action.previousSortColumn !== null && action.previousSortColumn !== undefined) {
                    const cls = action.previousSortDirection === 0 ? 'arrow-down' : 'arrow-up';
                    this.headers[action.previousSortColumn].classList.add(cls);
                }
            }
        }
    };

    const originalRedo = instance.redo;
    instance.redo = function() {
        const hIndex = this.historyIndex;
        if (hIndex < this.history.length - 1) {
            const action = this.history[hIndex + 1];
            originalRedo.call(this);
            
            if (action && action.action === 'orderBy') {
                for (let i = 0; i < this.headers.length; i++) {
                    this.headers[i].classList.remove('arrow-up', 'arrow-down');
                }
                const cls = action.order === 0 ? 'arrow-down' : 'arrow-up';
                this.headers[action.column].classList.add(cls);
            }
        }
    };
}

// ==========================================
// エディタの初期化と破棄
// ==========================================
export function initEditor(container, tableData, originalFields) {
    if (jspreadsheetInstance) {
        jspreadsheetInstance.destroy();
        container.innerHTML = '';
    }

    formulaBarInput = document.getElementById('formulaBar');
    selectedCellLabel = document.getElementById('selectedCellLabel');
    currentCellX = null;
    currentCellY = null;

    const config = buildSpreadsheetConfig(container, tableData, originalFields);
    const jspreadsheetInit = typeof jspreadsheet === 'function' ? jspreadsheet : jspreadsheet.default;

    jspreadsheetInstance = jspreadsheetInit(container, config);
    
    if (formulaBarInput) {
        formulaBarInput.disabled = true;
        formulaBarInput.value = '';
        if (selectedCellLabel) selectedCellLabel.innerText = '-';

        let editingCellX = null;
        let editingCellY = null;
        let moveDownOnBlur = false;

        formulaBarInput.onfocus = () => {
            editingCellX = currentCellX;
            editingCellY = currentCellY;
        };

        const applyValue = () => {
            const x = editingCellX !== null ? editingCellX : currentCellX;
            const y = editingCellY !== null ? editingCellY : currentCellY;
            if (jspreadsheetInstance && x !== null && y !== null) {
                const currentVal = jspreadsheetInstance.getValueFromCoords(x, y);
                if (currentVal != formulaBarInput.value) {
                    isFormulaBarUpdating = true;
                    jspreadsheetInstance.setValueFromCoords(x, y, formulaBarInput.value);
                    isFormulaBarUpdating = false;
                }
            }
        };

        formulaBarInput.onkeydown = (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                e.preventDefault();
                moveDownOnBlur = true;
                formulaBarInput.blur();
            }
        };

        formulaBarInput.onblur = () => {
            applyValue();
            
            const prevX = editingCellX !== null ? editingCellX : currentCellX;
            const prevY = editingCellY !== null ? editingCellY : currentCellY;
            
            editingCellX = null;
            editingCellY = null;

            // 他のセルをクリックしてフォーカスが外れた場合、表示を新しいセルに同期させる
            if (jspreadsheetInstance && currentCellX !== null && currentCellY !== null) {
                const val = jspreadsheetInstance.getValueFromCoords(currentCellX, currentCellY);
                formulaBarInput.value = val !== null && val !== undefined ? val : '';
            }

            if (moveDownOnBlur) {
                moveDownOnBlur = false;
                if (jspreadsheetInstance && prevX !== null && prevY !== null) {
                    const nextY = prevY + 1;
                    const maxRows = jspreadsheetInstance.options.data.length;
                    if (nextY < maxRows) {
                        jspreadsheetInstance.updateSelectionFromCoords(prevX, nextY, prevX, nextY);
                    } else {
                        jspreadsheetInstance.updateSelectionFromCoords(prevX, prevY, prevX, prevY);
                    }
                }
            }
        };
        
        formulaBarInput.onchange = null;
    }

    setupEditorEvents(container);
    applyJSpreadsheetPatches(jspreadsheetInstance);
    triggerToolbarUpdate(container);

    return jspreadsheetInstance;
}

export function destroyEditor(container) {
    if (jspreadsheetInstance) {
        jspreadsheetInstance.destroy();
        jspreadsheetInstance = null;
    }
    container.innerHTML = '';
    if (formulaBarInput) {
        formulaBarInput.disabled = true;
        formulaBarInput.value = '';
        if (selectedCellLabel) selectedCellLabel.innerText = '-';
    }
}

export function getEditorInstance() {
    return jspreadsheetInstance;
}
