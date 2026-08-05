import sharp from 'sharp';
const [,, src, out, l,t,w,h, scale] = process.argv;
await sharp(src).extract({left:+l, top:+t, width:+w, height:+h}).resize(+w*(+scale||2), +h*(+scale||2), {kernel:'nearest'}).toFile(out);
console.log('ok', out);
