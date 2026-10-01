import {inflateRawSync} from 'node:zlib';
// Bound the actual inflated XML before handing the archive to the workbook parser.
export function validateXlsxArchive(bytes:Buffer){
 if(bytes.length>2_000_000)throw new Error('Import file must be below 2 MB.');
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}}
 if(end<0)throw new Error('Use an XLSX file. Convert older XLS files to XLSX first.');
 const count=bytes.readUInt16LE(end+10),offset=bytes.readUInt32LE(end+16);if(count>512||offset>=end)throw new Error('Workbook archive is too complex.');
 let pos=offset,total=0;
 for(let i=0;i<count;i++){
  if(pos+46>end||bytes.readUInt32LE(pos)!==0x02014b50)throw new Error('Invalid workbook archive.');
  const flags=bytes.readUInt16LE(pos+8),method=bytes.readUInt16LE(pos+10),size=bytes.readUInt32LE(pos+20),plain=bytes.readUInt32LE(pos+24),local=bytes.readUInt32LE(pos+42);
  if(flags&1||plain===0xffffffff||size===0xffffffff||local+30>offset||bytes.readUInt32LE(local)!==0x04034b50)throw new Error('Unsupported workbook archive.');
  const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);if(start+size>offset)throw new Error('Invalid workbook archive.');
  const data=bytes.subarray(start,start+size),remaining=20_000_000-total;if(remaining<=0)throw new Error('Workbook expands beyond 20 MB.');
  let expanded:Buffer;
  if(method===0){if(data.length>remaining)throw new Error('Workbook expands beyond 20 MB.');expanded=data;}
  else if(method===8){try{expanded=inflateRawSync(data,{maxOutputLength:remaining});}catch{throw new Error('Invalid or oversized workbook archive.');}}
  else throw new Error('Unsupported workbook compression.');
  if(expanded.length!==plain)throw new Error('Invalid workbook entry size.');total+=expanded.length;
  pos+=46+bytes.readUInt16LE(pos+28)+bytes.readUInt16LE(pos+30)+bytes.readUInt16LE(pos+32);
 }
}
