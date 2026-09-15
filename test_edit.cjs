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

const originalUndo = s.undo;
s.undo = function() {
    const hIndex = this.historyIndex;
    if (hIndex >= 0) {
        const action = this.history[hIndex];
        originalUndo.call(this);
        if (action && action.action === 'orderBy') {
            console.log('Fixed arrows');
        }
    }
};

s.setValue('A1', 'B');
console.log('After set:', s.options.data[0][0]);
s.undo();
console.log('After undo:', s.options.data[0][0]);
