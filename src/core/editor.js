import jSuites from 'jsuites';
window.jSuites = jSuites;
import jspreadsheet from 'jspreadsheet-ce';
import { showPrompt } from '../utils/modal.js';

let jspreadsheetInstance = null;

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
        if (icon.textContent.trim() === 'undo') undoBtn = icon.parentElement;
        if (icon.textContent.trim() === 'redo') redoBtn = icon.parentElement;
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
        tableHeight: 'calc(100vh - 64px)', // ヘッダー分を引いた高さ
        rowResize: true,
        columnDrag: true,
        columnSorting: false, // JSpreadsheet標準のソートを無効化（独自実装するため）
        wordWrap: false,
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
                items.push({ title: '選択した列を削除', onclick: function() { obj.deleteColumn(parseInt(x)); } });
            } else if (x === null) {
                items.push({ title: '上に行を挿入', onclick: function() { obj.insertRow(1, parseInt(y), 1); } });
                items.push({ title: '選択した行を削除', onclick: function() { obj.deleteRow(parseInt(y), 1); } });
            } else {
                items.push({ title: 'コピー', onclick: function() { obj.copy(); } });
                items.push({ title: '貼り付け', onclick: function() { navigator.clipboard.readText().then(text => obj.paste(x, y, text)); } });
            }
            return items;
        },
        onchange: () => triggerToolbarUpdate(container),
        onundo: () => triggerToolbarUpdate(container),
        onredo: () => triggerToolbarUpdate(container),
        oninsertrow: () => triggerToolbarUpdate(container),
        ondeleterow: () => triggerToolbarUpdate(container),
        oninsertcolumn: () => triggerToolbarUpdate(container),
        ondeletecolumn: () => triggerToolbarUpdate(container),
        onmoverow: () => triggerToolbarUpdate(container),
        onmovecolumn: () => triggerToolbarUpdate(container),
        onselection: () => triggerToolbarUpdate(container)
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

    const config = buildSpreadsheetConfig(container, tableData, originalFields);
    const jspreadsheetInit = typeof jspreadsheet === 'function' ? jspreadsheet : jspreadsheet.default;

    jspreadsheetInstance = jspreadsheetInit(container, config);
    
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
}

export function getEditorInstance() {
    return jspreadsheetInstance;
}
