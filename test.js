import puppeteer from 'puppeteer';
import { createServer } from 'http';
import handler from 'serve-handler';

const server = createServer((request, response) => {
  return handler(request, response, { public: 'dist' });
});

server.listen(5000, async () => {
  console.log('Server running on port 5000');
  
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  page.on('response', response => {
      if (!response.ok()) console.log('HTTP ERROR:', response.status(), response.url());
  });
  
  await page.goto('http://localhost:5000/', { waitUntil: 'networkidle0' });
  console.log('Page loaded. Simulating file drop...');
  
  await page.evaluate(async () => {
    return new Promise(resolve => {
        const content = new Uint8Array([0x03, 0x63, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x21, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x4E, 0x41, 0x4D, 0x45, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x43, 0x00, 0x00, 0x00, 0x00, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0D, 0x20, 0x42, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x41, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x43, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x1A]);
        const file = new File([content], 'test.dbf', { type: 'application/x-dbf' });
        
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        
        const event = new DragEvent('drop', { dataTransfer: dataTransfer });
        document.getElementById('dropZone').dispatchEvent(event);
        
        setTimeout(resolve, 500);
    });
  });

  const sortTest = await page.evaluate(async () => {
      const container = document.getElementById('spreadsheet');
      const instance = container.jexcel;
      
      const before = instance.getColumnData(0);
      
      console.log('Columns length:', instance.options.columns.length);
      console.log('Column 0:', instance.options.columns[0]);
      
      instance.orderBy(0, 0); // ASC
      await new Promise(r => setTimeout(r, 100));
      const afterAsc = instance.getColumnData(0);
      
      instance.orderBy(0, 1); // DESC
      await new Promise(r => setTimeout(r, 100));
      const afterDesc = instance.getColumnData(0);
      
      return { before, afterAsc, afterDesc };
  });
  
  console.log('Sort Test Results:', sortTest);
  
  await browser.close();
  server.close();
});
