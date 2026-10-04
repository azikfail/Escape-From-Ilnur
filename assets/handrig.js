/* Procedural rig for the scanned female hand (assets/models/hand.glb: centimetres, +Y = fingers, +Z = palm side, +X = thumb side).
   The scan is a static mesh without bones, so the grip is made here: per-vertex linear blend skinning along the finger
   chains, a wrist joint and a stretched forearm (the scan ends ~7 cm below the wrist). Used by the game, dev/grip.html and dev/fit.html. */
(function(){
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const D2R=Math.PI/180;
// joint positions measured on the mesh (MCP, PIP, DIP, TIP; thumb: CMC, MCP, IP, TIP)
const DIGITS=[
  {name:'index', pts:[V(2.75,16.2,1.0),V(2.7,20.0,1.0),V(3.1,22.3,2.4),V(3.38,23.86,3.3)],R:1.35},
  {name:'middle',pts:[V(.5,16.3,.9),V(.46,20.4,.9),V(.55,23.0,2.9),V(.52,24.72,4.0)],R:1.4},
  {name:'ring',  pts:[V(-2.1,16.2,1.1),V(-1.7,19.6,1.6),V(-1.55,21.6,3.4),V(-1.27,23.04,5.58)],R:1.3},
  {name:'pinky', pts:[V(-4.1,15.8,1.2),V(-4.15,18.3,2.0),V(-3.95,19.6,3.8),V(-3.47,20.59,5.47)],R:1.15},
  {name:'thumb', pts:[V(3.4,12.3,2.7),V(5.1,14.7,2.2),V(6.1,16.4,1.9),V(6.62,17.4,1.67)],R:1.7,thumb:true},
];
// Default pose = hammer grip around the flashlight, thumb lying along the barrel (fitted with dev/fit.html)
const DEF={
  fa:{index:[29,25,44],middle:[54,34,69],ring:[49,17,34],pinky:[53,-9,34]},    // MCP, PIP, DIP flexion relative to the scan (deg)
  ft:{index:0,middle:0,ring:0,pinky:0},          // tilt of each finger's flexion axis about the palm normal (deg)
  ta:[6,9,-20],th0:[0,0,1],tc:[0,0,0],             // thumb: CMC rotation about th0 + extra euler tc (deg), then MCP and IP flexion
  b:[.2,16,4.4],fax:[.9063,.4226,0],fscale:1.25,       // barrel centre, barrel axis (towards the head; 25deg oblique across the palm), flashlight scale
  wr:[0,-32],                                    // wrist flexion (+ = palm-ward) and deviation (- = ulnar, tips the head forward) (deg)
  arm:{len:24,taper:.16}                         // forearm stretch (cm below the scan's cut) and widening towards the elbow
};
function nums(s,d){return s?s.split(',').map(Number):d;}
function params(q){
  const P=JSON.parse(JSON.stringify(DEF));
  if(q&&q.get){
    for(const k of ['index','middle','ring','pinky'])if(q.get(k))P.fa[k]=nums(q.get(k));
    if(q.get('ft')){const t=nums(q.get('ft'));['index','middle','ring','pinky'].forEach((k,i)=>P.ft[k]=t[i]||0);}
    for(const k of ['ta','th0','tc','wr','b','fax'])if(q.get(k))P[k]=nums(q.get(k));
    if(q.get('fs'))P.fscale=+q.get('fs');
    if(q.get('arm')){const a=nums(q.get('arm'));P.arm={len:a[0],taper:a[1]||0};}
  }
  return fin(P);
}
function fin(P){P.bx=P.b[0];P.by=P.b[1];P.bz=P.b[2];return P;}
const sstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function rotAround(p,axis,ang){
  const m=new THREE.Matrix4().makeTranslation(p.x,p.y,p.z);
  m.multiply(new THREE.Matrix4().makeRotationAxis(axis.clone().normalize(),ang));
  m.multiply(new THREE.Matrix4().makeTranslation(-p.x,-p.y,-p.z));return m;
}
const WRIST=V(-.4,7.5,1.8),CUT=1.2;
function wristMatrix(P){
  return rotAround(WRIST,V(1,0,0),(P.wr[0]||0)*D2R).multiply(rotAround(WRIST,V(0,0,1),(P.wr[1]||0)*D2R));
}
// labels: digit index (0..4) of the dominant chain, -1 = palm/forearm; seg = phalanx (0 metacarpal .. 3 distal)
function deform(geo,P){
  const g=geo.clone(),pos=g.attributes.position,nor=g.attributes.normal,n=pos.count;
  const chains=DIGITS.map(d=>{
    const pts=d.pts;
    const ext=pts[0].clone().addScaledVector(pts[1].clone().sub(pts[0]).normalize(),-4);
    const poly=[ext,...pts];const arcs=[-ext.distanceTo(pts[0]),0];let acc=0;for(let i=1;i<4;i++){acc+=pts[i].distanceTo(pts[i-1]);arcs.push(acc);}
    const angs=[],axes=[];
    if(!d.thumb){const a=P.fa[d.name],t=(P.ft[d.name]||0)*D2R,ax=V(Math.cos(t),Math.sin(t),0);for(let j=0;j<3;j++){angs.push(a[j]*D2R);axes.push(ax);}}
    else{const t=P.ta,d1=pts[2].clone().sub(pts[1]).normalize(),d2=pts[3].clone().sub(pts[2]).normalize();
      angs.push(t[0]*D2R,t[1]*D2R,t[2]*D2R);axes.push(V(...P.th0),d1.clone().cross(V(0,0,1)).normalize(),d2.clone().cross(V(0,0,1)).normalize());}
    const M=[new THREE.Matrix4()];
    for(let j=0;j<3;j++){let r=rotAround(pts[j],axes[j],angs[j]);
      if(d.thumb&&j===0&&P.tc){const e=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(P.tc[0]*D2R,P.tc[1]*D2R,P.tc[2]*D2R));
        const p=pts[0];r=r.multiply(new THREE.Matrix4().makeTranslation(p.x,p.y,p.z).multiply(e).multiply(new THREE.Matrix4().makeTranslation(-p.x,-p.y,-p.z)));}
      M.push(M[j].clone().multiply(r));}
    return {d,poly,arcs,M,joints:[arcs[1],arcs[2],arcs[3]]};
  });
  const out=new Float32Array(n*3),outN=new Float32Array(n*3),lab=new Int8Array(n),seg=new Int8Array(n);
  const v=new THREE.Vector3(),nv=new THREE.Vector3(),tmp=new THREE.Vector3(),acc=new THREE.Vector3(),accN=new THREE.Vector3(),ab=new THREE.Vector3(),p=new THREE.Vector3(),pn=new THREE.Vector3();
  const h=.7,WM=wristMatrix(P);P.WM=WM;
  const L=P.arm?P.arm.len:0,k=L>0?(L+CUT)/CUT:1;
  for(let i=0;i<n;i++){
    v.fromBufferAttribute(pos,i);nv.fromBufferAttribute(nor,i);
    acc.set(0,0,0);accN.set(0,0,0);let wsum=0,bestW=.5,bl=-1,bseg=0;
    for(let ci=0;ci<chains.length;ci++){const c=chains[ci];
      let best=1e9,bs=0;
      for(let q=0;q<c.poly.length-1;q++){
        const a=c.poly[q],b=c.poly[q+1];tmp.copy(b).sub(a);const t=Math.max(0,Math.min(1,ab.copy(v).sub(a).dot(tmp)/tmp.lengthSq()));
        const dist=ab.copy(a).addScaledVector(tmp,t).distanceTo(v);
        if(dist<best){best=dist;bs=c.arcs[q]+(c.arcs[q+1]-c.arcs[q])*t;}
      }
      const gw=Math.exp(-Math.pow(best/c.d.R,2));if(gw<1e-3)continue;
      const w0=sstep(c.joints[0]-h,c.joints[0]+h,bs),w1=sstep(c.joints[1]-h,c.joints[1]+h,bs),w2=sstep(c.joints[2]-h,c.joints[2]+h,bs);
      const B=[1-w0,w0-w1,w1-w2,w2];
      p.set(0,0,0);pn.set(0,0,0);
      for(let b=0;b<4;b++){if(B[b]<1e-4)continue;
        tmp.copy(v).applyMatrix4(c.M[b]);p.addScaledVector(tmp,B[b]);
        tmp.copy(nv).transformDirection(c.M[b]);pn.addScaledVector(tmp,B[b]);}
      acc.addScaledVector(p,gw);accN.addScaledVector(pn,gw);wsum+=gw;
      if(gw>bestW&&bs>-.5){bestW=gw;bl=ci;bseg=B.indexOf(Math.max(...B));}
    }
    const g0=.06;acc.addScaledVector(v,g0);accN.addScaledVector(nv,g0);wsum+=g0;
    acc.multiplyScalar(1/wsum);accN.normalize();
    // forearm: stretch the short scanned stump into a full forearm that widens towards the elbow
    if(acc.y<CUT&&k>1){const dy=(CUT-acc.y)*k,s=1+P.arm.taper*Math.min(1,dy/L),cx=-1.15,cz=.6;
      acc.set(cx+(acc.x-cx)*s,CUT-dy,cz+(acc.z-cz)*s);accN.y/=k;accN.normalize();}
    const wa=1-sstep(5.5,10.5,acc.y);if(wa>1e-4){tmp.copy(acc).applyMatrix4(WM);acc.lerp(tmp,wa);tmp.copy(accN).transformDirection(WM);accN.lerp(tmp,wa).normalize();}
    out[i*3]=acc.x;out[i*3+1]=acc.y;out[i*3+2]=acc.z;outN[i*3]=accN.x;outN[i*3+1]=accN.y;outN[i*3+2]=accN.z;lab[i]=bl;seg[i]=bseg;
  }
  g.setAttribute('position',new THREE.BufferAttribute(out,3));g.setAttribute('normal',new THREE.BufferAttribute(outN,3));
  g.userData.lab=lab;g.userData.seg=seg;
  g.computeBoundingBox();g.computeBoundingSphere();return g;
}
// flashlight placement in hand space: the glb has its head at -Z, length along Z (metres)
function flashMatrix(P){
  const a=V(...P.fax).normalize(),q=new THREE.Quaternion().setFromUnitVectors(V(0,0,-1),a);
  return new THREE.Matrix4().compose(V(P.bx,P.by,P.bz),q,V(100*P.fscale,100*P.fscale,100*P.fscale));
}
window.HANDRIG={params,fin,deform,flashMatrix,wristMatrix,DIGITS,DEF,WRIST,CUT};
})();
