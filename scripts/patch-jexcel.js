const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'node_modules', 'jspreadsheet-ce', 'dist', 'index.js');

if (fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf8');

    // リサイズの当たり判定を 6px から 15px に拡張するパッチ
    code = code.replace(/d\.width-\(e\.clientX-d\.left\)<6/g, 'd.width-(e.clientX-d.left)<15');
    code = code.replace(/n\.width-e\.offsetX<6/g, 'n.width-e.offsetX<15');
    code = code.replace(/d\.height-\(e\.clientY-d\.top\)<6/g, 'd.height-(e.clientY-d.top)<15');
    code = code.replace(/n\.height-e\.offsetY<6/g, 'n.height-e.offsetY<15');

    fs.writeFileSync(file, code);
    console.log('Successfully patched jspreadsheet-ce for 15px resize hit area.');
} else {
    console.log('jspreadsheet-ce not found, skipping patch.');
}
