import struct,json,pathlib,math
positions=[]; normals=[]; indices=[]; parts=[]
def box(cx,cy,cz,x,y,z,material):
 start=len(positions)//3; first=len(indices)
 for n,vs in [((1,0,0),[(1,-1,-1),(1,1,-1),(1,1,1),(1,-1,1)]),((-1,0,0),[(-1,1,-1),(-1,-1,-1),(-1,-1,1),(-1,1,1)]),((0,1,0),[(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]),((0,-1,0),[(1,-1,-1),(-1,-1,-1),(-1,-1,1),(1,-1,1)]),((0,0,1),[(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]),((0,0,-1),[(-1,1,-1),(1,1,-1),(1,-1,-1),(-1,-1,-1)])]:
  k=len(positions)//3
  for a,b,c in vs:positions.extend([cx+a*x/2,cy+b*y/2,cz+c*z/2]);normals.extend(n)
  if n[1]: indices.extend([k,k+2,k+1,k,k+3,k+2])
  else: indices.extend([k,k+1,k+2,k,k+2,k+3])
 parts.append((first,len(indices)-first,material))
# glTF Y-up, forward +Z. Original stylized open-wheel mesh in meters.
box(0,.42,0,.7,.35,3.9,0);box(0,.42,-.4,1.35,.35,1.7,0)
box(0,.7,-.35,.55,.35,1,1);box(0,.86,-.55,.4,.15,.35,0)
box(0,.3,2,1.95,.12,.45,0);box(0,.85,-1.9,1.8,.16,.4,0)
box(-.55,.55,-1.85,.1,.6,.15,1);box(.55,.55,-1.85,.1,.6,.15,1)
for x in [-.86,.86]:
 for z in [-1.3,1.3]:
  # Twelve-sided tires, axle parallel X.
  first=len(indices)
  for j in range(12):
   a=j*math.tau/12;b=(j+1)*math.tau/12;k=len(positions)//3
   for dx,t in [(-.2,a),(.2,a),(.2,b),(-.2,b)]:positions.extend([x+dx,.36+.36*math.cos(t),z+.36*math.sin(t)]);normals.extend([0,math.cos(t),math.sin(t)])
   indices.extend([k,k+2,k+1,k,k+3,k+2])
   for side in [-1,1]:
    k=len(positions)//3
    for y,r in [(0,0),(.36*math.cos(a),.36*math.sin(a)),(.36*math.cos(b),.36*math.sin(b))]:
     positions.extend([x+side*.2,.36+y,z+r]);normals.extend([side,0,0])
    indices.extend([k,k+1,k+2] if side>0 else [k,k+2,k+1])
  parts.append((first,len(indices)-first,1))
  box(x,.36,z,.42,.36,.36,1)
buff=struct.pack('<%sf'%len(positions),*positions)+struct.pack('<%sf'%len(normals),*normals)+struct.pack('<%sH'%len(indices),*indices)
vlen=len(positions)*4;nlen=len(normals)*4
views=[{'buffer':0,'byteOffset':0,'byteLength':vlen,'target':34962},{'buffer':0,'byteOffset':vlen,'byteLength':nlen,'target':34962},{'buffer':0,'byteOffset':vlen+nlen,'byteLength':len(indices)*2,'target':34963}]
access=[{'bufferView':0,'componentType':5126,'count':len(positions)//3,'type':'VEC3','min':[min(positions[i::3]) for i in range(3)],'max':[max(positions[i::3]) for i in range(3)]},{'bufferView':1,'componentType':5126,'count':len(normals)//3,'type':'VEC3'}]
prims=[]
for first,count,mat in parts:
 access.append({'bufferView':2,'byteOffset':first*2,'componentType':5123,'count':count,'type':'SCALAR'});prims.append({'attributes':{'POSITION':0,'NORMAL':1},'indices':len(access)-1,'material':mat})
g={'asset':{'version':'2.0','generator':'Aurora original open-wheel model'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0}],'meshes':[{'primitives':prims}],'buffers':[{'byteLength':len(buff)}],'bufferViews':views,'accessors':access,'materials':[{'pbrMetallicRoughness':{'baseColorFactor':[.95,.95,.95,1],'metallicFactor':.3,'roughnessFactor':.45}},{'pbrMetallicRoughness':{'baseColorFactor':[.025,.03,.04,1],'metallicFactor':.1,'roughnessFactor':.9}}]}
j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4);buff+=b'\x00'*((-len(buff))%4)
out=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(buff))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(buff),0x004e4942)+buff
pathlib.Path('frontend/public/events/car.glb').write_bytes(out)
