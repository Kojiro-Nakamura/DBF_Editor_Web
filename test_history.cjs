const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="spreadsheet"></div></body></html>`, {
    runScripts: "dangerously"
});

const window = dom.window;
const document = window.document;

// JSpreadsheet mock environment
global.window = window;
global.document = document;
global.HTMLElement = window.HTMLElement;
global.navigator = { userAgent: 'node.js' };

const jspreadsheet = require('jspreadsheet-ce');

const container = document.getElementById('spreadsheet');

const instance = jspreadsheet(container, {
    data: [
        ['Test 1', 'Test 2'],
        ['Test 3', 'Test 4']
    ],
    columns: [ { type: 'text', width: 100 }, { type: 'text', width: 100 } ],
    toolbar: [
        { type: 'i', content: 'undo' },
        { type: 'i', content: 'redo' }
    ]
});

console.log("Initial history:", instance.history.length, "index:", instance.historyIndex);

// Simulate cell edit
instance.setValue('A1', 'New Value');

console.log("After edit history:", instance.history.length, "index:", instance.historyIndex);

instance.undo();
console.log("After undo history:", instance.history.length, "index:", instance.historyIndex, "A1 value:", instance.getValue('A1'));

instance.redo();
console.log("After redo history:", instance.history.length, "index:", instance.historyIndex, "A1 value:", instance.getValue('A1'));
