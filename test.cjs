const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const dom = new JSDOM('<html><body><div id="app"></div></body></html>', { runScripts: 'dangerously' });
global.window = dom.window;
global.document = dom.window.document;
global.Element = dom.window.Element;
global.HTMLElement = dom.window.HTMLElement;
global.Event = dom.window.Event;
const jexcel = require('jspreadsheet-ce');
const s = jexcel(document.getElementById('app'), { data: [['C'],['A'],['B']], columns: [{type: 'text'}] });

const originalSetHistory = s.setHistory;
s.setHistory = function(changes) {
    if (changes && changes.action === 'orderBy') {
        let prevCol = null;
        let prevDir = null;
        for (let i = 0; i < this.headers.length; i++) {
            if (this.headers[i].classList.contains('arrow-down')) {
                prevCol = i; prevDir = 0; break;
            } else if (this.headers[i].classList.contains('arrow-up')) {
                prevCol = i; prevDir = 1; break;
            }
        }
        changes.previousSortColumn = prevCol;
        changes.previousSortDirection = prevDir;
    }
    originalSetHistory.call(this, changes);
};

const originalUndo = s.undo;
s.undo = function() {
    const hIndex = this.historyIndex;
    if (hIndex >= 0) {
        const action = this.history[hIndex];
        originalUndo.call(this);
        if (action && action.action === 'orderBy') {
            for (let i = 0; i < this.headers.length; i++) {
                this.headers[i].classList.remove('arrow-up', 'arrow-down');
            }
            if (action.previousSortColumn !== null) {
                const cls = action.previousSortDirection === 0 ? 'arrow-down' : 'arrow-up';
                this.headers[action.previousSortColumn].classList.add(cls);
            }
        }
    }
};

s.orderBy(0);
console.log('After Sort:', s.options.data.map(r=>r[0]), 'Class:', s.headers[0].className);
s.undo();
console.log('After Undo:', s.options.data.map(r=>r[0]), 'Class:', s.headers[0].className);
