import ExcelJS from 'exceljs';
import {Readable} from 'node:stream';
import {validateXlsxArchive} from './xlsx-safety';
export async function readEmployeeRows(bytes:Buffer,csv=false){
 if(bytes.length>2_000_000)throw new Error('Import file must be below 2 MB.');
 const workbook=new ExcelJS.Workbook();
 if(csv)await workbook.csv.read(Readable.from(bytes));else{validateXlsxArchive(bytes);await workbook.xlsx.load(bytes as any);}
 const sheet=workbook.worksheets[0];if(!sheet)throw new Error('Workbook has no sheets.');
 if(sheet.rowCount>2001||sheet.columnCount>32)throw new Error('Import supports up to 2000 employees and 32 columns.');
 const headers:string[]=[];sheet.getRow(1).eachCell((cell,col)=>{headers[col]=cell.text.trim();});
 if(headers.some(h=>h==='__proto__'||h==='prototype'||h==='constructor'))throw new Error('Invalid column name.');
 const rows:any[]=[];for(let n=2;n<=sheet.rowCount;n++){
  const row:Record<string,string>=Object.create(null);let populated=false;
  for(let col=1;col<=sheet.columnCount;col++){const h=headers[col];if(!h)continue;const cell=sheet.getRow(n).getCell(col);if(cell.type===ExcelJS.ValueType.Formula)throw new Error(`Row ${n}: use values instead of formulas.`);const text=cell.text;if(text.length>10000)throw new Error('Import cell is too large.');row[h]=text;if(text.trim())populated=true;}
  if(populated)rows.push({row:n,values:row});
 }return rows;
}
export async function writeWorkbook(sheets:{name:string;rows:any[]|any[][]}[]){
 const book=new ExcelJS.Workbook();
 for(const spec of sheets){const sheet=book.addWorksheet(spec.name);
  if(Array.isArray(spec.rows[0]))sheet.addRows(spec.rows);
  else{const keys=[...new Set(spec.rows.flatMap(row=>Object.keys(row)))];sheet.columns=keys.map(key=>({header:key,key,width:Math.min(50,Math.max(14,key.length+2))}));for(const row of spec.rows)sheet.addRow(row);}
  if(sheet.rowCount){sheet.getRow(1).font={bold:true};sheet.views=[{state:'frozen',ySplit:1}];}
 }return Buffer.from(await book.xlsx.writeBuffer());
}
export function writeCsv(rows:Record<string,any>[]){
 const headers=[...new Set(rows.flatMap(row=>Object.keys(row)))];
 const quote=(value:any)=>{let text=String(value??'');if(/^[\s]*[=+\-@]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
 return '\uFEFF'+[headers.map(quote).join(','),...rows.map(row=>headers.map(key=>quote(row[key])).join(','))].join('\r\n');
}
