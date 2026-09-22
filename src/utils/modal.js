let customModal, modalContent, modalTitle, modalMessage, modalInput, modalCancel, modalConfirm;
let modalConfirmCallback = null;

export function initModal() {
    customModal = document.getElementById('customModal');
    modalContent = document.getElementById('modalContent');
    modalTitle = document.getElementById('modalTitle');
    modalMessage = document.getElementById('modalMessage');
    modalInput = document.getElementById('modalInput');
    modalCancel = document.getElementById('modalCancel');
    modalConfirm = document.getElementById('modalConfirm');

    // モーダルのイベントリスナー
    modalCancel.addEventListener('click', hideModal);
    modalConfirm.addEventListener('click', () => {
        if (modalConfirmCallback) {
            if (!modalInput.classList.contains('hidden')) {
                modalConfirmCallback(modalInput.value);
            } else {
                modalConfirmCallback();
            }
        }
        hideModal();
    });

    // エンターキーで確定 (IME変換中のEnterは無視する)
    modalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (e.isComposing || e.keyCode === 229) return; // 変換中は発火させない
            e.preventDefault();
            modalConfirm.click();
        }
    });

    // ESCキーでキャンセル (モーダル表示中のみ)
    document.addEventListener('keydown', (e) => {
        if (!customModal.classList.contains('hidden') && e.key === 'Escape') {
            hideModal();
        }
    });
}

export function showModal(title, message, isAlert, isPrompt, defaultValue, callback) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalConfirmCallback = callback;
    
    // プロンプト（入力）モードの切り替え
    if (isPrompt) {
        modalInput.value = defaultValue || '';
        modalInput.classList.remove('hidden');
        modalMessage.classList.replace('mb-6', 'mb-4');
    } else {
        modalInput.classList.add('hidden');
        modalInput.value = '';
        modalMessage.classList.replace('mb-4', 'mb-6');
    }

    // アラートモード（キャンセル非表示、OKのみ）の切り替え
    if (isAlert) {
        modalCancel.style.display = 'none';
        modalConfirm.className = "px-4 py-2 rounded-md font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm";
    } else {
        modalCancel.style.display = 'block';
        modalConfirm.className = isPrompt 
            ? "px-4 py-2 rounded-md font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
            : "px-4 py-2 rounded-md font-medium text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm";
    }

    customModal.classList.remove('hidden');
    // アニメーション用
    requestAnimationFrame(() => {
        customModal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        if (isPrompt) {
            modalInput.focus();
            modalInput.select(); // 入力しやすいよう全選択
        }
    });
}

export function hideModal() {
    customModal.classList.add('opacity-0');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        customModal.classList.add('hidden');
        modalConfirmCallback = null;
    }, 200);
}

// 呼び出し用ヘルパー関数
export function showAlert(message) { showModal("お知らせ", message, true, false, null, null); }
export function showConfirm(message, callback) { showModal("確認", message, false, false, null, callback); }
export function showPrompt(title, message, defaultValue, callback) { showModal(title, message, false, true, defaultValue, callback); }

// エンコーディング選択モーダル
let encodingModalCallback = null;
let encodingKeyDownHandler = null;

export function showEncodingPrompt(defaultEncoding, callback) {
    const encModal = document.getElementById('encodingModal');
    const encContent = document.getElementById('encodingModalContent');
    const btnSjis = document.getElementById('btnEncodingSjis');
    const btnUtf8 = document.getElementById('btnEncodingUtf8');
    const btnCancel = document.getElementById('encodingModalCancel');

    encodingModalCallback = callback;
    let currentSelected = defaultEncoding === '932' ? '932' : 'UTF8';

    const updateVisuals = () => {
        const activeClass = "w-full px-4 py-3 rounded-md font-bold text-blue-800 bg-blue-100 border-2 border-blue-500 shadow-md relative flex justify-center items-center transition-all";
        const inactiveClass = "w-full px-4 py-3 rounded-md font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-300 transition-all shadow-sm flex justify-center items-center";
        
        if (currentSelected === '932') {
            btnSjis.className = activeClass;
            btnSjis.innerHTML = `Shift-JIS (日本語) <span class="material-icons text-blue-500 absolute right-4">check_circle</span>`;
            btnUtf8.className = inactiveClass;
            btnUtf8.innerHTML = `UTF-8`;
        } else {
            btnUtf8.className = activeClass;
            btnUtf8.innerHTML = `UTF-8 <span class="material-icons text-blue-500 absolute right-4">check_circle</span>`;
            btnSjis.className = inactiveClass;
            btnSjis.innerHTML = `Shift-JIS (日本語)`;
        }
    };

    const hide = () => {
        encModal.classList.add('opacity-0');
        encContent.classList.add('scale-95');
        if (encodingKeyDownHandler) {
            document.removeEventListener('keydown', encodingKeyDownHandler);
            encodingKeyDownHandler = null;
        }
        setTimeout(() => encModal.classList.add('hidden'), 200);
    };

    const handleSjis = () => { hide(); if(encodingModalCallback) encodingModalCallback('932'); encodingModalCallback = null; };
    const handleUtf8 = () => { hide(); if(encodingModalCallback) encodingModalCallback('UTF8'); encodingModalCallback = null; };
    const handleCancel = () => { hide(); encodingModalCallback = null; };

    btnSjis.onclick = () => { currentSelected = '932'; updateVisuals(); handleSjis(); };
    btnUtf8.onclick = () => { currentSelected = 'UTF8'; updateVisuals(); handleUtf8(); };
    btnCancel.onclick = handleCancel;

    encodingKeyDownHandler = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (currentSelected === '932') handleSjis();
            else handleUtf8();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            currentSelected = currentSelected === '932' ? 'UTF8' : '932';
            updateVisuals();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
    };
    document.addEventListener('keydown', encodingKeyDownHandler);

    updateVisuals();
    encModal.classList.remove('hidden');
    requestAnimationFrame(() => {
        encModal.classList.remove('opacity-0');
        encContent.classList.remove('scale-95');
    });
}
