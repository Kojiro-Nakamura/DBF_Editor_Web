import { initModal, showAlert, showConfirm } from './utils/modal.js';
import { DBFHandler } from './core/dbf-handler.js';
import { initEditor, destroyEditor, getEditorInstance, triggerToolbarUpdate } from './core/editor.js';

// ==========================================
// DOM要素の取得
// ==========================================
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const headerOpenBtn = document.getElementById('headerOpenBtn');
const uploadSection = document.getElementById('uploadSection');
const editorSection = document.getElementById('editorSection');
const spreadsheetContainer = document.getElementById('spreadsheet');
const actionButtons = document.getElementById('actionButtons');
const closeBtn = document.getElementById('closeBtn');
const saveBtn = document.getElementById('saveBtn');
const encodingSelect = document.getElementById('encodingSelect');
const loading = document.getElementById('loading');

let currentFileName = '';
let originalFields = []; 

function showLoading() { loading.classList.remove('hidden'); }
function hideLoading() { loading.classList.add('hidden'); }

// ==========================================
// 初期化
// ==========================================
initModal();

// ツールバーの更新をキー操作やクリックにもバインド
document.addEventListener('keyup', () => triggerToolbarUpdate(spreadsheetContainer));
document.addEventListener('mouseup', () => triggerToolbarUpdate(spreadsheetContainer));

// イベントリスナーの登録
headerOpenBtn.addEventListener('click', () => {
    if (!editorSection.classList.contains('hidden')) {
        showConfirm("編集中のデータは破棄されます。\n新しいファイルを開きますか？", () => {
            fileInput.value = '';
            fileInput.click();
        });
    } else {
        fileInput.value = '';
        fileInput.click();
    }
});
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) processFile(e.target.files[0]);
});
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-blue-500', 'bg-blue-50');
});
dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-500', 'bg-blue-50');
});
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-500', 'bg-blue-50');
    if (e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0]);
});

saveBtn.addEventListener('click', saveDbfFile);
closeBtn.addEventListener('click', closeEditor);

// ==========================================
// ファイル操作・UI制御
// ==========================================
async function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
        reader.readAsArrayBuffer(file);
    });
}

async function processFile(file) {
    if (!file.name.toLowerCase().endsWith('.dbf')) {
        showAlert("DBFファイルを選択してください。");
        return;
    }
    
    currentFileName = file.name;
    showLoading();

    try {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const encoding = encodingSelect.value;
        const parsed = DBFHandler.parse(arrayBuffer, encoding);
        
        originalFields = parsed.fields;
        let tableData = parsed.data;

        // データが空の場合の安全対策（1行分だけ空枠を作る）
        if (tableData.length === 0) {
            tableData = [Array(originalFields.length).fill("")];
        }

        // 先に画面を切り替えてから初期化（JSpreadsheetが正しいサイズを計算できるようにするため）
        uploadSection.classList.add('hidden');
        editorSection.classList.remove('hidden');
        actionButtons.classList.remove('hidden');

        // エディタを初期化
        initEditor(spreadsheetContainer, tableData, originalFields);
        
        // 初期表示時のボタン状態反映
        triggerToolbarUpdate(spreadsheetContainer);

    } catch (err) {
        console.error(err);
        showAlert("ファイルの読み込み中にエラーが発生しました。\n" + err.message);
    } finally {
        hideLoading();
    }
}

// 保存処理
function saveDbfFile() {
    const instance = getEditorInstance();
    if (!instance) return;
    showLoading();

    try {
        // 現在のデータを取得
        const data = instance.getData();
        // 現在のヘッダー名を取得
        const headers = instance.getHeaders().split(',');
        
        // DBFバイナリを生成
        const encoding = encodingSelect.value;
        const blob = DBFHandler.write(data, headers, encoding, originalFields);

        // ダウンロード処理
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentFileName || 'export.dbf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showAlert("保存が完了しました。");
    } catch (err) {
        console.error(err);
        showAlert("保存中にエラーが発生しました。\n" + err.message);
    } finally {
        hideLoading();
    }
}

// 閉じる処理
function closeEditor() {
    showConfirm("編集中のデータは破棄されます。\nエディタを閉じますか？", () => {
        destroyEditor(spreadsheetContainer);
        fileInput.value = '';
        originalFields = [];
        currentFileName = '';

        editorSection.classList.add('hidden');
        actionButtons.classList.add('hidden');
        uploadSection.classList.remove('hidden');
    });
}
