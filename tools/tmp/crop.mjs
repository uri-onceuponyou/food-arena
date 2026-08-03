import sharp from 'sharp';
const [,,src,out,x,y,w,h,scale] = process.argv;
await sharp(src).extract({left:+x,top:+y,width:+w,height:+h}).resize(+w*(+scale||3)).toFile(out);
console.log('ok',out);
