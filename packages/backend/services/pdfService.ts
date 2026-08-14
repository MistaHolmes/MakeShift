import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParseMod = require('pdf-parse');
const pdfParse = pdfParseMod.PDFParse || pdfParseMod;
export async function extractPagesFromPdf(buffer: Buffer): Promise<string[]> {
  const pages: string[] = [];
  
  const render_page = async (pageData: any) => {
    const render_options = { normalizeWhitespace: false, disableCombineTextItems: false };
    const textContent = await pageData.getTextContent(render_options);
    
    let lastY, text = '';
    for (const item of textContent.items) {
      if (lastY == item.transform[5] || !lastY) {
        text += item.str;
      } else {
        text += '\n' + item.str;
      }
      lastY = item.transform[5];
    }
    
    // We add a delimiter just for safety but also store in our array
    pages.push(text.trim());
    return text;
  };

  const options = {
    pagerender: render_page
  };

  await pdfParse(buffer, options);
  
  return pages;
}
