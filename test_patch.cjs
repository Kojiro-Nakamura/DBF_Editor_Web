const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const dom = new JSDOM('<html><body><div id="app"></div></body></html>', { runScripts: 'dangerously' });
global.window = dom.window;
global.document = dom.window.document;
global.Element = dom.window.Element;
global.HTMLElement = dom.window.HTMLElement;
global.Event = dom.window.Event;
const jexcel = require('jspreadsheet-ce');
const s = jexcel(document.getElementById('app'), { data: [['A']], columns: [{type: 'text'}] });

const originalSetHistory = s.setHistory;
let patchedCalled = false;
s.setHistory = function(changes) {
    patchedCalled = true;
    if (changes && changes.action === 'orderBy') {
        changes.previousSortColumn = 123;
    }
    originalSetHistory.call(this, changes);
};

s.orderBy(0);
console.log('Patched setHistory called?', patchedCalled);
console.log('Action recorded:', s.history[s.historyIndex]);
