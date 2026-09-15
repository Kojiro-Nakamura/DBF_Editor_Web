import * as EncodingPkg from 'encoding-japanese';
const Encoding = EncodingPkg.default || EncodingPkg;

export const DBFHandler = {
    // DBFバイナリからデータを読み取る
    parse: function(arrayBuffer, encoding) {
        const view = new DataView(arrayBuffer);
        const byteLength = arrayBuffer.byteLength;
        
        // ファイルサイズが小さすぎる場合のチェック
        if (byteLength < 32) {
            throw new Error("ファイルサイズが小さすぎます。不正なDBFファイルです。");
        }

        const numRecords = view.getUint32(4, true);
        const headerBytes = view.getUint16(8, true);
        
        // ヘッダーサイズがファイルサイズを超える場合のチェック
        if (headerBytes > byteLength) {
            throw new Error("ヘッダーサイズが不正です。ファイルが破損している可能性があります。");
        }
        
        let offset = 32;
        const fields = [];
        // フィールド（列）定義の読み込み
        while (offset < headerBytes - 1) {
            if (offset + 32 > byteLength) break; // 安全対策: バッファオーバーラン防止

            const fieldNameBytes = new Uint8Array(arrayBuffer, offset, 11);
            let nameLen = 0;
            while (nameLen < 11 && fieldNameBytes[nameLen] !== 0) nameLen++;
            const fieldName = new TextDecoder('ascii').decode(fieldNameBytes.subarray(0, nameLen));

            fields.push({
                name: fieldName,
                type: String.fromCharCode(view.getUint8(offset + 11)),
                length: view.getUint8(offset + 16),
                decimal: view.getUint8(offset + 17)
            });
            offset += 32;
        }

        // 実データの読み込み
        const data = [];
        offset = headerBytes;
        const fromEncoding = encoding === '932' ? 'SJIS' : 'UTF8';

        for (let i = 0; i < numRecords; i++) {
            if (offset >= byteLength) break; // 安全対策: ファイル終端に達したらループを抜ける

            const record = [];
            const isDeleted = view.getUint8(offset);
            offset += 1; // 削除フラグ分進める
            
            let isRecordValid = true;
            for (const field of fields) {
                // データが途切れている場合は無効としてループを抜ける
                if (offset + field.length > byteLength) {
                    isRecordValid = false;
                    break; 
                }
                const valueBytes = new Uint8Array(arrayBuffer, offset, field.length);
                // Encoding.js で正しい文字コードに変換して文字列化
                const valueStr = Encoding.codeToString(Encoding.convert(valueBytes, {to: 'UNICODE', from: fromEncoding})).trim();
                record.push(valueStr);
                offset += field.length;
            }
            
            if (!isRecordValid) break; // レコードが途切れていた場合は読み込みを終了

            if (isDeleted !== 0x2A) { // '*' (0x2A) は削除済みレコード
                data.push(record);
            }
        }
        return { fields, data };
    },

    // 編集後のデータから保存用DBFバイナリを作成する
    write: function(data, currentHeaders, encoding, originalFields) {
        const numRecords = data.length;
        
        // 現在の列名に基づいて新しいフィールド定義を作成する（列追加に対応するため）
        const toEncoding = encoding === '932' ? 'SJIS' : 'UTF8';
        const fields = currentHeaders.map((header, colIndex) => {
            const existing = originalFields.find(f => f.name === header);
            if (existing) return existing;

            // 新規追加された列の場合は、データから長さと型を推測する
            let maxLength = 10;
            let isNumeric = true;
            data.forEach(row => {
                const val = String(row[colIndex] || '');
                let byteLen = val.length;
                if(toEncoding === 'SJIS') {
                    byteLen = Encoding.convert(Encoding.stringToCode(val), {to: 'SJIS', from: 'UNICODE'}).length;
                } else {
                    byteLen = new TextEncoder().encode(val).length;
                }
                if (byteLen > maxLength) maxLength = byteLen;
                if (val !== '' && isNaN(Number(val))) isNumeric = false;
            });
            return {
                name: header.substring(0, 10), // DBFの列名は最大10文字
                type: isNumeric ? 'N' : 'C',
                length: Math.min(255, maxLength + 2), // 余白を持たせる
                decimal: 0
            };
        });

        const headerBytes = 32 + (fields.length * 32) + 1;
        let recordBytes = 1;
        fields.forEach(f => recordBytes += f.length);

        const buffer = new ArrayBuffer(headerBytes + (numRecords * recordBytes) + 1);
        const view = new DataView(buffer);
        const uint8Array = new Uint8Array(buffer);

        // 1. DBFファイルヘッダーの作成
        view.setUint8(0, 0x03); // dBase III
        const now = new Date();
        view.setUint8(1, now.getFullYear() - 1900);
        view.setUint8(2, now.getMonth() + 1);
        view.setUint8(3, now.getDate());
        view.setUint32(4, numRecords, true);
        view.setUint16(8, headerBytes, true);
        view.setUint16(10, recordBytes, true);
        view.setUint8(29, encoding === '932' ? 0x13 : 0x00); // 29バイト目 言語ID (0x13 = Shift-JIS)

        // 2. フィールド（列）定義の書き込み
        let offset = 32;
        fields.forEach(field => {
            const nameBytes = new TextEncoder().encode(field.name);
            uint8Array.set(nameBytes, offset);
            view.setUint8(offset + 11, field.type.charCodeAt(0));
            view.setUint8(offset + 16, field.length);
            view.setUint8(offset + 17, field.decimal);
            offset += 32;
        });
        view.setUint8(offset, 0x0D); // ヘッダー終端

        // 3. レコード（実データ）の書き込み
        offset = headerBytes;
        data.forEach(row => {
            view.setUint8(offset, 0x20); // 有効レコードフラグ (Space)
            offset += 1;
            
            fields.forEach((field, i) => {
                let val = row[i] !== undefined && row[i] !== null ? String(row[i]) : '';
                let encodedArray;
                
                if (toEncoding === 'SJIS') {
                    encodedArray = new Uint8Array(Encoding.convert(Encoding.stringToCode(val), {to: 'SJIS', from: 'UNICODE'}));
                } else {
                    encodedArray = new TextEncoder().encode(val);
                }

                // フィールド長に合わせてパディング（空白埋め）
                const finalArray = new Uint8Array(field.length);
                finalArray.fill(0x20);
                
                // 数値型の場合は右寄せ、それ以外は左寄せ
                if (field.type === 'N' || field.type === 'F') {
                    const start = Math.max(0, field.length - encodedArray.length);
                    finalArray.set(encodedArray.slice(0, field.length), start);
                } else {
                    finalArray.set(encodedArray.slice(0, field.length), 0);
                }
                
                uint8Array.set(finalArray, offset);
                offset += field.length;
            });
        });
        view.setUint8(offset, 0x1A); // ファイル終端 (EOF)

        return new Blob([buffer], { type: 'application/x-dbf' });
    }
};
