import sharp from 'sharp';
const jobs=[
 ['shots/perpart/head/ours.png',{left:250,top:170,width:460,height:360},'/private/tmp/claude-501/-Users-uribishansky-claude-code-food-arena/1bd29668-4fb1-44d6-9466-5543df71f454/scratchpad/zoom_ours_face.png'],
 ['shots/perpart/head/ref.png',{left:280,top:330,width:520,height:400},'/private/tmp/claude-501/-Users-uribishansky-claude-code-food-arena/1bd29668-4fb1-44d6-9466-5543df71f454/scratchpad/zoom_ref_face.png'],
];
for(const [src,r,out] of jobs){
  await sharp(src).extract(r).resize({width:900,kernel:'nearest'}).png().toFile(out);
  console.log('wrote',out);
}
