import { DBFHandler } from './src/core/dbf-handler.js';
import * as EncodingPkg from 'encoding-japanese';
const Encoding = EncodingPkg.default || EncodingPkg;

const data = [['値1']];
const headers = ['日本語ヘッダ'];
const originalFields = [];

const blob = DBFHandler.write(data, headers, '932', originalFields);

blob.arrayBuffer().then(buffer => {
    const parsed = DBFHandler.parse(buffer, '932');
    console.log('Parsed Fields:', parsed.fields);
    console.log('Parsed Data:', parsed.data);
});
