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
        
        redoBtn.style.opacity = canRedo ? '1' : '0.3';
        redoBtn.style.cursor = canRedo ? 'pointer' : 'default';
    }
}

export function triggerToolbarUpdate(container) {
    setTimeout(() => updateToolbarState(container), 50);
}

// ==========================================
// エディタの初期化
// ==========================================
export function initEditor(container, tableData, originalFields) {
    // 既存のエディタがあれば破棄
    if (jspreadsheetInstance) {
        jspreadsheetInstance.destroy();
        container.innerHTML = '';
    }

    // 列の表示設定を生成
    const columnsConfig = originalFields.map(field => ({
        title: field.name,
        width: Math.max(100, field.name.length * 15)
    }));

    const jspreadsheetInit = typeof jspreadsheet === 'function' ? jspreadsheet : jspreadsheet.default;

    // JSpreadsheetの初期化
    jspreadsheetInstance = jspreadsheetInit(container, {
        data: tableData,
        columns: columnsConfig,
        defaultColWidth: 150,
        tableOverflow: true,
        tableWidth: '100%',
        tableHeight: 'calc(100vh - 64px)', // ヘッダー分を引いた高さ
        rowResize: true,
        columnDrag: true,
        wordWrap: false,
        toolbar: [
            {
                type: 'i',
                content: 'undo',
                onclick: function() { 
                    const instance = container.jexcel || jspreadsheetInstance;
                    // 履歴がある時のみ元に戻す
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
                    // やり直せる履歴がある時のみやり直す
                    if (instance.history && instance.historyIndex < instance.history.length - 1) {
                        instance.redo(); 
                    }
                    triggerToolbarUpdate(container); 
                }
            }
        ],
        // カスタム右クリックメニュー
        contextMenu: function(obj, x, y, e) {
            const items = [];
            // 未選択状態で右クリックされた場合のエラー対策
            if (obj.selectedCell === null) {
                obj.updateSelectionFromCoords(x || 0, y || 0);
            }

            if (y === null) {
                // 列ヘッダーを右クリック
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
                // 行番号を右クリック
                items.push({ title: '上に行を挿入', onclick: function() { obj.insertRow(1, parseInt(y), 1); } });
                items.push({ title: '選択した行を削除', onclick: function() { obj.deleteRow(parseInt(y), 1); } });
            } else {
                // 通常のセルを右クリック
                items.push({ title: 'コピー', onclick: function() { obj.copy(); } });
                items.push({ title: '貼り付け', onclick: function() { navigator.clipboard.readText().then(text => obj.paste(x, y, text)); } });
            }
            return items;
        },
        // データ変更時にツールバー状態を更新
        onchange: () => triggerToolbarUpdate(container),
        onundo: () => triggerToolbarUpdate(container),
        onredo: () => triggerToolbarUpdate(container),
        oninsertrow: () => triggerToolbarUpdate(container),
        ondeleterow: () => triggerToolbarUpdate(container),
        oninsertcolumn: () => triggerToolbarUpdate(container),
        ondeletecolumn: () => triggerToolbarUpdate(container),
        onmoverow: () => triggerToolbarUpdate(container),
        onmovecolumn: () => triggerToolbarUpdate(container),
        onselection: () => triggerToolbarUpdate(container) // 選択時にも状態チェック
    });

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
