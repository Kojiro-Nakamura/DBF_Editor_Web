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
