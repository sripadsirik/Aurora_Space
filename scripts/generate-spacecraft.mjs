// Original, procedural glTF assets. Dimensions and attitude are representative.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const target = fileURLToPath(new URL('../frontend/public/models/', import.meta.url));
mkdirSync(target, { recursive: true });
function makeModel(kind) {
  const doc = { asset: { version: '2.0', generator: 'Aurora procedural spacecraft' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: [
    { name: 'Thermal gold', pbrMetallicRoughness: { baseColorFactor: [.72,.43,.12,1], metallicFactor:.65, roughnessFactor:.36 }, emissiveFactor:[.08,.045,.01] },
    { name: 'Solar cells', pbrMetallicRoughness: { baseColorFactor: [.025,.1,.32,1], metallicFactor:.45, roughnessFactor:.27 }, emissiveFactor:[.012,.025,.08] },
    { name: 'Aluminium', pbrMetallicRoughness: { baseColorFactor: [.7,.76,.82,1], metallicFactor:.75, roughnessFactor:.3 }, emissiveFactor:[.04,.05,.06] },
    { name: 'Panel grid', pbrMetallicRoughness: { baseColorFactor: [.3,.53,.75,1], metallicFactor:.4, roughnessFactor:.5 } },
    { name: 'Instrument', pbrMetallicRoughness: { baseColorFactor: [.045,.06,.08,1], metallicFactor:.1, roughnessFactor:.7 } }
  ], accessors: [], bufferViews: [], buffers: [] };
  const chunks = []; let offset=0;
  function accessor(values, type, componentType) {
    const bytes=Buffer.from(values.buffer); const view=doc.bufferViews.length;
    doc.bufferViews.push({ buffer:0, byteOffset:offset, byteLength:bytes.length, target: type === "VEC3" ? 34962 : 34963 });
    chunks.push(bytes); offset+=bytes.length;
    const pad=(4-offset%4)%4; if(pad) { chunks.push(Buffer.alloc(pad)); offset+=pad; }
    const size=type==='VEC3'?3:1; const entry={bufferView:view, componentType, count:values.length/size, type};
    if(type==='VEC3') { entry.min=[0,1,2].map(i=>Math.min(...Array.from(values).filter((_,j)=>j%3===i))); entry.max=[0,1,2].map(i=>Math.max(...Array.from(values).filter((_,j)=>j%3===i))); }
    doc.accessors.push(entry);return doc.accessors.length-1;
  }
  function mesh(positions,normals,indices,material) {
    const attributes={POSITION:accessor(new Float32Array(positions),'VEC3',5126), NORMAL:accessor(new Float32Array(normals),'VEC3',5126)};
    const index=accessor(new Uint16Array(indices),'SCALAR',5123);
    doc.meshes.push({primitives:[{attributes,indices:index,material}]});return doc.meshes.length-1;
  }
  const pos=[], norm=[], idx=[];
  for(const [n,u,v] of [ [[1,0,0],[0,1,0],[0,0,1]], [[-1,0,0],[0,0,1],[0,1,0]], [[0,1,0],[0,0,1],[1,0,0]], [[0,-1,0],[1,0,0],[0,0,1]], [[0,0,1],[1,0,0],[0,1,0]], [[0,0,-1],[0,1,0],[1,0,0]] ]) {
    const base=pos.length/3;
    for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]) { pos.push(...n.map((x,i)=>(x+a*u[i]+b*v[i])/2)); norm.push(...n); }
    idx.push(base,base+1,base+2,base,base+2,base+3);
  }
  const boxes=doc.materials.map((_,i)=>mesh(pos,norm,idx,i));
  function box(name, center, size, material=2) { const i=doc.nodes.length;doc.nodes.push({name,mesh:boxes[material],translation:center,scale:size});doc.scenes[0].nodes.push(i); }
  function cylinder(name, center, radius, length, material=2, alongZ=false, topRadius=radius) {
    const p=[],n=[],indices=[],steps=32;
    for(let j=0;j<=steps;j++) {
      const a=j*2*Math.PI/steps,c=Math.cos(a),q=Math.sin(a);
      p.push(radius*c,-length/2,radius*q,topRadius*c,length/2,topRadius*q);
      const slope=(radius-topRadius)/length, l=Math.hypot(1,slope);
      n.push(c/l,slope/l,q/l,c/l,slope/l,q/l);
      if(j<steps) { const k=j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2); }
    }
    for(const [y,r,up] of [[-length/2,radius,-1],[length/2,topRadius,1]]) {
      const centerIndex=p.length/3;p.push(0,y,0);n.push(0,up,0);
      for(let j=0;j<=steps;j++) {const a=j*2*Math.PI/steps;p.push(r*Math.cos(a),y,r*Math.sin(a));n.push(0,up,0);if(j<steps){const k=centerIndex+1+j;indices.push(centerIndex,up>0?k+1:k,up>0?k:k+1);}}
    }
    const node={name,mesh:mesh(p,n,indices,material),translation:center};
    if(alongZ) node.rotation=[Math.SQRT1_2,0,0,Math.SQRT1_2];
    doc.scenes[0].nodes.push(doc.nodes.length);doc.nodes.push(node);
  }
  function panel(x,y,z,w,h) {
    box('Solar array', [x,y,z],[w,.06,h],1);
    for(let i=0;i<=8;i++) box('Cell conductor',[x-w/2+w*i/8,y+.035,z],[.012,.012,h],3);
    for(let i=0;i<=4;i++) box('Cell conductor',[x,y+.035,z-h/2+h*i/4],[w,.012,.012],3);
  }
  if(kind==='satellite') {
    box('Thermal blanket bus',[0,0,0],[1.8,1.4,1.7],0);
    box('Instrument deck',[0,.76,0],[1.9,.12,1.8]);
    box('Solar array boom',[0,0,0],[9,.1,.1]);
    panel(-3.3,0,0,3.5,2.2); panel(3.3,0,0,3.5,2.2);
    box('Antenna mast',[0,1.45,0],[.08,1.3,.08]);
    // Faceted parabolic dish, pointing along +Y.
    const p=[],n=[],i=[];const segments=40,rings=7;
    for(let r=0;r<=rings;r++)for(let s=0;s<=segments;s++) {const radius=.65*r/rings,a=s*2*Math.PI/segments,x=radius*Math.cos(a),z=radius*Math.sin(a);p.push(x,1.8+.5*radius*radius,z);const len=Math.hypot(x,1,z);n.push(-x/len,1/len,-z/len);}
    for(let r=0;r<rings;r++)for(let s=0;s<segments;s++){const a=r*(segments+1)+s,b=a+segments+1;i.push(a,b,a+1,b,b+1,a+1);}
    const dish=mesh(p,n,i,2);doc.materials[2].doubleSided=true;doc.scenes[0].nodes.push(doc.nodes.length);doc.nodes.push({name:'High gain antenna',mesh:dish});
    box('Optical payload',[0,0,1.0],[.8,.7,.5],4);
  } else if(kind==='station') {
    box('Station truss',[0,0,0],[26,.6,.6]);
    for(const x of [-11,-7,7,11]) for(const z of [-5,5]) panel(x,0,z,3,8);
    for(const z of [-3,0,3]) cylinder('Pressurized module',[0,0,z],1.3,3,2,true);
    box('Docked module',[3,0,0],[3,2,2]);
    box('Radiator',[0,-2,0],[8,.08,2.8]);
  } else if(kind==='rocket') {
    cylinder('Spent rocket stage',[0,0,0],1,6);cylinder('Engine nozzle',[0,-3.5,0],.9,1,4,false,.35);
    cylinder('Stage band',[0,1.8,0],1.015,.25,4);
  } else {
    box('Unknown debris fragment',[0,0,0],[1.3,.25,2.2]);box('Fragment rib',[.3,.25,0],[.2,.6,1.2],0);
  }
  const binary=Buffer.concat(chunks);doc.buffers.push({byteLength:binary.length});
  const json=Buffer.from(JSON.stringify(doc));const jsonPad=Buffer.alloc((4-json.length%4)%4,32);const padded=Buffer.concat([json,jsonPad]);
  const header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+padded.length+8+binary.length,8);
  function chunkHeader(size,type){const b=Buffer.alloc(8);b.writeUInt32LE(size);b.writeUInt32LE(type,4);return b;}
  writeFileSync(target+kind+'.glb',Buffer.concat([header,chunkHeader(padded.length,0x4e4f534a),padded,chunkHeader(binary.length,0x004e4942),binary]));
}
for(const kind of ['satellite','station','rocket','debris']) makeModel(kind);
