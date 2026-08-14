import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import RunBar from "./RunPanel.jsx";
const _reactShim = React;
import * as XLSX from "xlsx";


// Safe min/max for large arrays — avoid Math.min/max spread which blows
// the call stack on 50k+ element arrays.
function arrMin(arr){let m=Infinity;for(let i=0;i<arr.length;i++)if(arr[i]<m)m=arr[i];return m;}
function arrMax(arr){let m=-Infinity;for(let i=0;i<arr.length;i++)if(arr[i]>m)m=arr[i];return m;}
function arrMinBy(arr,fn){let m=Infinity;for(let i=0;i<arr.length;i++){const v=fn(arr[i]);if(v<m)m=v;}return m;}
function arrMaxBy(arr,fn){let m=-Infinity;for(let i=0;i<arr.length;i++){const v=fn(arr[i]);if(v>m)m=v;}return m;}


// ── SAMPLE DATA (first 5 trackers from TF2 xlsx) ────────────────────────────
const SAMPLE_DATA = [
  {TrackerID:"1-1",Northing:548077.2325,Easting:2525548.547,ExistingGround:461.2015},
  {TrackerID:"1-1",Northing:548100.5376,Easting:2525548.547,ExistingGround:461.3247},
  {TrackerID:"1-1",Northing:548127.6353,Easting:2525548.547,ExistingGround:461.3014},
  {TrackerID:"1-1",Northing:548154.7331,Easting:2525548.547,ExistingGround:461.3155},
  {TrackerID:"1-1",Northing:548181.8309,Easting:2525548.547,ExistingGround:461.4051},
  {TrackerID:"1-1",Northing:548208.9286,Easting:2525548.547,ExistingGround:461.4626},
  {TrackerID:"1-1",Northing:548236.0264,Easting:2525548.547,ExistingGround:461.5246},
  {TrackerID:"1-1",Northing:548265.7856,Easting:2525548.547,ExistingGround:461.5834},
  {TrackerID:"1-1",Northing:548295.5448,Easting:2525548.547,ExistingGround:461.6362},
  {TrackerID:"1-1",Northing:548322.6426,Easting:2525548.547,ExistingGround:461.7948},
  {TrackerID:"1-1",Northing:548349.7403,Easting:2525548.547,ExistingGround:461.9622},
  {TrackerID:"1-1",Northing:548376.8381,Easting:2525548.547,ExistingGround:462.1265},
  {TrackerID:"1-1",Northing:548403.9359,Easting:2525548.547,ExistingGround:462.4021},
  {TrackerID:"1-1",Northing:548431.0336,Easting:2525548.547,ExistingGround:462.6722},
  {TrackerID:"1-1",Northing:548454.3387,Easting:2525548.547,ExistingGround:462.7953},
  {TrackerID:"1-13",Northing:548077.1901,Easting:2525797.547,ExistingGround:458.7638},
  {TrackerID:"1-13",Northing:548100.4952,Easting:2525797.547,ExistingGround:458.8373},
  {TrackerID:"1-13",Northing:548127.593,Easting:2525797.547,ExistingGround:458.7984},
  {TrackerID:"1-13",Northing:548154.6908,Easting:2525797.547,ExistingGround:458.702},
  {TrackerID:"1-13",Northing:548181.7886,Easting:2525797.547,ExistingGround:458.621},
  {TrackerID:"1-13",Northing:548208.8863,Easting:2525797.547,ExistingGround:458.8127},
  {TrackerID:"1-13",Northing:548235.9841,Easting:2525797.547,ExistingGround:459.2093},
  {TrackerID:"1-13",Northing:548265.7433,Easting:2525797.547,ExistingGround:459.4504},
  {TrackerID:"1-13",Northing:548295.5025,Easting:2525797.547,ExistingGround:459.2585},
  {TrackerID:"1-13",Northing:548322.6002,Easting:2525797.547,ExistingGround:458.8295},
  {TrackerID:"1-13",Northing:548349.698,Easting:2525797.547,ExistingGround:458.3064},
  {TrackerID:"1-13",Northing:548376.7958,Easting:2525797.547,ExistingGround:457.9358},
  {TrackerID:"1-13",Northing:548403.8935,Easting:2525797.547,ExistingGround:457.9529},
  {TrackerID:"1-13",Northing:548430.9913,Easting:2525797.547,ExistingGround:458.0381},
  {TrackerID:"1-13",Northing:548454.2964,Easting:2525797.547,ExistingGround:458.3052},
  // Steeper terrain tracker for demo
  {TrackerID:"Demo-Steep",Northing:548077.0,Easting:2525900.0,ExistingGround:456.0},
  {TrackerID:"Demo-Steep",Northing:548104.0,Easting:2525900.0,ExistingGround:456.4},
  {TrackerID:"Demo-Steep",Northing:548131.0,Easting:2525900.0,ExistingGround:457.2},
  {TrackerID:"Demo-Steep",Northing:548158.0,Easting:2525900.0,ExistingGround:458.5},
  {TrackerID:"Demo-Steep",Northing:548185.0,Easting:2525900.0,ExistingGround:459.9},
  {TrackerID:"Demo-Steep",Northing:548212.0,Easting:2525900.0,ExistingGround:461.0},
  {TrackerID:"Demo-Steep",Northing:548239.0,Easting:2525900.0,ExistingGround:461.6},
  {TrackerID:"Demo-Steep",Northing:548266.0,Easting:2525900.0,ExistingGround:461.8},
  {TrackerID:"Demo-Steep",Northing:548293.0,Easting:2525900.0,ExistingGround:461.3},
  {TrackerID:"Demo-Steep",Northing:548320.0,Easting:2525900.0,ExistingGround:460.1},
  {TrackerID:"Demo-Steep",Northing:548347.0,Easting:2525900.0,ExistingGround:458.7},
  {TrackerID:"Demo-Steep",Northing:548374.0,Easting:2525900.0,ExistingGround:457.2},
  {TrackerID:"Demo-Steep",Northing:548401.0,Easting:2525900.0,ExistingGround:456.1},
  {TrackerID:"Demo-Steep",Northing:548428.0,Easting:2525900.0,ExistingGround:455.5},
  {TrackerID:"Demo-Steep",Northing:548455.0,Easting:2525900.0,ExistingGround:455.2},
];

// ── OPTIMIZATION ENGINE ──────────────────────────────────────────────────────
function parseCSV(text){
  const lines=text.trim().split("\n");
  if(lines.length<2)return[];
  const headers=lines[0].split(",").map(h=>h.trim().replace(/"/g,""));
  return lines.slice(1).map(line=>{
    const vals=line.split(",").map(v=>v.trim().replace(/"/g,""));
    const row={};headers.forEach((h,i)=>{row[h]=vals[i];});return row;
  });
}
function normalizeRow(r){
  const get=(...keys)=>{for(const k of keys){const f=Object.keys(r).find(rk=>rk.toLowerCase()===k.toLowerCase());if(f!==undefined&&r[f]!==""&&r[f]!==undefined)return parseFloat(r[f]);}return NaN;};
  const getStr=(...keys)=>{for(const k of keys){const f=Object.keys(r).find(rk=>rk.toLowerCase()===k.toLowerCase());if(f!==undefined)return String(r[f]).trim();}return"";};
  return{TrackerID:getStr("TrackerID","trackerid","tracker_id"),Northing:get("Northing","northing","N"),Easting:get("Easting","easting","E"),ExistingGround:get("ExistingGround","existingground","existing_ground","ground"),MinReveal:get("MinReveal","minreveal","min_reveal","min reveal","minimumreveal","minimum reveal","minrev"),MaxReveal:get("MaxReveal","maxreveal","max_reveal","max reveal","maximumreveal","maximum reveal","maxrev")};
}
function groupByTracker(rows){
  const map={};rows.forEach(r=>{if(!map[r.TrackerID])map[r.TrackerID]=[];map[r.TrackerID].push(r);});
  Object.values(map).forEach(arr=>arr.sort((a,b)=>a.Northing-b.Northing));return map;
}
function linReg(xs,ys){
  const n=xs.length; let sx=0,sy=0,sxx=0,sxy=0;
  for(let i=0;i<n;i++){sx+=xs[i];sy+=ys[i];sxx+=xs[i]*xs[i];sxy+=xs[i]*ys[i];}
  const den=n*sxx-sx*sx; if(den===0)return{slope:0,intercept:sy/n};
  const slope=(n*sxy-sx*sy)/den;
  return{slope,intercept:(sy-slope*sx)/n};
}
// compSlopes uses pre-computed dx array — no division-per-call overhead
function compSlopes(tops,dx,n){
  const sl=new Array(n-1);
  for(let i=0;i<n-1;i++) sl[i]=(tops[i+1]-tops[i])/dx[i];
  return sl;
}
function compDeltas(slopes){
  const n=slopes.length,dl=new Array(n-1);
  for(let i=0;i<n-1;i++) dl[i]=slopes[i+1]-slopes[i];
  return dl;
}

// balanceCutFill: bisect for vertical shift that minimises |cut-fill|.
// Returns the shift value (caller adds it to tops). Skips if already in bounds.
// 20 iterations → precision < 0.001 ft.
function balanceCutFill(tops,grounds,n,mn,mx){
  return balanceCutFillShift(tops,grounds,n,mn,mx);
}

// Returns {shift, rotation} — public so Step 3 can apply both.
// rotation (rad/ft along northing axis) preserves slope deltas since
// delta = slope[i+1]-slope[i] and adding a constant to all slopes cancels.
function balanceCutFillRotate(tops,grounds,northings,n,mn,mx,maxSl,preferCutHigh=false){
  const ns=northings;
  let nsCenter=0; for(let i=0;i<n;i++) nsCenter+=ns[i]; nsCenter/=n;
  const xs=new Array(n); for(let i=0;i<n;i++) xs[i]=ns[i]-nsCenter;
  const dx=new Array(n-1); for(let i=0;i<n-1;i++) dx[i]=ns[i+1]-ns[i];
  const revs=new Array(n); for(let i=0;i<n;i++) revs[i]=tops[i]-grounds[i];

  // Pre-compute tube slopes for rotation feasibility check
  const sl0=new Array(n-1);
  for(let i=0;i<n-1;i++) sl0[i]=(tops[i+1]-tops[i])/dx[i];
  const slMin=sl0.reduce((a,v)=>Math.min(a,v),Infinity);
  const slMax=sl0.reduce((a,v)=>Math.max(a,v),-Infinity);

  function earthwork(s,r){
    let ew=0;
    for(let i=0;i<n;i++){
      const rv=revs[i]+s+r*xs[i];
      ew+=Math.max(0,mn-rv)+Math.max(0,rv-mx);
    }
    return ew;
  }

  function balance1D(r){
    // For fixed rotation r, find the shift that balances cut=fill
    const rv_r=new Array(n); for(let i=0;i<n;i++) rv_r[i]=revs[i]+r*xs[i];
    let hu=20,hd=20;
    for(let i=0;i<n;i++){
      if(mx-rv_r[i]<hu)hu=mx-rv_r[i];
      if(rv_r[i]-mn<hd)hd=rv_r[i]-mn;
    }
    let lo=Math.max(-hd,-20),hi=Math.min(hu,20);
    function f(s){let v=0;for(let i=0;i<n;i++){v+=Math.max(0,rv_r[i]+s-mx)-Math.max(0,mn-rv_r[i]-s);}return v;}
    let flo=f(lo),fhi=f(hi);
    if(flo*fhi>=0)return Math.abs(flo)<=Math.abs(fhi)?lo:hi;
    let lo2=lo,hi2=hi,flo2=flo,sBal=0;
    for(let k=0;k<25;k++){
      const mid=(lo2+hi2)/2,fm=f(mid);
      if(Math.abs(fm)<0.0001){sBal=mid;break;}
      if(flo2*fm<0){hi2=mid;}else{lo2=mid;flo2=fm;}
      sBal=mid;
    }
    return sBal;
  }

  // Rotation range bounded by slope constraints
  // Rotation adds a constant to all slopes, preserving deltas.
  const rMax=Math.min(0.05,maxSl-slMax+0.001);
  const rMin=Math.max(-0.05,(-maxSl)-slMin-0.001);

  // Low end pile: the end pile with the lowest existing ground elevation.
  // Priority: find the rotation that brings the low end pile to zero cut
  // (reveal ≥ minReveal without grading). If that is not achievable within
  // the rotation range, use the rotation that minimises low-end cut.
  // Secondarily, among rotations that achieve zero low-end cut, pick the
  // one with minimum total earthwork.
  const lowEndIdx=grounds[0]<=grounds[n-1]?0:n-1;

  let bestEW=1e9,bestS=0,bestR=rMin;
  let bestLowCut=1e9,bestSLow=0,bestRLow=rMin;
  const steps=200;
  for(let k=0;k<=steps;k++){
    const r=rMin+(rMax-rMin)*k/steps;
    const s=balance1D(r);
    const ew=earthwork(s,r);
    const lowRev=revs[lowEndIdx]+s+r*xs[lowEndIdx];
    const lowCut=Math.max(0,mn-lowRev);

    // Track minimum-earthwork solution
    if(ew<bestEW){bestEW=ew;bestS=s;bestR=r;}

    // Track minimum-low-end-cut solution (prefer zero cut, then min EW among zero-cut)
    if(lowCut<bestLowCut-1e-6||(Math.abs(lowCut-bestLowCut)<1e-6&&ew<earthwork(bestSLow,bestRLow))){
      bestLowCut=lowCut;bestSLow=s;bestRLow=r;
    }
  }

  // Use the zero-low-end-cut solution if achievable (low cut ≈ 0).
  // Otherwise use the solution that minimises low-end cut.
  // The low-end priority ensures cut never occurs at the lowest-elevation
  // end pile — it is better to accept fill elsewhere than to cut the low end.
  const useLowPriority=preferCutHigh&&(bestLowCut<0.01||(bestLowCut<bestEW*0.5));
  const finalS=useLowPriority?bestSLow:bestS;
  const finalR=useLowPriority?bestRLow:bestR;
  return{shift:finalS,rotation:finalR,xs};
}

function balanceCutFillShift(tops,grounds,n,mn,mx){
  // 1D fallback — used internally and by Step 2 which has no northings
  const revs=new Array(n); for(let i=0;i<n;i++) revs[i]=tops[i]-grounds[i];
  let hu=1e9,hd=1e9;
  for(let i=0;i<n;i++){if(mx-revs[i]<hu)hu=mx-revs[i];if(revs[i]-mn<hd)hd=revs[i]-mn;}
  let lo=Math.max(-hd,-20),hi=Math.min(hu,20);
  function f(s){let v=0;for(let i=0;i<n;i++){v+=Math.max(0,revs[i]+s-mx)-Math.max(0,mn-revs[i]-s);}return v;}
  let flo=f(lo),fhi=f(hi),sBal;
  if(flo*fhi>=0){sBal=Math.abs(flo)<=Math.abs(fhi)?lo:hi;}
  else{
    let lo2=lo,hi2=hi,flo2=flo;
    for(let k=0;k<25;k++){
      const mid=(lo2+hi2)/2,fm=f(mid);
      if(Math.abs(fm)<0.0001){sBal=mid;break;}
      if(flo2*fm<0){hi2=mid;}else{lo2=mid;flo2=fm;}
    }
    if(sBal===undefined)sBal=(lo2+hi2)/2;
  }
  return sBal;
}

function optimizeTracker(piles,constraints){
  let{minReveal,maxReveal,targetReveal,maxSlope,maxSlopeDelta,preferCutHigh=false}=constraints;
  // Per-pile MinReveal/MaxReveal from the input file OVERRIDE the sliders:
  // for the per-tracker warm start use the tracker's tightest file bounds
  // (the global phase then applies the exact per-pile boxes).
  {
    const mins=piles.map(p=>p.MinReveal).filter(v=>v!=null&&!isNaN(v));
    const maxs=piles.map(p=>p.MaxReveal).filter(v=>v!=null&&!isNaN(v));
    if(mins.length===piles.length&&maxs.length===piles.length){
      minReveal=Math.max(...mins);
      maxReveal=Math.min(...maxs);
      if(minReveal>maxReveal){const m=(minReveal+maxReveal)/2;minReveal=m;maxReveal=m;}
      targetReveal=Math.min(Math.max(targetReveal,minReveal),maxReveal);
    }
  }
  const n=piles.length;
  const northings=new Array(n),grounds=new Array(n),dx=new Array(n-1);
  for(let i=0;i<n;i++){northings[i]=piles[i].Northing;grounds[i]=piles[i].ExistingGround;}
  for(let i=0;i<n-1;i++)dx[i]=northings[i+1]-northings[i];

  // Centered OLS (numerically stable for large state-plane coordinates)
  let mn=0; for(let i=0;i<n;i++)mn+=northings[i]; mn/=n;
  const xs=new Array(n); for(let i=0;i<n;i++)xs[i]=northings[i]-mn;
  let sx=0,sy=0,sxx=0,sxy=0;
  for(let i=0;i<n;i++){sx+=xs[i];sy+=grounds[i];sxx+=xs[i]*xs[i];sxy+=xs[i]*grounds[i];}
  const den=n*sxx-sx*sx;
  const rawSlope=den===0?0:(n*sxy-sx*sy)/den;
  const intercept=(sy-rawSlope*sx)/n;
  const cs=Math.max(-maxSlope,Math.min(maxSlope,rawSlope));

  // Straight-line tube
  const tops=new Array(n);
  for(let i=0;i<n;i++)tops[i]=intercept+cs*xs[i]+targetReveal;
  const slRevs=new Array(n); for(let i=0;i<n;i++)slRevs[i]=tops[i]-grounds[i];
  const slSlopes=compSlopes(tops,dx,n);
  const slDeltas=compDeltas(slSlopes);
  const slSlopeOk=slSlopes.every(s=>Math.abs(s)<=maxSlope+1e-6);
  const slDeltaOk=slDeltas.length===0||slDeltas.every(d=>Math.abs(d)<=maxSlopeDelta+1e-6);
  const slRevealOk=slRevs.every(r=>r>=minReveal-1e-6&&r<=maxReveal+1e-6);

  // ── STEP 1: Straight line — no earthwork ───────────────────────────────────
  if(slSlopeOk&&slDeltaOk&&slRevealOk){
    return buildResult(piles,tops,grounds,dx,northings,"StraightLine",
      `Straight line at ${(cs*100).toFixed(4)}% grade — all constraints satisfied, no earthwork required.`,
      constraints);
  }

  // ── Shared projection function (used by Step 2 and Step 3) ─────────────────
  // Projects tube positions onto the feasible set:
  // reveals in [minReveal,maxReveal] and |slopes| <= maxSlope.
  // No grading — only the tube position moves, not the ground.
  function projectFeasible(z){
    // Clip reveals (no grading — tube position only)
    for(let i=0;i<n;i++) z[i]=Math.max(grounds[i]+minReveal,Math.min(grounds[i]+maxReveal,z[i]));
    // Forward slope clamp
    for(let i=1;i<n;i++){
      const s=(z[i]-z[i-1])/dx[i-1];
      if(Math.abs(s)>maxSlope){
        z[i]=z[i-1]+(s>0?maxSlope:-maxSlope)*dx[i-1];
        z[i]=Math.max(grounds[i]+minReveal,Math.min(grounds[i]+maxReveal,z[i]));
      }
    }
    // Backward slope clamp
    for(let i=n-2;i>=0;i--){
      const s=(z[i+1]-z[i])/dx[i];
      if(Math.abs(s)>maxSlope){
        z[i]=z[i+1]-(s>0?maxSlope:-maxSlope)*dx[i];
        z[i]=Math.max(grounds[i]+minReveal,Math.min(grounds[i]+maxReveal,z[i]));
      }
    }
    // Forward delta clamp — inline slope recompute to avoid stale-array drift
    for(let i=1;i<n-1;i++){
      const sPrev=(z[i]-z[i-1])/dx[i-1];
      const sCurr=(z[i+1]-z[i])/dx[i];
      const d=sCurr-sPrev;
      if(Math.abs(d)>maxSlopeDelta){
        z[i+1]=z[i]+(sPrev+(d>0?maxSlopeDelta:-maxSlopeDelta))*dx[i];
        z[i+1]=Math.max(grounds[i+1]+minReveal,Math.min(grounds[i+1]+maxReveal,z[i+1]));
      }
    }
    // Backward delta clamp
    for(let i=n-3;i>=0;i--){
      const sCurr=(z[i+1]-z[i])/dx[i];
      const sNext=(i+2<n)?(z[i+2]-z[i+1])/dx[i+1]:sCurr;
      const d=sNext-sCurr;
      if(Math.abs(d)>maxSlopeDelta){
        z[i]=z[i+1]-(sNext-(d>0?maxSlopeDelta:-maxSlopeDelta))*dx[i];
        z[i]=Math.max(grounds[i]+minReveal,Math.min(grounds[i]+maxReveal,z[i]));
      }
    }
    return z;
  }

  // ── STEP 2: Terrain following — minimise slope delta, no earthwork ──────────
  // Finds the smoothest tube (minimum sum of squared slope changes) that keeps
  // all reveals within [minReveal, maxReveal] and all slopes within maxSlope,
  // without touching the ground. Uses ADMM with direct Cholesky solve.
  // The straight line (zero delta) is the starting point and ideal target —
  // the optimizer only deviates from it as much as the reveal corridor demands.
  if(slSlopeOk&&slDeltaOk){
    // SL geometry is fine but reveals are out of bounds → Step 2
    // Build A = 2*L^T*L + rho*I where L extracts slope deltas
    const rho=0.1;
    const A=[];
    for(let i=0;i<n;i++){A.push(new Array(n).fill(0));}
    for(let k=0;k<n-2;k++){
      const a=1/dx[k], b=-(1/dx[k]+1/dx[k+1]), c=1/dx[k+1];
      const coefs=[[k,a],[k+1,b],[k+2,c]];
      for(const[i,ci] of coefs) for(const[j,cj] of coefs) A[i][j]+=2*ci*cj;
    }
    for(let i=0;i<n;i++) A[i][i]+=rho;

    // Cholesky factorisation A = Lc * Lc^T
    const Lc=[];
    for(let i=0;i<n;i++) Lc.push(new Array(n).fill(0));
    for(let i=0;i<n;i++){
      for(let j=0;j<=i;j++){
        let s=A[i][j]; for(let k=0;k<j;k++) s-=Lc[i][k]*Lc[j][k];
        Lc[i][j]=i===j?Math.sqrt(Math.max(s,1e-15)):s/Lc[j][j];
      }
    }
    function cholSolve(b){
      const y=new Array(n);
      for(let i=0;i<n;i++){let s=b[i];for(let k=0;k<i;k++)s-=Lc[i][k]*y[k];y[i]=s/Lc[i][i];}
      const x=new Array(n);
      for(let i=n-1;i>=0;i--){let s=y[i];for(let k=i+1;k<n;k++)s-=Lc[k][i]*x[k];x[i]=s/Lc[i][i];}
      return x;
    }

    // Initial point: SL clipped to reveal bounds
    let x=tops.map((t,i)=>Math.max(grounds[i]+minReveal,Math.min(grounds[i]+maxReveal,t)));
    let z=x.slice(), u=new Array(n).fill(0);
    for(let it=0;it<100;it++){
      const xp=x.slice();
      const rhs=new Array(n); for(let i=0;i<n;i++) rhs[i]=rho*(z[i]-u[i]);
      x=cholSolve(rhs);
      z=projectFeasible(x.map((xi,i)=>xi+u[i]));
      for(let i=0;i<n;i++) u[i]+=x[i]-z[i];
      if(it>3){let mc=0;for(let i=0;i<n;i++){const c=Math.abs(x[i]-xp[i]);if(c>mc)mc=c;}if(mc<1e-9)break;}
    }

    // Check Step 2 result — if delta still exceeds limit, fall through to Step 3
    const step2Deltas=compDeltas(compSlopes(z,dx,n));
    const step2DeltaOk=step2Deltas.length===0||step2Deltas.every(d=>Math.abs(d)<=maxSlopeDelta+1e-6);
    if(step2DeltaOk){
      for(let i=0;i<n;i++) tops[i]=z[i];
      return buildResult(piles,tops,grounds,dx,northings,"Terrain Follow (No Grade)",
        `Straight line at ${(cs*100).toFixed(4)}% grade cannot satisfy reveal bounds (terrain relief exceeds window). Tube repositioned to minimise flex joint rotation while keeping all reveals within [${minReveal}, ${maxReveal}] ft and slope deltas within ±${(maxSlopeDelta*100).toFixed(2)}% — no earthwork required.`,
        constraints);
    }
    // Step 2 could not satisfy delta constraint within reveal corridor → fall to Step 3
  }

  // ── STEP 3: Terrain following — enforce maxSlopeDelta, balance earthwork ────
  // The terrain slope itself exceeds maxSlope, so no straight line can satisfy
  // the slope constraint. Tube follows terrain with full delta clamping,
  // then cut/fill is balanced within the tracker row.
  const why=[];
  {let v=false;for(let i=0;i<n-1;i++)if(Math.abs(slSlopes[i])>maxSlope+1e-6){v=true;break;}if(v)why.push(`terrain slope exceeds ±${(maxSlope*100).toFixed(1)}%`);}
  {let v=false;for(let i=0;i<n-2;i++)if(Math.abs(slDeltas[i])>maxSlopeDelta+1e-6){v=true;break;}if(v)why.push(`terrain slope change exceeds ±${(maxSlopeDelta*100).toFixed(2)}%`);}
  if(why.length===0)why.push(`reveal corridor too tight to satisfy ±${(maxSlopeDelta*100).toFixed(2)}% flex joint limit without earthwork`);

  // Step 3 initializes from the average of EG+targetReveal and the OLS straight line.
  // EG+target: tube follows terrain grade naturally, uses full delta budget.
  // SL: positions tube for correct crest/sag earthwork pattern (cut peak, fill ends).
  // Blend of both: consistently outperforms either alone — never worse than EG+target,
  // and roughly 2x less earthwork on steep terrain where Step 3 is most needed.
  for(let i=0;i<n;i++) tops[i]=(grounds[i]+targetReveal + intercept+cs*xs[i]+targetReveal)*0.5;
  const prev=new Array(n);
  for(let pass=0;pass<20;pass++){
    for(let i=0;i<n;i++) prev[i]=tops[i];
    for(let i=1;i<n;i++){const s=(tops[i]-tops[i-1])/dx[i-1];if(Math.abs(s)>maxSlope)tops[i]=tops[i-1]+(s>0?maxSlope:-maxSlope)*dx[i-1];}
    for(let i=n-2;i>=0;i--){const s=(tops[i+1]-tops[i])/dx[i];if(Math.abs(s)>maxSlope)tops[i]=tops[i+1]-(s>0?maxSlope:-maxSlope)*dx[i];}
    for(let i=1;i<n-1;i++){
      const sPrev=(tops[i]-tops[i-1])/dx[i-1],sCurr=(tops[i+1]-tops[i])/dx[i],d=sCurr-sPrev;
      if(Math.abs(d)>maxSlopeDelta)tops[i+1]=tops[i]+(sPrev+(d>0?maxSlopeDelta:-maxSlopeDelta))*dx[i];
    }
    for(let i=n-3;i>=0;i--){
      const sCurr=(tops[i+1]-tops[i])/dx[i],sNext=(i+2<n)?(tops[i+2]-tops[i+1])/dx[i+1]:sCurr,d=sNext-sCurr;
      if(Math.abs(d)>maxSlopeDelta)tops[i]=tops[i+1]-(sNext-(d>0?maxSlopeDelta:-maxSlopeDelta))*dx[i];
    }
    let mc=0;for(let i=0;i<n;i++){const c=Math.abs(tops[i]-prev[i]);if(c>mc)mc=c;}
    if(pass>0&&mc<0.0001)break;
  }
  // Apply rotation+shift: rotation tilts the tube to minimize earthwork
  // while preserving slope deltas (rotation adds a constant to all slopes).
  const bal=balanceCutFillRotate(tops,grounds,northings,n,minReveal,maxReveal,maxSlope,preferCutHigh);
  for(let i=0;i<n;i++) tops[i]+=bal.shift+bal.rotation*bal.xs[i];
  const adjGround=new Array(n);
  let totalCut=0,totalFill=0,pilesCut=0,pilesFill=0;
  for(let i=0;i<n;i++){
    const rev=tops[i]-grounds[i];
    if(rev>maxReveal+0.001){adjGround[i]=grounds[i]+(rev-maxReveal);totalCut+=rev-maxReveal;pilesCut++;}
    else if(rev<minReveal-0.001){adjGround[i]=grounds[i]-(minReveal-rev);totalFill+=minReveal-rev;pilesFill++;}
    else adjGround[i]=grounds[i];
  }
  const net=Math.abs(totalCut-totalFill);
  const ewMsg=pilesCut+pilesFill===0?"No ground adjustment required after balancing."
    :`Ground adjusted at ${pilesCut} pile(s) cut (${totalCut.toFixed(3)} ft) and ${pilesFill} pile(s) fill (${totalFill.toFixed(3)} ft). Net imbalance: ${net.toFixed(3)} ft.`;
  return buildResult(piles,tops,grounds,dx,northings,"Terrain Follow (w/ Grade)",
    `Terrain following with earthwork: ${why.join("; ")}. Tube set to EG+${targetReveal} ft, smoothed to enforce max slope ±${(maxSlope*100).toFixed(1)}% and flex joint rotation ±${(maxSlopeDelta*100).toFixed(2)}%. Tube shifted to balance cut vs. fill within this tracker row. ${ewMsg}`,
    constraints,adjGround);
}

function buildResult(piles,tops,grounds,dx,northings,method,explanation,constraints,adjGround=null){
  const {minReveal,maxReveal,maxSlope,maxSlopeDelta}=constraints;
  if(!adjGround){adjGround=new Array(tops.length);for(let i=0;i<tops.length;i++)adjGround[i]=grounds[i];}
  const revs=new Array(tops.length);for(let i=0;i<tops.length;i++)revs[i]=tops[i]-grounds[i];
  const n2=tops.length;
  const slopes=compSlopes(tops,dx,n2);
  const deltas=compDeltas(slopes);
  const cutFill=adjGround.map((g,i)=>g-grounds[i]);
  const totalCut=cutFill.reduce((s,v)=>s+(v<0?-v:0),0);
  const totalFill=cutFill.reduce((s,v)=>s+(v>0?v:0),0);
  const violations=[];
  revs.forEach((r,i)=>{if(r<minReveal-0.005)violations.push(`Pile ${i+1}: reveal ${r.toFixed(3)} ft < min ${minReveal} ft`);});
  revs.forEach((r,i)=>{if(r>maxReveal+0.005)violations.push(`Pile ${i+1}: reveal ${r.toFixed(3)} ft > max ${maxReveal} ft`);});
  slopes.forEach((s,i)=>{if(Math.abs(s)>maxSlope+0.0001)violations.push(`Span ${i+1}→${i+2}: slope ${(s*100).toFixed(3)}% > max ${(maxSlope*100).toFixed(1)}%`);});
  deltas.forEach((d,i)=>{if(Math.abs(d)>maxSlopeDelta+0.0001)violations.push(`Flex jt ${i+2}: Δslope ${(d*100).toFixed(3)}% > max ${(maxSlopeDelta*100).toFixed(2)}%`);});
  return piles.map((p,i)=>({
    ...p,TopOfPile:tops[i],FinalReveal:revs[i],FinalGround:adjGround[i],
    CutFill:cutFill[i],Slope:i>0?slopes[i-1]:null,SlopeDelta:i>1?deltas[i-2]:null,
    Method:method,Explanation:explanation,Violations:violations,
    MaxAbsSlope:slopes.length?arrMaxBy(slopes,Math.abs):0,
    MaxAbsSlopeDelta:deltas.length?arrMaxBy(deltas,Math.abs):0,
    TotalCut:totalCut,TotalFill:totalFill,NetImbalance:Math.abs(totalCut-totalFill),
  }));
}

// Method labels come from two solvers: the per-tracker pass emits
// "StraightLine" / "Terrain Follow (No Grade)" / "Terrain Follow (w/ Grade)",
// while the global site solve that runs after it emits "StraightLine" /
// "Pile Plan (Global)" / "Requires Regrade". Classify in one place so the fleet
// counters and the export agree no matter which produced the result.
function classifyMethod(method){
  if(method==="StraightLine")return"straight";
  if(method==="Requires Regrade"||method==="Terrain Follow (w/ Grade)")return"regrade";
  return"optimized";
}

// ── SVG CHART ────────────────────────────────────────────────────────────────
function ElevChart({piles,results,adjPiles,adjResults,adjLabel,adjSide}){
  if(!results||results.length===0)return null;
  const W=680,H=260,P={l:56,r:16,t:14,b:44};
  const cW=W-P.l-P.r,cH=H-P.t-P.b;
  const hasAdj=!!(adjPiles&&adjPiles.length>0&&adjResults&&adjResults.length>0);
  const allE=[...piles.map(p=>p.ExistingGround),...results.map(r=>r.TopOfPile),...results.map(r=>r.FinalGround),
    ...(hasAdj?adjPiles.map(p=>p.ExistingGround):[]),
    ...(hasAdj?adjResults.map(r=>r.TopOfPile):[]),
    ...(hasAdj?adjResults.map(r=>r.FinalGround):[])];
  const minE=arrMin(allE)-0.4,maxE=arrMax(allE)+0.4;
  const allN=[...piles.map(p=>p.Northing),...(hasAdj?adjPiles.map(p=>p.Northing):[])];
  const minN=arrMin(allN),maxN=arrMax(allN);
  const xS=n=>((n-minN)/(maxN-minN||1))*cW,yS=e=>cH-((e-minE)/(maxE-minE||1))*cH;
  const adjGPts=hasAdj?adjPiles.map(p=>({x:p.Northing,y:p.ExistingGround})):[];
  const adjTPts=hasAdj?adjResults.map(r=>({x:r.Northing,y:r.TopOfPile})):[];
  const adjAPts=hasAdj?adjResults.map(r=>({x:r.Northing,y:r.FinalGround})):[];
  const adjHasCF=hasAdj&&adjResults.some(r=>Math.abs(r.CutFill??0)>0.005);
  const mainMaxN=arrMaxBy(piles,p=>p.Northing),mainMinN=arrMinBy(piles,p=>p.Northing);
  const adjMaxN=hasAdj?arrMaxBy(adjPiles,p=>p.Northing):0;
  const adjMinN=hasAdj?arrMinBy(adjPiles,p=>p.Northing):0;
  const gapX1=adjSide==='north'?xS(mainMaxN):xS(adjMaxN);
  const gapX2=adjSide==='north'?xS(adjMinN):xS(mainMinN);
  const pts=(arr,xf,yf)=>arr.map((p,i)=>`${i===0?"M":"L"}${xf(p)+P.l},${yf(p)+P.t}`).join(" ");
  const gPts=piles.map(p=>({x:p.Northing,y:p.ExistingGround}));
  const tPts=results.map(r=>({x:r.Northing,y:r.TopOfPile}));
  const aPts=results.map(r=>({x:r.Northing,y:r.FinalGround}));
  const hasCutFill=results.some(r=>Math.abs(r.CutFill)>0.005);
  const yRange=maxE-minE,step=yRange<1?0.25:yRange<3?0.5:yRange<8?1:2;
  const yTicks=[];for(let v=Math.ceil(minE/step)*step;v<=maxE;v=Math.round((v+step)*1e4)/1e4)yTicks.push(v);
  return(
    <svg width={W} height={H} style={{overflow:"visible"}}>
      {yTicks.map(t=>(
        <g key={t}>
          <line x1={P.l} y1={yS(t)+P.t} x2={P.l+cW} y2={yS(t)+P.t} stroke="#e2e3e5" strokeWidth="0.5"/>
          <text x={P.l-5} y={yS(t)+P.t+4} textAnchor="end" fontSize="9" fill="#4d4d4f">{t.toFixed(1)}</text>
        </g>
      ))}
      {/* Ground fill */}
      <path d={`${pts(gPts,p=>xS(p.x),p=>yS(p.y))} L${xS(maxN)+P.l},${cH+P.t} L${P.l},${cH+P.t} Z`} fill="#f0f5f0"/>
      {/* Adjusted ground */}
      {hasCutFill&&<path d={`${pts(aPts,p=>xS(p.x),p=>yS(p.y))} L${xS(maxN)+P.l},${cH+P.t} L${P.l},${cH+P.t} Z`} fill="#efefef"/>}
      {/* Cut zones (red) and fill zones (blue) */}
      {results.map((r,i)=>r.CutFill!==0&&Math.abs(r.CutFill)>0.001&&(
        <rect key={i}
          x={xS(r.Northing)+P.l-4} y={r.CutFill<0?yS(r.ExistingGround)+P.t:yS(r.FinalGround)+P.t}
          width={8}
          height={Math.abs(yS(r.FinalGround)-yS(r.ExistingGround))}
          fill={r.CutFill<0?"#e12a3f55":"#1f66ad55"} stroke={r.CutFill<0?"#e12a3f":"#1f66ad"} strokeWidth="0.5"/>
      ))}
      {/* Existing ground */}
      <path d={pts(gPts,p=>xS(p.x),p=>yS(p.y))} fill="none" stroke="#4d4d4f" strokeWidth="2"/>
      {/* Adjusted ground line */}
      {hasCutFill&&<path d={pts(aPts,p=>xS(p.x),p=>yS(p.y))} fill="none" stroke="#8a6300" strokeWidth="1.5" strokeDasharray="4,3"/>}
      {/* Reveal spans */}
      {results.map((r,i)=>{
        const revOk=r.FinalReveal>=results[0]?.Violations?.length>=0;
        return<line key={i} x1={xS(r.Northing)+P.l} y1={yS(r.TopOfPile)+P.t} x2={xS(r.Northing)+P.l} y2={yS(r.FinalGround)+P.t} stroke="#27874733" strokeWidth="1.5"/>;
      })}
      {/* TOP line */}
      <path d={pts(tPts,p=>xS(p.x),p=>yS(p.y))} fill="none" stroke="#ad1f2b" strokeWidth="2.5"/>
      {/* Pile dots */}
      {results.map((r,i)=>(
        <circle key={i} cx={xS(r.Northing)+P.l} cy={yS(r.TopOfPile)+P.t} r="3.5"
          fill={r.Violations?.length>0?"#e12a3f":"#ad1f2b"}
          stroke="#ffffff" strokeWidth="1"/>
      ))}
      {/* Axes */}
      <line x1={P.l} y1={P.t} x2={P.l} y2={P.t+cH} stroke="#4d4d4f" strokeWidth="1"/>
      <line x1={P.l} y1={P.t+cH} x2={P.l+cW} y2={P.t+cH} stroke="#4d4d4f" strokeWidth="1"/>
      <text x={P.l+cW/2} y={H-5} textAnchor="middle" fontSize="9" fill="#4d4d4f">← South · Northing · North →</text>
      <text x={11} y={P.t+cH/2} textAnchor="middle" fontSize="9" fill="#4d4d4f" transform={`rotate(-90,11,${P.t+cH/2})`}>Elev (ft)</text>
      {/* Gap zone */}
      {hasAdj&&gapX2>gapX1&&<rect x={gapX1+P.l} y={P.t} width={gapX2-gapX1} height={cH} fill="#ffffff"/>}
      {hasAdj&&gapX2>gapX1&&<line x1={gapX1+P.l} y1={P.t} x2={gapX1+P.l} y2={P.t+cH} stroke="#bcbec0" strokeWidth="1" strokeDasharray="4,3"/>}
      {hasAdj&&gapX2>gapX1&&<line x1={gapX2+P.l} y1={P.t} x2={gapX2+P.l} y2={P.t+cH} stroke="#bcbec0" strokeWidth="1" strokeDasharray="4,3"/>}
      {/* Adjacent tracker series */}
      {hasAdj&&<path d={pts(adjGPts,p=>xS(p.x),p=>yS(p.y))} fill="none" stroke="#3a6d82" strokeWidth="2" strokeDasharray="6,3"/>}
      {adjHasCF&&<path d={pts(adjAPts,p=>xS(p.x),p=>yS(p.y))} fill="none" stroke="#8a6300" strokeWidth="1.5" strokeDasharray="4,2"/>}
      {hasAdj&&adjResults.map((r,i)=>r.CutFill!==0&&Math.abs(r.CutFill??0)>0.001?(
        <rect key={i} x={xS(r.Northing)+P.l-4} y={r.CutFill<0?yS(r.ExistingGround)+P.t:yS(r.FinalGround)+P.t}
          width={8} height={Math.abs(yS(r.FinalGround)-yS(r.ExistingGround))}
          fill={r.CutFill<0?"#e12a3f33":"#1f66ad33"} stroke={r.CutFill<0?"#e12a3f":"#1f66ad"} strokeWidth="0.5"/>
      ):null)}
      {hasAdj&&<path d={pts(adjTPts,p=>xS(p.x),p=>yS(p.y))} fill="none" stroke="#1f6fd0" strokeWidth="2.5" strokeDasharray="6,3"/>}
      {hasAdj&&adjResults.map((r,i)=>(
        <circle key={i} cx={xS(r.Northing)+P.l} cy={yS(r.TopOfPile)+P.t} r="3" fill="#1f6fd0" stroke="#f5f5f5" strokeWidth="1"/>
      ))}
      {hasAdj&&<text x={xS((adjMinN+adjMaxN)/2)+P.l} y={P.t+10} textAnchor="middle" fontSize="8" fill="#1f6fd0">{adjLabel}</text>}
      {/* Legend */}
      <g transform={`translate(${P.l+cW-156},${P.t+4})`}>
        <rect width="156" height={hasAdj?82:58} rx="4" fill="#ffffff" opacity="0.9"/>
        <line x1="8" y1="13" x2="22" y2="13" stroke="#4d4d4f" strokeWidth="2"/><text x="26" y="17" fontSize="8.5" fill="#333132">Existing Ground</text>
        <line x1="8" y1="25" x2="22" y2="25" stroke="#ad1f2b" strokeWidth="2.5"/><text x="26" y="29" fontSize="8.5" fill="#333132">Top of Pile</text>
        <line x1="8" y1="37" x2="22" y2="37" stroke="#8a6300" strokeWidth="1.5" strokeDasharray="4,3"/><text x="26" y="41" fontSize="8.5" fill="#333132">Adjusted Ground</text>
        <rect x="8" y="46" width="8" height="7" fill="#e12a3f55" stroke="#e12a3f" strokeWidth="0.5"/><text x="20" y="53" fontSize="8.5" fill="#333132">Cut</text>
        <rect x="52" y="46" width="8" height="7" fill="#1f66ad55" stroke="#1f66ad" strokeWidth="0.5"/><text x="64" y="53" fontSize="8.5" fill="#333132">Fill</text>
        {hasAdj&&<line x1="8" y1="61" x2="22" y2="61" stroke="#3a6d82" strokeWidth="2" strokeDasharray="6,3"/>}
        {hasAdj&&<text x="26" y="65" fontSize="8.5" fill="#1f6fd0">EG ({adjLabel})</text>}
        {hasAdj&&<line x1="8" y1="73" x2="22" y2="73" stroke="#1f6fd0" strokeWidth="2.5" strokeDasharray="6,3"/>}
        {hasAdj&&<text x="26" y="77" fontSize="8.5" fill="#1f6fd0">TOP ({adjLabel})</text>}
      </g>
    </svg>
  );
}

function SlopeChart({results,maxSlope,maxSlopeDelta}){
  if(!results||results.length<2)return null;
  const slopeData=results.filter(r=>r.Slope!==null).map(r=>({n:r.Northing,v:r.Slope}));
  const deltaData=results.filter(r=>r.SlopeDelta!==null).map(r=>({n:r.Northing,v:r.SlopeDelta}));
  if(slopeData.length===0)return null;
  const W=680,H=140,P={l:56,r:16,t:10,b:32};
  const cW=W-P.l-P.r,cH=H-P.t-P.b;
  const minN=arrMinBy(results,r=>r.Northing),maxN=arrMaxBy(results,r=>r.Northing);
  const allV=[...slopeData.map(d=>d.v),...deltaData.map(d=>d.v),maxSlope,-maxSlope,maxSlopeDelta,-maxSlopeDelta];
  const minV=arrMin(allV)*1.2,maxV=arrMax(allV)*1.2;
  const xS=n=>((n-minN)/(maxN-minN||1))*cW+P.l;
  const yS=v=>cH-((v-minV)/(maxV-minV||1))*cH+P.t;
  const zero=yS(0);
  const poly=pts=>pts.map((p,i)=>`${i===0?"M":"L"}${xS(p.n)},${yS(p.v)}`).join(" ");
  return(
    <svg width={W} height={H} style={{overflow:"visible"}}>
      <line x1={P.l} y1={zero} x2={P.l+cW} y2={zero} stroke="#4d4d4f" strokeWidth="1"/>
      <line x1={P.l} y1={yS(maxSlope)} x2={P.l+cW} y2={yS(maxSlope)} stroke="#e12a3f66" strokeWidth="1" strokeDasharray="4,3"/>
      <line x1={P.l} y1={yS(-maxSlope)} x2={P.l+cW} y2={yS(-maxSlope)} stroke="#e12a3f66" strokeWidth="1" strokeDasharray="4,3"/>
      <line x1={P.l} y1={yS(maxSlopeDelta)} x2={P.l+cW} y2={yS(maxSlopeDelta)} stroke="#8a630066" strokeWidth="1" strokeDasharray="3,4"/>
      <line x1={P.l} y1={yS(-maxSlopeDelta)} x2={P.l+cW} y2={yS(-maxSlopeDelta)} stroke="#8a630066" strokeWidth="1" strokeDasharray="3,4"/>
      {[["0","#4d4d4f",0],[`±${(maxSlope*100).toFixed(1)}%`,"#e12a3f",maxSlope],[`±${(maxSlopeDelta*100).toFixed(2)}%`,"#8a6300",maxSlopeDelta]].map(([lbl,col,v])=>(
        <text key={lbl} x={P.l-4} y={yS(v)+4} textAnchor="end" fontSize="8" fill={col}>{lbl}</text>
      ))}
      <path d={poly(slopeData)} fill="none" stroke="#ad1f2b" strokeWidth="1.8"/>
      <path d={poly(deltaData)} fill="none" stroke="#8a6300" strokeWidth="1.3" strokeDasharray="5,3"/>
      {slopeData.map((s,i)=>(
        <circle key={i} cx={xS(s.n)} cy={yS(s.v)} r="2.5" fill={Math.abs(s.v)>maxSlope?"#e12a3f":"#ad1f2b"}/>
      ))}
      {deltaData.map((d,i)=>(
        <circle key={i} cx={xS(d.n)} cy={yS(d.v)} r="2" fill={Math.abs(d.v)>maxSlopeDelta?"#e12a3f":"#8a6300"}/>
      ))}
      <line x1={P.l} y1={P.t} x2={P.l} y2={P.t+cH} stroke="#4d4d4f" strokeWidth="1"/>
      <line x1={P.l} y1={P.t+cH} x2={P.l+cW} y2={P.t+cH} stroke="#4d4d4f" strokeWidth="1"/>
      <text x={P.l+cW/2} y={H-2} textAnchor="middle" fontSize="8.5" fill="#4d4d4f">Pile Location (S→N)</text>
      <g transform={`translate(${P.l+cW-170},${P.t+3})`}>
        <rect width="170" height="32" rx="3" fill="#ffffff" opacity="0.9"/>
        <line x1="6" y1="11" x2="18" y2="11" stroke="#ad1f2b" strokeWidth="1.8"/><text x="22" y="14" fontSize="7.5" fill="#333132">Tube slope (%)</text>
        <line x1="6" y1="23" x2="18" y2="23" stroke="#8a6300" strokeWidth="1.3" strokeDasharray="5,3"/><text x="22" y="26" fontSize="7.5" fill="#333132">Slope Δ (flex joint rotation)</text>
      </g>
    </svg>
  );
}

// ── REVEAL BAR ───────────────────────────────────────────────────────────────
function RevealBars({results,minReveal,maxReveal,targetReveal}){
  if(!results||results.length===0)return null;
  return(
    <div>
      <div style={{display:"flex",gap:2,alignItems:"flex-end",height:56}}>
        {results.map((r,i)=>{
          const ok=r.FinalReveal>=minReveal&&r.FinalReveal<=maxReveal;
          const h=Math.max(4,((r.FinalReveal-minReveal)/(maxReveal-minReveal||1))*52);
          return(
            <div key={i} title={`Pile ${i+1}: ${r.FinalReveal.toFixed(3)} ft`} style={{flex:1,
              background:ok?"#27874733":"#e12a3f33",border:`1px solid ${ok?"#27874777":"#e12a3f"}`,
              borderRadius:"2px 2px 0 0",height:h,cursor:"default"}}/>
          );
        })}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#4d4d4f",marginTop:2}}>
        <span>Min: {results.length?arrMinBy(results,r=>r.FinalReveal).toFixed(3):""} ft</span>
        <span style={{color:"#ad1f2b"}}>Target: {targetReveal} ft</span>
        <span>Max: {results.length?arrMaxBy(results,r=>r.FinalReveal).toFixed(3):""} ft</span>
      </div>
    </div>
  );
}

// ── EXPLANATION PANEL ────────────────────────────────────────────────────────
function ExplanationCard({results}){
  if(!results||results.length===0)return null;
  const r=results[0];
  const method=r.Method||"";
  const isSL=method==="StraightLine";
  const isTF=method==="Terrain Follow (No Grade)"||method==="Terrain Follow (w/ Grade)";
  const hasCF=r.TotalCut>0.001||r.TotalFill>0.001;
  return(
    <div style={{background:"#f5f5f5",border:"1px solid #bcbec0",borderRadius:8,padding:"14px 16px",marginBottom:14}}>
      <div style={{fontSize:10,color:"#4d4d4f",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>
        ⚙ Method Logic
      </div>
      {/* Method badge */}
      <div style={{display:"inline-block",
        background:isSL?"#f0f0f0":"#fff8f0",
        border:`1px solid ${isSL?"#1f66ad44":"#8a630044"}`,
        borderRadius:4,padding:"3px 10px",fontSize:11,marginBottom:10,
        color:isSL?"#1f66ad":"#8a6300",fontWeight:700}}>
        {isSL?"Straight Line — No Earthwork":isTF2?"Terrain Follow — No Earthwork":"Terrain Follow — Balanced Earthwork"}
      </div>
      <div style={{fontSize:11,color:"#333132",lineHeight:1.7,marginBottom:10}}>{r.Explanation}</div>

      {/* Algorithm steps visualization */}
      <div style={{borderTop:"1px solid #e2e3e5",paddingTop:10,marginTop:4}}>
        <div style={{fontSize:10,color:"#4d4d4f",marginBottom:8,letterSpacing:"0.08em",textTransform:"uppercase"}}>Decision Path</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {[
            {label:"1. Straight line — no earthwork", done:true, ok:isSL,
              desc:"OLS best-fit slope through existing ground. Accepted only if every reveal, tube slope, and flex joint rotation is within bounds — zero grading required."},
            {label:"2. Terrain follow — balanced earthwork", done:isTF, ok:isTF,
              desc:"Tube set to EG + target reveal at each pile, smoothed to enforce max slope and max flex joint rotation. Tube shifted to balance cut vs. fill within this row. Ground adjusted only where reveal still falls outside bounds after balancing."},
          ].map(({label,done,ok,desc},i)=>(
            <div key={i} style={{display:"flex",gap:8,opacity:done?1:0.35}}>
              <div style={{width:18,height:18,borderRadius:"50%",flexShrink:0,marginTop:1,
                background:ok?"#ad1f2b":done?"#8a6300":"#4d4d4f",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,
                color:ok?"#ffffff":done?"#ffffff":"#4d4d4f",fontWeight:700}}>
                {ok?"✓":done?"→":"○"}
              </div>
              <div>
                <div style={{fontSize:11,color:ok?"#ad1f2b":done?"#8a6300":"#4d4d4f",fontWeight:ok?700:400}}>{label}</div>
                <div style={{fontSize:10,color:"#4d4d4f",lineHeight:1.5}}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cut/fill balance */}
      {hasCF&&(
        <div style={{borderTop:"1px solid #e2e3e5",paddingTop:10,marginTop:10}}>
          <div style={{fontSize:10,color:"#4d4d4f",marginBottom:6,letterSpacing:"0.08em",textTransform:"uppercase"}}>Earthwork Balance</div>
          <div style={{display:"flex",gap:8,alignItems:"stretch"}}>
            <div style={{flex:1,background:"#fff0f0",border:"1px solid #e12a3f",borderRadius:4,padding:"6px 10px"}}>
              <div style={{fontSize:9,color:"#e12a3f",letterSpacing:"0.1em"}}>CUT</div>
              <div style={{fontSize:16,color:"#e12a3f",fontWeight:700}}>{r.TotalCut.toFixed(3)}<span style={{fontSize:10,fontWeight:400}}> ft</span></div>
            </div>
            <div style={{display:"flex",alignItems:"center",fontSize:14,color:"#4d4d4f"}}>⇌</div>
            <div style={{flex:1,background:"#fafafa",border:"1px solid #278747",borderRadius:4,padding:"6px 10px"}}>
              <div style={{fontSize:9,color:"#e12a3f",letterSpacing:"0.1em"}}>FILL</div>
              <div style={{fontSize:16,color:"#1f66ad",fontWeight:700}}>{r.TotalFill.toFixed(3)}<span style={{fontSize:10,fontWeight:400}}> ft</span></div>
            </div>
            <div style={{display:"flex",alignItems:"center",fontSize:14,color:"#4d4d4f"}}>=</div>
            <div style={{flex:1,background:r.NetImbalance<0.1?"#fafafa":"#fff8f0",
              border:`1px solid ${r.NetImbalance<0.1?"#4d4d4f":"#fff3e0"}`,borderRadius:4,padding:"6px 10px"}}>
              <div style={{fontSize:9,color:r.NetImbalance<0.1?"#e12a3f":"#8a6300",letterSpacing:"0.1em"}}>NET</div>
              <div style={{fontSize:16,color:r.NetImbalance<0.1?"#ad1f2b":"#8a6300",fontWeight:700}}>
                {r.NetImbalance.toFixed(3)}<span style={{fontSize:10,fontWeight:400}}> ft</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Violations */}
      {r.Violations?.length>0&&(
        <div style={{borderTop:"1px solid #e2e3e5",paddingTop:10,marginTop:10}}>
          <div style={{fontSize:10,color:"#e12a3f",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4}}>⚠ Active Violations ({r.Violations.length})</div>
          {r.Violations.map((v,i)=>(
            <div key={i} style={{fontSize:10,color:"#e12a3f",lineHeight:1.6}}>• {v}</div>
          ))}
        </div>
      )}
    </div>
  );
}


function FleetStats({summary,adjacencyFlags}){
  const ok=summary.filter(s=>s.ok).length, viol=summary.length-ok;
  const sl=summary.filter(s=>classifyMethod(s.method)==="straight").length;
  const tf2=summary.filter(s=>classifyMethod(s.method)==="optimized").length;
  const tf3=summary.filter(s=>classifyMethod(s.method)==="regrade").length;
  const tCut=summary.reduce((a,s)=>a+s.totalCut,0);
  const tFill=summary.reduce((a,s)=>a+s.totalFill,0);
  const nsF=(adjacencyFlags?.ns||[]).length;
  const ewF=(adjacencyFlags?.ew||[]).length;
  const rows=[[`Total Trackers`,summary.length,null],[`✓ Compliant`,ok,"#ad1f2b"],
    [`⚠ Violations`,viol,viol>0?"#e12a3f":"#4d4d4f"],
    ["Straight Line",sl,"#1f66ad"],["Optimized (no regrade)",tf2,"#8a6300"],["Needs Regrade",tf3,"#c2571c"],
    ["Fleet Cut Total",tCut.toFixed(2)+" ft","#e12a3f"],
    ["Fleet Fill Total",tFill.toFixed(2)+" ft","#1f66ad"],
    ["⚠ N-S End Flags",nsF,nsF>0?"#c2571c":"#4d4d4f"],
    ["⚠ E-W End Flags",ewF,ewF>0?"#7b4bb5":"#4d4d4f"]];
  return(
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      {rows.map(([l,v,col])=>(
        <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:9,color:"#4d4d4f"}}>{l}</span>
          <span style={{fontSize:11,color:col||"#333132",fontWeight:600}}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function FleetReadiness({allResults,trackerIDs,progress}){
  const done=Object.keys(allResults).length;
  const pct=trackerIDs.length>0?done/trackerIDs.length:0;
  return(
    <div style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontSize:10,color:"#4d4d4f"}}>Fleet computation</span>
        <span style={{fontSize:10,color:pct>=1?"#ad1f2b":"#8a6300"}}>
          {progress.running
            ?(progress.phase||`${progress.done} / ${progress.total} trackers…`)
            :pct>=1
              ?`Complete — ${done.toLocaleString()} trackers ready`
              :"Waiting for data"}
        </span>
      </div>
      <div style={{height:4,background:"#e0e0e0",borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct*100}%`,
          background:pct>=1?"#27874766":"#8a630066",
          borderRadius:2,transition:"width 0.2s"}}/>
      </div>
    </div>
  );
}


// ── N-S Adjacency Correction ─────────────────────────────────────────────────
// After fleet optimization, for each flagged N-S pair apply a correction to
// bring the adjacent ends within maxNSDelta. Pile 1 gets the full correction,
// pile 2 gets 50%, then slope-delta clamping propagates inward as needed.
// No earthwork re-balance is performed — grading is added only where reveals
// go out of bounds as a result of the correction.
function propagateCorrection(results, correction, direction, dx, n, maxSlope, maxSlopeDelta, minReveal, maxReveal){
  // Apply 2-pile taper at the end pile, then run full slope+delta clamp through
  // the tracker to resolve any constraint violations created by the correction.
  // Grading is added only where reveals fall outside bounds after clamping.
  const tops = results.map(r=>r.TopOfPile);
  const grounds = results.map(r=>r.ExistingGround);

  // Pile 1 and pile 2 move together by the full correction amount (no taper).
  // Then propagate inward in one direction only using slope+delta clamping.
  // direction='south_to_north': end pile is pile 0 (south end), propagate northward.
  // direction='north_to_south': end pile is pile n-1 (north end), propagate southward.
  if(direction==='south_to_north'){
    tops[0] += correction;
    if(n>1) tops[1] += correction; // move together
    // Propagate northward from pile 2 onward: clamp slope delta only
    for(let i=1;i<n-1;i++){
      const sp=(tops[i]-tops[i-1])/dx[i-1];
      const sc=(tops[i+1]-tops[i])/dx[i];
      const d=sc-sp;
      if(Math.abs(d)>maxSlopeDelta) tops[i+1]=tops[i]+(sp+(d>0?maxSlopeDelta:-maxSlopeDelta))*dx[i];
    }
    // Also enforce slope constraint northward
    for(let i=1;i<n;i++){
      const s=(tops[i]-tops[i-1])/dx[i-1];
      if(Math.abs(s)>maxSlope) tops[i]=tops[i-1]+(s>0?maxSlope:-maxSlope)*dx[i-1];
    }
  } else {
    tops[n-1] += correction;
    if(n>1) tops[n-2] += correction; // move together
    // Propagate southward from pile n-3 onward: clamp slope delta only
    for(let i=n-3;i>=0;i--){
      const sc=(tops[i+1]-tops[i])/dx[i];
      const sn=(i+2<n)?(tops[i+2]-tops[i+1])/dx[i+1]:sc;
      const d=sn-sc;
      if(Math.abs(d)>maxSlopeDelta) tops[i]=tops[i+1]-(sn-(d>0?maxSlopeDelta:-maxSlopeDelta))*dx[i];
    }
    // Also enforce slope constraint southward
    for(let i=n-2;i>=0;i--){
      const s=(tops[i+1]-tops[i])/dx[i];
      if(Math.abs(s)>maxSlope) tops[i]=tops[i+1]-(s>0?maxSlope:-maxSlope)*dx[i];
    }
  }

  // Apply updated tops, adding grading where reveals fall outside bounds
  return results.map((r,i)=>{
    const newTop=tops[i];
    const rev=newTop-grounds[i];
    let finalGround=grounds[i];
    let cutFill=0;
    if(rev>maxReveal+0.001){
      const fill=rev-maxReveal;
      finalGround=grounds[i]+fill;
      cutFill=fill;
    } else if(rev<minReveal-0.001){
      const cut=minReveal-rev;
      finalGround=grounds[i]-cut;
      cutFill=-cut;
    }
    return{...r,TopOfPile:newTop,FinalReveal:newTop-finalGround,FinalGround:finalGround,CutFill:cutFill};
  });
}

function applyNSCorrections(allResults, trackerIDs, constraints){
  const{maxNSDelta,maxEWSlope,maxNSGap,minReveal,maxReveal,maxSlope,maxSlopeDelta,
        nsEndMode='delta',maxNSSlope=0.10}=constraints;
  // Mode-aware end limit: fixed ft, or slope % scaled by the actual gap
  const nsLimit=(gap)=>nsEndMode==='slope'?maxNSSlope*Math.max(gap,0.1):maxNSDelta;

  // Build end-pile index per tracker (S→N sorted)
  const ends={};
  for(const tid of trackerIDs){
    const res=allResults[tid]; if(!res||res.length===0)continue;
    const sorted=[...res].sort((a,b)=>a.Northing-b.Northing);
    const dx=[];
    for(let i=0;i<sorted.length-1;i++) dx.push(sorted[i+1].Northing-sorted[i].Northing);
    ends[tid]={sorted, dx, n:sorted.length,
      southTOP:sorted[0].TopOfPile, northTOP:sorted[sorted.length-1].TopOfPile,
      southN:sorted[0].Northing,    northN:sorted[sorted.length-1].Northing,
      southE:sorted[0].Easting,     northE:sorted[sorted.length-1].Easting,
      hasCutFill:sorted.some(r=>Math.abs(r.CutFill??0)>0.001),
    };
  }

  // Build easting lookup
  const byEasting={};
  for(const tid of trackerIDs){
    const e=ends[tid]; if(!e)continue;
    const key=Math.round(e.northE);
    if(!byEasting[key])byEasting[key]=[];
    byEasting[key].push(tid);
  }

  // Find all N-S violations and sort by |delta| descending
  const violations=[];
  for(const tid of trackerIDs){
    const e=ends[tid]; if(!e)continue;
    const key=Math.round(e.southE);
    for(const other of (byEasting[key]||[])){
      if(other===tid)continue;
      const oe=ends[other]; if(!oe)continue;
      const gap=e.southN-oe.northN;
      if(gap>=0&&gap<=maxNSGap){
        const delta=e.southTOP-oe.northTOP; // positive = northern tracker S end is higher
        if(Math.abs(delta)>nsLimit(gap)){
          violations.push({southern:other, northern:tid, delta, gap});
        }
      }
    }
  }
  violations.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));

  // Apply corrections
  const updated={...allResults};
  const residual=[];

  for(const{southern,northern,delta,gap}of violations){
    const es=ends[southern], en=ends[northern];
    if(!es||!en)continue;

    // Recompute current tops from potentially-already-updated results
    const resSouth=[...updated[southern]].sort((a,b)=>a.Northing-b.Northing);
    const resNorth=[...updated[northern]].sort((a,b)=>a.Northing-b.Northing);
    const curDelta=resNorth[0].TopOfPile-resSouth[resSouth.length-1].TopOfPile;
    const pairLimit=nsLimit(gap);
    if(Math.abs(curDelta)<=pairLimit)continue; // already resolved

    // Determine correction split
    const southHasCF=resSouth.some(r=>Math.abs(r.CutFill??0)>0.001);
    const northHasCF=resNorth.some(r=>Math.abs(r.CutFill??0)>0.001);

    // curDelta > 0 means northern's south end is higher than southern's north end
    // To close the gap: lower northern's south end (corrNorth < 0) and/or raise southern's north end (corrSouth > 0)
    const sign = curDelta > 0 ? 1 : -1;
    const absDelta = Math.abs(curDelta);
    // Only close the excess beyond the allowed limit — don't force ends to be equal.
    // e.g. violation=2.5ft, limit=1.0ft → only need to move (2.5-1.0)=1.5ft total.
    const excessDelta = Math.max(0, absDelta - pairLimit);

    // Reveal headroom at the relevant end piles
    // Northern tracker south end: how much can it move down (toward minReveal)?
    const northDownHeadroom = Math.max(0, resNorth[0].FinalReveal - minReveal);
    // Northern tracker south end: how much can it move up (toward maxReveal)?
    const northUpHeadroom   = Math.max(0, maxReveal - resNorth[0].FinalReveal);
    // Southern tracker north end: how much can it move up (toward maxReveal)?
    const southUpHeadroom   = Math.max(0, maxReveal - resSouth[resSouth.length-1].FinalReveal);
    // Southern tracker north end: how much can it move down (toward minReveal)?
    const southDownHeadroom = Math.max(0, resSouth[resSouth.length-1].FinalReveal - minReveal);

    // Headroom in the correcting direction
    // If curDelta > 0: northern needs to go down, southern needs to go up
    const northHeadroom = curDelta > 0 ? northDownHeadroom : northUpHeadroom;
    const southHeadroom = curDelta > 0 ? southUpHeadroom   : southDownHeadroom;

    let corrNorth = 0, corrSouth = 0;

    if(northHasCF && southHasCF){
      // Both have earthwork — equal split of excess only
      corrNorth = -sign * excessDelta * 0.5;
      corrSouth =  sign * excessDelta * 0.5;

    } else if(northHasCF && !southHasCF){
      // Southern has no earthwork — absorb up to its headroom first, then split remainder with grading
      const southAbsorb = Math.min(southHeadroom, excessDelta);
      const remainder   = excessDelta - southAbsorb;
      corrSouth =  sign * southAbsorb + sign * remainder * 0.5;
      corrNorth = -sign * remainder * 0.5;

    } else if(southHasCF && !northHasCF){
      // Northern has no earthwork — absorb up to its headroom first, then split remainder with grading
      const northAbsorb = Math.min(northHeadroom, excessDelta);
      const remainder   = excessDelta - northAbsorb;
      corrNorth = -sign * northAbsorb - sign * remainder * 0.5;
      corrSouth =  sign * remainder * 0.5;

    } else {
      // Neither has earthwork (both Step 2) — absorb proportionally by reveal headroom,
      // then split any remainder equally with grading
      const totalHeadroom = northHeadroom + southHeadroom;
      if(totalHeadroom < 1e-6){
        corrNorth = -sign * excessDelta * 0.5;
        corrSouth =  sign * excessDelta * 0.5;
      } else {
        const northAbsorb = Math.min(northHeadroom, excessDelta * (northHeadroom / totalHeadroom));
        const southAbsorb = Math.min(southHeadroom, excessDelta * (southHeadroom / totalHeadroom));
        const absorbed = northAbsorb + southAbsorb;
        const remainder = excessDelta - absorbed;
        corrNorth = -sign * northAbsorb - sign * remainder * 0.5;
        corrSouth =  sign * southAbsorb + sign * remainder * 0.5;
      }
    }

    // Apply to northern tracker (adjust south end, propagate northward)
    if(Math.abs(corrNorth)>0.001){
      const dxN=[];
      for(let i=0;i<resNorth.length-1;i++) dxN.push(resNorth[i+1].Northing-resNorth[i].Northing);
      const corrected=propagateCorrection(resNorth,corrNorth,'south_to_north',
        dxN,resNorth.length,maxSlope,maxSlopeDelta,minReveal,maxReveal);
      updated[northern]=corrected;
      ends[northern]={...ends[northern],
        southTOP:corrected[0].TopOfPile,
        northTOP:corrected[corrected.length-1].TopOfPile};
    }

    // Apply to southern tracker (adjust north end, propagate southward)
    if(Math.abs(corrSouth)>0.001){
      const dxS=[];
      for(let i=0;i<resSouth.length-1;i++) dxS.push(resSouth[i+1].Northing-resSouth[i].Northing);
      const corrected=propagateCorrection(resSouth,corrSouth,'north_to_south',
        dxS,resSouth.length,maxSlope,maxSlopeDelta,minReveal,maxReveal);
      updated[southern]=corrected;
      ends[southern]={...ends[southern],
        northTOP:corrected[corrected.length-1].TopOfPile,
        southTOP:corrected[0].TopOfPile};
    }

    // Check if residual violation remains
    const newDelta=Math.abs(
      ends[northern].southTOP - ends[southern].northTOP
    );
    if(newDelta>pairLimit+0.001){
      residual.push({southern,northern,delta:newDelta,reason:"propagation limited by delta constraint"});
    }
  }

  // ── Re-check N-S slope/delta from corrected end piles ─────────────────────
  // After end corrections, propagate slope+delta clamp inward from each
  // corrected end to resolve any violations created by the adjustment.
  const correctedTids=new Set();
  for(const{southern,northern,gap}of violations){
    if(Math.abs((ends[northern]?.southTOP||0)-(ends[southern]?.northTOP||0))<=nsLimit(gap)+0.001){
      correctedTids.add(southern); correctedTids.add(northern);
    }
  }
  for(const tid of correctedTids){
    const res=updated[tid]; if(!res||res.length<2)continue;
    const sorted=[...res].sort((a,b)=>a.Northing-b.Northing);
    const n=sorted.length;
    const dx=[];
    for(let i=0;i<n-1;i++) dx.push(sorted[i+1].Northing-sorted[i].Northing);
    const tops=sorted.map(r=>r.TopOfPile);
    // Forward slope clamp
    for(let i=1;i<n;i++){
      const s=(tops[i]-tops[i-1])/dx[i-1];
      if(Math.abs(s)>maxSlope) tops[i]=tops[i-1]+(s>0?maxSlope:-maxSlope)*dx[i-1];
    }
    // Backward slope clamp
    for(let i=n-2;i>=0;i--){
      const s=(tops[i+1]-tops[i])/dx[i];
      if(Math.abs(s)>maxSlope) tops[i]=tops[i+1]-(s>0?maxSlope:-maxSlope)*dx[i];
    }
    // Forward delta clamp (inline)
    for(let i=1;i<n-1;i++){
      const sp=(tops[i]-tops[i-1])/dx[i-1];
      const sc=(tops[i+1]-tops[i])/dx[i];
      const d=sc-sp;
      if(Math.abs(d)>maxSlopeDelta) tops[i+1]=tops[i]+(sp+(d>0?maxSlopeDelta:-maxSlopeDelta))*dx[i];
    }
    // Backward delta clamp
    for(let i=n-3;i>=0;i--){
      const sc=(tops[i+1]-tops[i])/dx[i];
      const sn=i+2<n?(tops[i+2]-tops[i+1])/dx[i+1]:sc;
      const d=sn-sc;
      if(Math.abs(d)>maxSlopeDelta) tops[i]=tops[i+1]-(sn-(d>0?maxSlopeDelta:-maxSlopeDelta))*dx[i];
    }
    // Write back with grading where reveals go OOB
    updated[tid]=sorted.map((r,i)=>{
      const newTop=tops[i];
      const rev=newTop-r.ExistingGround;
      let fg=r.ExistingGround,cf=0;
      if(rev>maxReveal+0.001){fg=r.ExistingGround+(rev-maxReveal);cf=rev-maxReveal;}
      else if(rev<minReveal-0.001){fg=r.ExistingGround-(minReveal-rev);cf=-(minReveal-rev);}
      return{...r,TopOfPile:newTop,FinalReveal:newTop-fg,FinalGround:fg,CutFill:cf};
    });
  }

  return{updated, residual, correctedCount:violations.length-residual.length};
}


function ProfileWithAdj({selectedTracker,piles,results,trackerMap,trackerIDs,allResults,adjacencyFlags,constraints}){
  const nsAdj=adjacencyFlags.ns||[];
  const asSouth=nsAdj.find(f=>f.trackerB===selectedTracker);
  const asNorth=nsAdj.find(f=>f.trackerA===selectedTracker);
  let adjTid=null, adjSide=null;
  if(asSouth){adjTid=asSouth.trackerA;adjSide='south';}
  else if(asNorth){adjTid=asNorth.trackerB;adjSide='north';}
  if(!adjTid&&trackerMap[selectedTracker]){
    const myPiles=[...trackerMap[selectedTracker]].sort((a,b)=>a.Northing-b.Northing);
    const mySouthN=myPiles[0].Northing,myNorthN=myPiles[myPiles.length-1].Northing;
    const myE=Math.round(myPiles[0].Easting);
    for(const tid of trackerIDs){
      if(tid===selectedTracker||!allResults[tid])continue;
      const tPiles=[...trackerMap[tid]].sort((a,b)=>a.Northing-b.Northing);
      if(Math.round(tPiles[0].Easting)!==myE)continue;
      const tNorthN=tPiles[tPiles.length-1].Northing;
      const tSouthN=tPiles[0].Northing;
      if(Math.abs(tNorthN-mySouthN)<=constraints.maxNSGap){adjTid=tid;adjSide='south';break;}
      if(Math.abs(tSouthN-myNorthN)<=constraints.maxNSGap){adjTid=tid;adjSide='north';break;}
    }
  }
  const adjPiles=adjTid&&trackerMap[adjTid]?[...trackerMap[adjTid]].sort((a,b)=>a.Northing-b.Northing):null;
  const adjResults=adjTid&&allResults[adjTid]?[...allResults[adjTid]].sort((a,b)=>a.Northing-b.Northing):null;
  return(
    <div>
      <div style={{fontSize:10,color:"#4d4d4f",letterSpacing:"0.08em",marginBottom:6}}>
        ELEVATION PROFILE — {selectedTracker}
        {adjTid&&<span style={{color:"#1f6fd0",marginLeft:8}}>+ {adjTid} ({adjSide})</span>}
      </div>
      <div style={{overflowX:"auto"}}>
        <ElevChart piles={piles} results={results}
          adjPiles={adjPiles} adjResults={adjResults}
          adjLabel={adjTid||""} adjSide={adjSide||"north"}/>
      </div>
    </div>
  );
}


// ── E-W Correction Pass ───────────────────────────────────────────────────────
// The E-W constraint is an inequality BAND, not a fixed value: a corrected pile
// must stay within ±maxEWSlope×ewDist of its neighbour's TOP. Hard-fixing
// corrected piles caused slope-delta violations between them that the smoother
// was forbidden from repairing. Instead, each corrected pile gets an allowed
// band and the whole row is re-solved with a small ADMM (same family as the
// Step 2 optimizer): minimize movement from current TOPs subject to
//   • banded piles inside their E-W bands
//   • |slope| ≤ maxSlope on every span
//   • |slope delta| ≤ maxSlopeDelta at every pile
// If the constraints are mathematically incompatible (bands too tight), the
// solve converges to the closest compromise and the re-check flags residuals.

function invertMatrixEW(M){
  const n=M.length;
  const A=M.map((row,i)=>[...row,...Array.from({length:n},(_,j)=>i===j?1:0)]);
  for(let col=0;col<n;col++){
    let p=col;
    for(let r=col+1;r<n;r++) if(Math.abs(A[r][col])>Math.abs(A[p][col])) p=r;
    const t=A[p];A[p]=A[col];A[col]=t;
    const piv=A[col][col]||1e-12;
    for(let j=0;j<2*n;j++) A[col][j]/=piv;
    for(let r=0;r<n;r++){
      if(r===col)continue;
      const f=A[r][col];
      if(f===0)continue;
      for(let j=0;j<2*n;j++) A[r][j]-=f*A[col][j];
    }
  }
  return A.map(row=>row.slice(n));
}

// Constrained row solve: min ||x−x0||² s.t. bands, slope, delta (OSQP-style ADMM)
function solveRowWithBands(sorted, bands, maxSl, maxD){
  const n=sorted.length;
  const x0=sorted.map(r=>r.TopOfPile);
  if(n<2)return x0;
  const dx=[];
  for(let i=0;i<n-1;i++) dx.push(sorted[i+1].Northing-sorted[i].Northing);
  const rows=[],l=[],u=[];
  const slopeCap=maxSl*0.9995, deltaCap=maxD*0.999; // numerical headroom
  for(const k of Object.keys(bands)){
    const i=+k;
    if(i<0||i>=n)continue;
    const r=new Array(n).fill(0); r[i]=1;
    rows.push(r); l.push(bands[k][0]); u.push(bands[k][1]);
  }
  for(let i=0;i<n-1;i++){
    const r=new Array(n).fill(0); r[i]=-1/dx[i]; r[i+1]=1/dx[i];
    rows.push(r); l.push(-slopeCap); u.push(slopeCap);
  }
  for(let i=0;i<n-2;i++){
    const r=new Array(n).fill(0);
    r[i]=1/dx[i]; r[i+1]=-1/dx[i]-1/dx[i+1]; r[i+2]=1/dx[i+1];
    rows.push(r); l.push(-deltaCap); u.push(deltaCap);
  }
  const m=rows.length;
  if(m===0)return x0;
  // Row normalization (preconditioning) — constraint scales differ by 100×
  for(let r=0;r<m;r++){
    let nn=0; for(let j=0;j<n;j++) nn+=rows[r][j]*rows[r][j];
    nn=Math.sqrt(nn)||1;
    for(let j=0;j<n;j++) rows[r][j]/=nn;
    l[r]/=nn; u[r]/=nn;
  }
  const rho=5;
  const M=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>(i===j?1:0)));
  for(let r=0;r<m;r++){
    for(let i=0;i<n;i++){
      const ri=rows[r][i];
      if(ri===0)continue;
      const rri=rho*ri;
      for(let j=0;j<n;j++) M[i][j]+=rri*rows[r][j];
    }
  }
  const Minv=invertMatrixEW(M);
  const z=new Array(m),w=new Array(m).fill(0);
  for(let r=0;r<m;r++){
    let s=0; for(let j=0;j<n;j++) s+=rows[r][j]*x0[j];
    z[r]=Math.min(Math.max(s,l[r]),u[r]);
  }
  let x=[...x0];
  for(let it=0;it<1200;it++){
    const b=[...x0];
    for(let r=0;r<m;r++){
      const cc=rho*(z[r]-w[r]);
      if(cc===0)continue;
      for(let j=0;j<n;j++) b[j]+=cc*rows[r][j];
    }
    for(let i=0;i<n;i++){
      let s=0; for(let j=0;j<n;j++) s+=Minv[i][j]*b[j];
      x[i]=s;
    }
    let maxres=0;
    for(let r=0;r<m;r++){
      let s=0; for(let j=0;j<n;j++) s+=rows[r][j]*x[j];
      const zn=Math.min(Math.max(s+w[r],l[r]),u[r]);
      w[r]+=s-zn;
      const res=Math.abs(s-zn);
      if(res>maxres)maxres=res;
      z[r]=zn;
    }
    if(it%25===24&&maxres<1e-7)break;
  }
  return x;
}

function applyEWCorrections(allResults, trackerIDs, trackerMap, constraints, anchorSet){
  const{maxEWSlope,maxEWSpacing=25,maxEWNSGap=20,
        minReveal,maxReveal,maxSlope,maxSlopeDelta}=constraints;

  const updated={};
  for(const tid of trackerIDs){
    updated[tid]=allResults[tid]?allResults[tid].map(r=>({...r})):null;
  }

  // E-W bands accumulate per tracker: idx → [lo,hi]; intersected on repeat.
  const bandByTid={};

  function findViolatingPairs(tidA, tidB){
    if(!trackerMap[tidA]||!trackerMap[tidB])return[];
    const pilesA=[...trackerMap[tidA]].sort((a,b)=>a.Northing-b.Northing);
    const pilesB=[...trackerMap[tidB]].sort((a,b)=>a.Northing-b.Northing);
    const resA=updated[tidA]?[...updated[tidA]].sort((a,b)=>a.Northing-b.Northing):null;
    const resB=updated[tidB]?[...updated[tidB]].sort((a,b)=>a.Northing-b.Northing):null;
    if(!resA||!resB)return[];
    const pairs=[];
    for(let ai=0;ai<pilesA.length;ai++){
      const pa=pilesA[ai],topA=resA[ai].TopOfPile;
      let minNs=Infinity,closestBi=-1;
      for(let bi=0;bi<pilesB.length;bi++){
        const ewD=Math.abs(pilesB[bi].Easting-pa.Easting);
        const nsD=Math.abs(pilesB[bi].Northing-pa.Northing);
        if(ewD<=maxEWSpacing+2&&ewD>0&&nsD<minNs){minNs=nsD;closestBi=bi;}
      }
      if(closestBi<0||minNs>maxEWNSGap)continue;
      const pb=pilesB[closestBi],topB=resB[closestBi].TopOfPile;
      const ewD=Math.abs(pb.Easting-pa.Easting);
      const slope=Math.abs(topA-topB)/ewD;
      if(ewD<=maxEWSpacing&&slope>maxEWSlope+1e-9){
        pairs.push({ai,bi:closestBi,topA,topB,ewD,slope,
          egA:pa.ExistingGround,egB:pb.ExistingGround});
      }
    }
    return pairs;
  }

  // Correct one row pair: add/intersect E-W bands on the moving row's piles,
  // then re-solve the whole row subject to bands + slope + delta.
  function correctRowPair(tidA, tidB, side){
    const pairs=findViolatingPairs(tidA,tidB);
    if(!pairs.length)return 0;
    const moveTid=side==='left'?tidA:tidB;
    const otherTid=side==='left'?tidB:tidA;
    const resMove=updated[moveTid]?[...updated[moveTid]].sort((a,b)=>a.Northing-b.Northing):null;
    const resOther=updated[otherTid]?[...updated[otherTid]].sort((a,b)=>a.Northing-b.Northing):null;
    if(!resMove||!resOther)return 0;

    if(!bandByTid[moveTid])bandByTid[moveTid]={};
    const bands=bandByTid[moveTid];
    let count=0;
    for(const{ai,bi,ewD} of pairs){
      const moveIdx=side==='left'?ai:bi;
      const otherIdx=side==='left'?bi:ai;
      const center=resOther[otherIdx].TopOfPile;
      const half=maxEWSlope*ewD-1e-4;
      let lo=center-half,hi=center+half;
      const old=bands[moveIdx];
      if(old){
        lo=Math.max(lo,old[0]); hi=Math.min(hi,old[1]);
        if(lo>hi){const mid=(lo+hi)/2;lo=mid;hi=mid;}
      }
      bands[moveIdx]=[lo,hi];
      count++;
    }
    if(count>0){
      const solved=solveRowWithBands(resMove,bands,maxSlope,maxSlopeDelta);
      // Apply solved tops; grade reveals that fall outside bounds
      const graded=resMove.map((r,i)=>{
        const newTop=solved[i];
        const rev=newTop-r.ExistingGround;
        let fg=r.ExistingGround,cf=0;
        if(rev>maxReveal+0.001){fg=r.ExistingGround+(rev-maxReveal);cf=rev-maxReveal;}
        else if(rev<minReveal-0.001){fg=r.ExistingGround-(minReveal-rev);cf=-(minReveal-rev);}
        return{...r,TopOfPile:newTop,FinalReveal:newTop-fg,FinalGround:fg,CutFill:cf};
      });
      updated[moveTid]=allResults[moveTid].map(r=>{
        const s=graded.find(x=>Math.abs(x.Northing-r.Northing)<0.01);
        return s||r;
      });
    }
    return count;
  }

  // Repeat a pair until it passes cleanly (bounded).
  function correctRowPairUntilClean(tidA, tidB, side){
    let total=0;
    for(let g=0;g<6;g++){
      const c=correctRowPair(tidA,tidB,side);
      if(c===0)break;
      total+=c;
    }
    return total;
  }

  // ── Build prefix groups (sorted by suffix) ───────────────────────────────────
  const prefixGroups={};
  for(const tid of trackerIDs){
    const pre=tid.split('-')[0];
    if(!prefixGroups[pre])prefixGroups[pre]=[];
    prefixGroups[pre].push(tid);
  }
  for(const pre of Object.keys(prefixGroups)){
    prefixGroups[pre].sort((a,b)=>parseInt(a.split('-')[1])-parseInt(b.split('-')[1]));
  }

  // ── Detect violation chains ───────────────────────────────────────────────────
  const chains=[];
  for(const pre of Object.keys(prefixGroups)){
    const rows=prefixGroups[pre];
    let i=0;
    while(i<rows.length-1){
      const pairs=findViolatingPairs(rows[i],rows[i+1]);
      if(pairs.length>0){
        const chain=[rows[i]];
        let j=i;
        while(j<rows.length-1){
          const p=findViolatingPairs(rows[j],rows[j+1]);
          if(p.length>0){chain.push(rows[j+1]);j++;}
          else break;
        }
        if(chain.length>1) chains.push(chain);
        i=j;
      } else {
        i++;
      }
    }
  }

  let totalCorrected=0;

  // ── Process each chain: outward from anchor, then dynamic expansion ─────────
  for(const chain of chains){
    let anchorIdx=Math.floor((chain.length-1)/2);
    for(let k=0;k<chain.length;k++){
      if(anchorSet&&anchorSet.has(chain[k])){anchorIdx=k;break;}
    }
    const processOrder=[];
    for(let k=1;k<=Math.max(anchorIdx,chain.length-1-anchorIdx);k++){
      if(anchorIdx-k>=0) processOrder.push([anchorIdx-k,anchorIdx-k+1,'left']);
      if(anchorIdx+k<=chain.length-1) processOrder.push([anchorIdx+k-1,anchorIdx+k,'right']);
    }
    for(const[iA,iB,side] of processOrder){
      totalCorrected+=correctRowPairUntilClean(chain[iA],chain[iB],side);
    }
    // Dynamic outward expansion beyond the original chain boundaries
    const pre=chain[0].split('-')[0];
    const rows=prefixGroups[pre];
    let leftIdx=rows.indexOf(chain[0]);
    while(leftIdx>0){
      const c=correctRowPairUntilClean(rows[leftIdx-1],rows[leftIdx],'left');
      if(c===0)break;
      totalCorrected+=c;
      leftIdx--;
    }
    let rightIdx=rows.indexOf(chain[chain.length-1]);
    while(rightIdx<rows.length-1){
      const c=correctRowPairUntilClean(rows[rightIdx],rows[rightIdx+1],'right');
      if(c===0)break;
      totalCorrected+=c;
      rightIdx++;
    }
  }

  // ── Single full re-check: flag residual violations ───────────────────────────
  const residual=[];
  for(const pre of Object.keys(prefixGroups)){
    const rows=prefixGroups[pre];
    for(let i=0;i<rows.length-1;i++){
      const pairs=findViolatingPairs(rows[i],rows[i+1]);
      for(const p of pairs){
        residual.push({tidA:rows[i],tidB:rows[i+1],...p});
      }
    }
  }

  return{updated,residual,correctedCount:totalCorrected,chains:chains.length};
}


// ── GLOBAL SITE OPTIMIZER (V7) ────────────────────────────────────────────────
// Holistic one-run optimization: after the per-tracker pass provides a warm
// start, Gauss-Seidel sweeps re-solve each row against ALL its constraints at
// once — reveal window (earthwork objective), tube slope, slope delta, N-S end
// bands (ft or slope mode), and E-W pile bands — with neighbours' current
// positions defining the coupling bands. Alternating sweep direction until the
// largest pile movement falls below tolerance. Objective per row: minimize
// distance to the projection of the current tops into the reveal window
// (i.e. earthwork), subject to all hard constraints.
function buildGlobalSolver(trackerMap,trackerIDs,initResults,constraints){
  const{minReveal,maxReveal,maxSlope,maxSlopeDelta,
        maxEWSlope,maxEWSpacing=25,maxEWNSGap=20,maxNSGap,
        nsEndMode='delta',maxNSDelta,maxNSSlope=0.10}=constraints;
  const nsLim=(gap)=>nsEndMode==='slope'?maxNSSlope*Math.max(gap,0.1):maxNSDelta;
  const parse=(t)=>{const p=t.split('-');return[parseInt(p[0]),parseInt(p[1])];};

  // Per-tracker arrays (S→N), x initialised from the per-tracker results
  const tr={};
  for(const tid of trackerIDs){
    const res=initResults[tid]; if(!res||!res.length)continue;
    const s=[...res].sort((a,b)=>a.Northing-b.Northing);
    const raw=[...(trackerMap[tid]||[])].sort((a,b)=>a.Northing-b.Northing);
    tr[tid]={ns:s.map(r=>r.Northing),es:s.map(r=>r.Easting),
             gs:s.map(r=>r.ExistingGround),x:s.map(r=>r.TopOfPile),
             minB:s.map((r,i)=>r.ExistingGround+((raw[i]&&raw[i].MinReveal!=null&&!isNaN(raw[i].MinReveal))?raw[i].MinReveal:minReveal)),
             maxB:s.map((r,i)=>r.ExistingGround+((raw[i]&&raw[i].MaxReveal!=null&&!isNaN(raw[i].MaxReveal))?raw[i].MaxReveal:maxReveal))};
  }
  const ids=Object.keys(tr);

  // E-W pile pairs (both directions) and N-S end pairs
  const prefixGroups={};
  for(const tid of ids){
    const pre=tid.split('-')[0];
    (prefixGroups[pre]=prefixGroups[pre]||[]).push(tid);
  }
  for(const pre of Object.keys(prefixGroups))
    prefixGroups[pre].sort((a,b)=>parseInt(a.split('-')[1])-parseInt(b.split('-')[1]));
  const ewPairs={},nsPairs={};
  for(const tid of ids){ewPairs[tid]=[];nsPairs[tid]=[];}
  for(const pre of Object.keys(prefixGroups)){
    const rows=prefixGroups[pre];
    for(let i=0;i<rows.length-1;i++){
      const A=tr[rows[i]],B=tr[rows[i+1]];
      for(let ai=0;ai<A.ns.length;ai++){
        let best=-1,bd=Infinity;
        for(let bi=0;bi<B.ns.length;bi++){
          const ewd=Math.abs(B.es[bi]-A.es[ai]);
          if(ewd>maxEWSpacing+2||ewd<=0)continue;
          const nsd=Math.abs(B.ns[bi]-A.ns[ai]);
          if(nsd<bd){bd=nsd;best=bi;}
        }
        if(best<0||bd>maxEWNSGap)continue;
        const ewd=Math.abs(B.es[best]-A.es[ai]);
        if(ewd>maxEWSpacing)continue;
        ewPairs[rows[i]].push([ai,rows[i+1],best,ewd]);
        ewPairs[rows[i+1]].push([best,rows[i],ai,ewd]);
      }
    }
  }
  const byE={};
  for(const tid of ids){
    const k=Math.round(tr[tid].es[0]);
    (byE[k]=byE[k]||[]).push(tid);
  }
  for(const k of Object.keys(byE)){
    const ts=byE[k].sort((a,b)=>tr[a].ns[0]-tr[b].ns[0]);
    for(let i=0;i<ts.length-1;i++){
      const a=ts[i],b=ts[i+1];
      const gap=tr[b].ns[0]-tr[a].ns[tr[a].ns.length-1];
      if(gap>=0&&gap<=maxNSGap){
        nsPairs[a].push(['north',b,'south',gap]);
        nsPairs[b].push(['south',a,'north',gap]);
      }
    }
  }

  // Static per-row solver state: constraint matrix (row-normalised) + inverse
  const state={};
  for(const tid of ids){
    const T=tr[tid],n=T.ns.length;
    const dx=[];for(let i=0;i<n-1;i++){
      const dN=T.ns[i+1]-T.ns[i],dE=T.es[i+1]-T.es[i];
      dx.push(Math.sqrt(dN*dN+dE*dE)); // true chord — rows may be skewed off N-S
    }
    // Pile-plan mode: EVERY pile carries a hard reveal box (per-pile
    // MinReveal/MaxReveal columns when present, else the global sliders).
    const bandIdx=Array.from({length:n},(_,i)=>i);
    const rows=[],l=[],u=[];
    for(const i of bandIdx){const r=new Array(n).fill(0);r[i]=1;rows.push(r);l.push(0);u.push(0);}
    for(let i=0;i<n-1;i++){
      const r=new Array(n).fill(0);r[i]=-1/dx[i];r[i+1]=1/dx[i];
      rows.push(r);l.push(-maxSlope*0.9995);u.push(maxSlope*0.9995);
    }
    for(let i=0;i<n-2;i++){
      const r=new Array(n).fill(0);
      r[i]=1/dx[i];r[i+1]=-1/dx[i]-1/dx[i+1];r[i+2]=1/dx[i+1];
      rows.push(r);l.push(-maxSlopeDelta*0.999);u.push(maxSlopeDelta*0.999);
    }
    const m=rows.length;
    const nn=new Array(m);
    for(let r=0;r<m;r++){
      let s=0;for(let j=0;j<n;j++)s+=rows[r][j]*rows[r][j];
      nn[r]=Math.sqrt(s)||1;
      for(let j=0;j<n;j++)rows[r][j]/=nn[r];
      l[r]/=nn[r];u[r]/=nn[r];
    }
    const rho=5;
    const M=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0));
    for(let r=0;r<m;r++)for(let i=0;i<n;i++){
      const ri=rows[r][i];if(ri===0)continue;
      const rri=rho*ri;
      for(let j=0;j<n;j++)M[i][j]+=rri*rows[r][j];
    }
    // PRIMARY objective: minimize slope deltas — add wd·DᵀD so straight
    // tubes emerge wherever boxes allow; target reveal is SECONDARY.
    const wd=1e4;
    for(let i=0;i<n-2;i++){
      const st=[1/dx[i],-1/dx[i]-1/dx[i+1],1/dx[i+1]];
      for(let a2=0;a2<3;a2++)for(let b2=0;b2<3;b2++)M[i+a2][i+b2]+=wd*st[a2]*st[b2];
    }
    state[tid]={A:rows,nn,l,u,Minv:invertMatrixEW(M),bandIdx,dx,rho,nB:bandIdx.length};
  }

  function solveRow(tid){
    const T=tr[tid],S=state[tid],n=T.ns.length;
    // Coupling bands from neighbours' current positions
    const bands={};
    for(let i=0;i<n;i++)bands[i]=[T.minB[i],T.maxB[i]];
    const addBand=(mi,c,h)=>{
      let lo=c-h,hi=c+h;
      const o=bands[mi];
      if(o){lo=Math.max(lo,o[0]);hi=Math.min(hi,o[1]);if(lo>hi){const m2=(lo+hi)/2;lo=m2;hi=m2;}}
      bands[mi]=[lo,hi];
    };
    for(const[mi,otid,oi,ewd]of ewPairs[tid]) addBand(mi,tr[otid].x[oi],maxEWSlope*ewd-1e-4);
    for(const[e,otid,oe,gap]of nsPairs[tid]){
      const mi=e==='north'?n-1:0;
      const ov=oe==='north'?tr[otid].x[tr[otid].x.length-1]:tr[otid].x[0];
      addBand(mi,ov,nsLim(gap)-1e-4);
    }
    const l=[...S.l],u=[...S.u];
    for(let k=0;k<S.nB;k++){
      const b=bands[S.bandIdx[k]]||[-1e6,1e6];
      l[k]=b[0]/S.nn[k];u[k]=b[1]/S.nn[k];
    }
    // Earthwork prox target: project CURRENT tops into each pile box —
    // free anywhere inside the box, pulls back only when outside, so the
    // solve minimizes straightness + total box violation (earthwork), letting
    // the whole tube lift/tilt (e.g. raise the ends) to reduce cut amounts,
    // with a gentle tie-break toward target reveal.
    const tgt=constraints.targetReveal!=null?constraints.targetReveal:5;
    const t=new Array(n);
    for(let i=0;i<n;i++){
      const proj=Math.min(Math.max(T.x[i],T.minB[i]),T.maxB[i]);
      const pref=Math.min(Math.max(T.gs[i]+tgt,T.minB[i]),T.maxB[i]);
      t[i]=0.97*proj+0.03*pref;
    }
    const A=S.A,m=A.length,rho=S.rho,Minv=S.Minv;
    const z=new Array(m),w=new Array(m).fill(0);
    for(let r=0;r<m;r++){
      let s=0;for(let j=0;j<n;j++)s+=A[r][j]*T.x[j];
      z[r]=Math.min(Math.max(s,l[r]),u[r]);
    }
    let x=[...T.x];
    for(let it=0;it<140;it++){
      const b=[...t];
      for(let r=0;r<m;r++){
        const cc=rho*(z[r]-w[r]);
        if(cc===0)continue;
        for(let j=0;j<n;j++)b[j]+=cc*A[r][j];
      }
      for(let i=0;i<n;i++){
        let s=0;for(let j=0;j<n;j++)s+=Minv[i][j]*b[j];
        x[i]=s;
      }
      let mr=0;
      for(let r=0;r<m;r++){
        let s=0;for(let j=0;j<n;j++)s+=A[r][j]*x[j];
        const zn=Math.min(Math.max(s+w[r],l[r]),u[r]);
        w[r]+=s-zn;
        const rr=Math.abs(s-zn);if(rr>mr)mr=rr;
        z[r]=zn;
      }
      if(it%20===19&&mr<1e-7)break;
    }
    // Verify tube physics; if coupling bands made the row infeasible,
    // re-solve WITHOUT them — slope/delta are inviolable, cross-row limits
    // become residual flags instead.
    let physOK=true;
    for(let i=0;i<n-1&&physOK;i++){
      const sl=(x[i+1]-x[i])/S.dx[i];
      if(Math.abs(sl)>maxSlope+1e-4)physOK=false;
      if(i>0){
        const sp=(x[i]-x[i-1])/S.dx[i-1];
        if(Math.abs(sl-sp)>maxSlopeDelta+1e-4)physOK=false;
      }
    }
    if(!physOK){
      // Drop coupling bands but KEEP the reveal boxes; if physics still fails
      // against the boxes alone, the row needs regrade (flagged in finalize).
      for(let k=0;k<S.nB;k++){
        const i2=S.bandIdx[k];
        l[k]=T.minB[i2]/S.nn[k];u[k]=T.maxB[i2]/S.nn[k];
      }
      for(let r=0;r<m;r++){
        let s=0;for(let j=0;j<n;j++)s+=A[r][j]*T.x[j];
        z[r]=Math.min(Math.max(s,l[r]),u[r]);w[r]=0;
      }
      x=[...T.x];
      for(let it=0;it<140;it++){
        const b=[...t];
        for(let r=0;r<m;r++){
          const cc=rho*(z[r]-w[r]);
          if(cc===0)continue;
          for(let j=0;j<n;j++)b[j]+=cc*A[r][j];
        }
        for(let i=0;i<n;i++){
          let s=0;for(let j=0;j<n;j++)s+=Minv[i][j]*b[j];
          x[i]=s;
        }
        let mr=0;
        for(let r=0;r<m;r++){
          let s=0;for(let j=0;j<n;j++)s+=A[r][j]*x[j];
          const zn=Math.min(Math.max(s+w[r],l[r]),u[r]);
          w[r]+=s-zn;
          const rr=Math.abs(s-zn);if(rr>mr)mr=rr;
          z[r]=zn;
        }
        if(it%20===19&&mr<1e-7)break;
      }
    }
    // Tier 3: if physics STILL fails against the reveal boxes alone, the row
    // is infeasible as graded — boxes must yield too. Physics (slope, delta)
    // is enforced unconditionally and the box violations surface honestly as
    // Cut/Fill regrade amounts in the results.
    let phys2=true;
    for(let i=0;i<n-1&&phys2;i++){
      const sl=(x[i+1]-x[i])/S.dx[i];
      if(Math.abs(sl)>maxSlope+1e-4)phys2=false;
      if(i>0){
        const sp=(x[i]-x[i-1])/S.dx[i-1];
        if(Math.abs(sl-sp)>maxSlopeDelta+1e-4)phys2=false;
      }
    }
    if(!phys2){
      // Boxes yield on INTERIOR piles only — the first and last pile of each
      // row must stay within their reveal tolerance, so the tube is re-fit
      // anchored through the end boxes and interior violations become the
      // regrade amounts.
      for(let k=0;k<S.nB;k++){
        const i2=S.bandIdx[k];
        if(i2===0||i2===n-1){l[k]=T.minB[i2]/S.nn[k];u[k]=T.maxB[i2]/S.nn[k];}
        else{l[k]=-1e6;u[k]=1e6;}
      }
      for(let r=0;r<m;r++){
        let s=0;for(let j=0;j<n;j++)s+=A[r][j]*T.x[j];
        z[r]=Math.min(Math.max(s,l[r]),u[r]);w[r]=0;
      }
      x=[...t];
      for(let it=0;it<140;it++){
        const b=[...t];
        for(let r=0;r<m;r++){
          const cc=rho*(z[r]-w[r]);
          if(cc===0)continue;
          for(let j=0;j<n;j++)b[j]+=cc*A[r][j];
        }
        for(let i=0;i<n;i++){
          let s=0;for(let j=0;j<n;j++)s+=Minv[i][j]*b[j];
          x[i]=s;
        }
        let mr=0;
        for(let r=0;r<m;r++){
          let s=0;for(let j=0;j<n;j++)s+=A[r][j]*x[j];
          const zn=Math.min(Math.max(s+w[r],l[r]),u[r]);
          w[r]+=s-zn;
          const rr=Math.abs(s-zn);if(rr>mr)mr=rr;
          z[r]=zn;
        }
        if(it%20===19&&mr<1e-7)break;
      }
    }
    let ch=0;
    for(let i=0;i<n;i++){const d=Math.abs(x[i]-T.x[i]);if(d>ch)ch=d;T.x[i]=x[i];}
    return ch;
  }

  const order=ids.slice().sort((a,b)=>{
    const[pa,sa]=parse(a),[pb,sb]=parse(b);
    return pb-pa||sa-sb; // south→north blocks, west→east within
  });

  return{
    sweep(dirFlip){
      const o=dirFlip?order.slice().reverse():order;
      let mx=0;
      for(const tid of o){const c=solveRow(tid);if(c>mx)mx=c;}
      return mx;
    },
    finalize(){
      const out={};
      for(const tid of ids){
        const T=tr[tid];const res=initResults[tid];
        const s=[...res].sort((a,b)=>a.Northing-b.Northing);
        let totalCut=0,totalFill=0;
        // ── End-anchored straight-line refit (straight-tube mode) ─────────
        // Downstream CAD reconstructs each tracker as the line through the
        // FIRST and LAST pile, so the export must be exactly that line.
        // 2-DOF search over (south-end TOP, north-end TOP) = lift + rotation
        // about the ends, minimizing total box violation with a small safety
        // margin so no pile lands exactly on its tolerance edge.
        const n2=T.x.length;
        if((constraints.maxSlopeDelta??0)<=1e-9&&n2>2){
          // param: projection of each pile onto the end-to-end axis (CAD line)
          const dNe=T.ns[n2-1]-T.ns[0],dEe=T.es[n2-1]-T.es[0];
          const L=Math.sqrt(dNe*dNe+dEe*dEe)||1;
          const uu=T.ns.map((nv,i)=>((nv-T.ns[0])*dNe+(T.es[i]-T.es[0])*dEe)/L/L);
          const MRG=0.02;
          const loA=T.minB[0]+MRG,hiA=T.maxB[0]-MRG;
          const loB=T.minB[n2-1]+MRG,hiB=T.maxB[n2-1]-MRG;
          let bestA=T.x[0],bestB=T.x[n2-1],bestE=Infinity;
          const G=48;
          for(let ia=0;ia<=G;ia++){
            const a=loA+(hiA-loA)*ia/G;
            for(let ib=0;ib<=G;ib++){
              const b=loB+(hiB-loB)*ib/G;
              if(Math.abs((b-a)/L)>maxSlope)continue;
              let e=0;
              for(let i=1;i<n2-1;i++){
                const v=a+(b-a)*uu[i];
                e+=Math.max(0,T.minB[i]-v)+Math.max(0,v-T.maxB[i]);
              }
              if(e<bestE-1e-9){bestE=e;bestA=a;bestB=b;}
            }
          }
          for(let i=0;i<n2;i++)T.x[i]=bestA+(bestB-bestA)*uu[i];
        }
        const rowsOut=s.map((r,i)=>{
          const newTop=T.x[i];
          const lo=T.minB?T.minB[i]:r.ExistingGround+minReveal;
          const hi=T.maxB?T.maxB[i]:r.ExistingGround+maxReveal;
          let fg=r.ExistingGround,cf=0;
          // Site is already graded — Cut/Fill is a REGRADE DIAGNOSTIC:
          // nonzero means this pile box could not be honoured.
          if(newTop>hi+0.001){cf=newTop-hi;fg=r.ExistingGround+cf;totalFill+=cf;}
          else if(newTop<lo-0.001){cf=-(lo-newTop);fg=r.ExistingGround+cf;totalCut+=-cf;}
          return{...r,TopOfPile:newTop,FinalReveal:newTop-fg,FinalGround:fg,CutFill:cf};
        });
        // Derive method label from the final solution, and record the per-pile
        // tube slope / flex-joint rotation. These must be carried through: they
        // are the governing geometry checks and they are exported per pile.
        // Convention matches buildResult (rows are S→N):
        //   slopeAt[i] = slope of the span entering pile i   (null at pile 1)
        //   deltaAt[i] = change in slope at pile i           (null at piles 1-2)
        let maxAbsD=0,prevS=null,maxAbsS=0;
        const slopeAt=new Array(rowsOut.length).fill(null);
        const deltaAt=new Array(rowsOut.length).fill(null);
        for(let i=1;i<rowsOut.length;i++){
          const dNi=rowsOut[i].Northing-rowsOut[i-1].Northing;
          const dEi=(rowsOut[i].Easting||0)-(rowsOut[i-1].Easting||0);
          const dxi=Math.sqrt(dNi*dNi+dEi*dEi);
          if(dxi<=0)continue;
          const sl=(rowsOut[i].TopOfPile-rowsOut[i-1].TopOfPile)/dxi;
          slopeAt[i]=sl;
          if(Math.abs(sl)>maxAbsS)maxAbsS=Math.abs(sl);
          if(prevS!==null){const d=sl-prevS;deltaAt[i]=d;if(Math.abs(d)>maxAbsD)maxAbsD=Math.abs(d);}
          prevS=sl;
        }
        const method=(totalCut+totalFill)>0.01?"Requires Regrade"
          :(maxAbsD<1e-6?"StraightLine":"Pile Plan (Global)");
        out[tid]=rowsOut.map((r,i)=>({...r,
          Method:method,
          Explanation:"Global site optimization: all constraints (reveal, slope, slope Δ, N-S ends, E-W bands) solved jointly.",
          Violations:(()=>{
            const v=[];
            for(let k=1;k<rowsOut.length;k++){
              const dxi=rowsOut[k].Northing-rowsOut[k-1].Northing;
              if(dxi<=0)continue;
              const sl=(rowsOut[k].TopOfPile-rowsOut[k-1].TopOfPile)/dxi;
              if(Math.abs(sl)>maxSlope+1e-4)v.push(`Span ${k}→${k+1}: slope ${(sl*100).toFixed(3)}% > max`);
              if(k>1){
                const dx0=rowsOut[k-1].Northing-rowsOut[k-2].Northing;
                if(dx0>0){
                  const s0=(rowsOut[k-1].TopOfPile-rowsOut[k-2].TopOfPile)/dx0;
                  if(Math.abs(sl-s0)>maxSlopeDelta+1e-4)v.push(`Flex jt ${k+1}: Δslope ${((sl-s0)*100).toFixed(3)}% > max`);
                }
              }
            }
            return v;
          })(),
          MaxAbsSlope:maxAbsS,MaxAbsSlopeDelta:maxAbsD,
          TotalCut:totalCut,TotalFill:totalFill,NetImbalance:Math.abs(totalCut-totalFill),
          Slope:slopeAt[i],SlopeDelta:deltaAt[i],
        }));
      }
      return out;
    },
  };
}

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const [constraints,setConstraints]=useState({
    minReveal:2.0,maxReveal:6.0,targetReveal:4.5,
    maxSlope:0.10,maxSlopeDelta:0.02,
    maxNSDelta:1.0,       // max TOP elevation diff between N-S adjacent tracker ends (ft)
    maxEWSlope:0.08,      // max TOP slope between E-W adjacent tracker ends (fraction)
    maxNSGap:20.0,
    nsEndMode:'delta',    // 'delta' = fixed ft limit, 'slope' = % of the N-S gap
    maxNSSlope:0.10,      // max N-S end slope across the gap (nsEndMode='slope')
    maxEWSpacing:25.0,  // max easting gap to check E-W pile adjacency (ft)
    maxEWNSGap:20.0,    // max northing distance to consider piles E-W adjacent (ft)        // max northing gap to consider N-S adjacent (ft)
    preferCutHigh:false,  // rotate tube to avoid cut at lowest-elevation end pile
  });
  const [rawData,setRawData]=useState(SAMPLE_DATA.map(normalizeRow));
  const [selectedTracker,setSelectedTracker]=useState("1-1");
  const [fileError,setFileError]=useState("");
  const [fileLoading,setFileLoading]=useState(false);
  const [nsCorrection,setNsCorrection]=useState(null);
  const [nsCorrectionRunning,setNsCorrectionRunning]=useState(false);
  const [ewCorrection,setEwCorrection]=useState(null);
  const [ewCorrectionRunning,setEwCorrectionRunning]=useState(false);
  const [ewAnchors,setEwAnchors]=useState(new Set()); // user-selected anchor rows
  const [activeTab,setActiveTab]=useState("input");
  const fileRef=useRef();

  // ── Chunked async fleet computation ────────────────────────────────────────
  // Processes trackers in 50-tracker chunks yielding to the event loop between
  // chunks. Keeps the UI responsive for fleets up to 200k piles (~14k trackers).
  // Each chunk takes ~30ms JS, giving smooth progress updates.
  const [allResults,setAllResults]=useState({});
  const [progress,setProgress]=useState({done:0,total:0,running:false,elapsed:0});
  const runIdRef=useRef(0);
  // Set when opening a stored run: the fleet effect consumes it and installs
  // the saved results verbatim instead of re-solving. Re-solving would be
  // deterministic for the base optimization but would silently discard any
  // N-S / E-W corrections the engineer applied before saving.
  const pendingHydrateRef=useRef(null);

  const trackerMap=useMemo(()=>groupByTracker(rawData),[rawData]);
  const trackerIDs=useMemo(()=>Object.keys(trackerMap).sort((a,b)=>{
    const pa=a.split("-").map(Number),pb=b.split("-").map(Number);
    return(pa[0]-pb[0])||(pa[1]-pb[1]);
  }),[trackerMap]);

  // Single-tracker result for the selected tracker (instant, synchronous)
  const results=useMemo(()=>{
    const piles=trackerMap[selectedTracker];
    if(!piles)return[];
    return optimizeTracker(piles,constraints);
  },[trackerMap,selectedTracker,constraints]);

  // Fleet run: chunked async so the browser never freezes
  useEffect(()=>{
    const ids=trackerIDs; const total=ids.length; if(total===0)return;
    if(pendingHydrateRef.current){
      const h=pendingHydrateRef.current; pendingHydrateRef.current=null;
      runIdRef.current++;                 // abort any in-flight solve
      setAllResults(h.allResults);
      setProgress({done:total,total,running:false,elapsed:"0.0"});
      return;                             // corrections in h.allResults survive
    }
    const runId=++runIdRef.current;
    const CHUNK=50; // trackers per chunk — ~25ms per chunk in JS
    const out={}; let i=0;
    const t0=performance.now();
    setProgress({done:0,total,running:true,elapsed:0});
    setNsCorrection(null);
    setEwCorrection(null);
    setEwAnchors(new Set());
    function runChunk(){
      if(runIdRef.current!==runId)return; // stale run, abort
      const end=Math.min(i+CHUNK,total);
      for(;i<end;i++){const id=ids[i];const p=trackerMap[id];if(p)out[id]=optimizeTracker(p,constraints);}
      const elapsed=((performance.now()-t0)/1000).toFixed(1);
      setProgress({done:i,total,running:i<total,elapsed});
      if(i<total){setTimeout(runChunk,0);}  // yield to event loop
      else{
        // ── Global coupling phase: one-run holistic solve ────────────────
        const solver=buildGlobalSolver(trackerMap,ids,out,constraints);
        let sweepN=0;const MAXSWEEP=80,TOL=0.003;
        function runSweep(){
          if(runIdRef.current!==runId)return;
          const mx=solver.sweep(sweepN%2===1);
          sweepN++;
          const elapsed2=((performance.now()-t0)/1000).toFixed(1);
          setProgress({done:total,total,running:true,elapsed:elapsed2,
            phase:`global solve — sweep ${sweepN}, max move ${mx.toFixed(3)} ft`});
          if(mx>TOL&&sweepN<MAXSWEEP){setTimeout(runSweep,0);}
          else{
            setAllResults(solver.finalize());
            setProgress({done:total,total,running:false,
              elapsed:((performance.now()-t0)/1000).toFixed(1)});
          }
        }
        setTimeout(runSweep,0);
      }
    }
    setTimeout(runChunk,0);
  },[trackerMap,trackerIDs,constraints]);

  // Reopen a stored run: restore inputs + constraints, and if the snapshot has
  // solved results, install them via pendingHydrateRef so the fleet effect
  // skips the re-solve (see the ref's comment).
  const openSnapshot=useCallback((decoded)=>{
    const ids=[...new Set(decoded.rawData.map(r=>r.TrackerID))];
    pendingHydrateRef.current=Object.keys(decoded.allResults||{}).length>0
      ?{allResults:decoded.allResults}:null;
    setConstraints(decoded.constraints);
    setRawData(decoded.rawData);
    setEwAnchors(decoded.ewAnchors||new Set());
    setSelectedTracker(decoded.selectedTracker&&ids.includes(decoded.selectedTracker)
      ?decoded.selectedTracker:(ids[0]||"1-1"));
    setNsCorrection(null);setEwCorrection(null);
    setFileError("");
    setActiveTab("summary");
  },[]);

  const summary=useMemo(()=>trackerIDs.map(id=>{
    const res=allResults[id];if(!res||res.length===0)return null;
    const reveals=res.map(r=>r.FinalReveal);
    // Compute slope/delta/cut/fill LIVE from current TOPs so stats stay
    // correct after N-S / E-W corrections move piles.
    const sorted=[...res].sort((a,b)=>a.Northing-b.Northing);
    let maxAbsSlope=0,maxAbsSlopeDelta=0,prevSlope=null;
    for(let k=1;k<sorted.length;k++){
      const dNk=sorted[k].Northing-sorted[k-1].Northing;
      const dEk=(sorted[k].Easting||0)-(sorted[k-1].Easting||0);
      const dxk=Math.sqrt(dNk*dNk+dEk*dEk);
      if(dxk<=0)continue;
      const s=(sorted[k].TopOfPile-sorted[k-1].TopOfPile)/dxk;
      if(Math.abs(s)>maxAbsSlope)maxAbsSlope=Math.abs(s);
      if(prevSlope!==null){
        const d=Math.abs(s-prevSlope);
        if(d>maxAbsSlopeDelta)maxAbsSlopeDelta=d;
      }
      prevSlope=s;
    }
    let totalCut=0,totalFill=0;
    for(const r of res){
      const cf=r.CutFill||0;
      if(cf>0)totalFill+=cf;else totalCut+=-cf;
    }
    const net=Math.abs(totalCut-totalFill);
    return{id,method:res[0].Method,
      minRev:arrMin(reveals),maxRev:arrMax(reveals),
      avgRev:reveals.reduce((a,b)=>a+b,0)/reveals.length,
      maxAbsSlope,maxAbsSlopeDelta,
      totalCut,totalFill,
      net,violations:res[0].Violations?.length||0,ok:(res[0].Violations?.length||0)===0};
  }).filter(Boolean),[allResults,trackerIDs]);

  // ── Adjacency flags ────────────────────────────────────────────────────────
  const adjacencyFlags=useMemo(()=>{
    if(Object.keys(allResults).length===0)return{ns:[],ew:[]};
    const {maxNSDelta,maxEWSlope,maxNSGap,maxEWSpacing=25,maxEWNSGap=20,
           nsEndMode='delta',maxNSSlope=0.10}=constraints;

    // Build end-pile TOP elevations per tracker
    const ends={};
    for(const tid of trackerIDs){
      const res=allResults[tid]; if(!res||res.length===0)continue;
      // results are in S→N order (ascending northing) internally
      const sorted=[...res].sort((a,b)=>a.Northing-b.Northing);
      ends[tid]={
        southN:sorted[0].Northing, southE:sorted[0].Easting, southTOP:sorted[0].TopOfPile,
        northN:sorted[sorted.length-1].Northing, northE:sorted[sorted.length-1].Easting, northTOP:sorted[sorted.length-1].TopOfPile,
        easting:sorted[0].Easting,
      };
    }

    // Build easting lookup (rounded to nearest ft) → list of trackerIDs
    const byEasting={};
    for(const tid of trackerIDs){
      const e=ends[tid]; if(!e)continue;
      const key=Math.round(e.northE);
      if(!byEasting[key])byEasting[key]=[];
      byEasting[key].push(tid);
    }

    // N-S flags: for each tracker, find the tracker whose north end is just south
    // of this tracker's south end (same easting ±1ft, gap ≤ maxNSGap)
    const nsFlags=[];
    for(const tid of trackerIDs){
      const e=ends[tid]; if(!e)continue;
      const key=Math.round(e.southE);
      const candidates=byEasting[key]||[];
      for(const other of candidates){
        if(other===tid)continue;
        const oe=ends[other]; if(!oe)continue;
        const gap=e.southN-oe.northN;
        if(gap>=0&&gap<=maxNSGap){
          const delta=Math.abs(e.southTOP-oe.northTOP);
          // Limit: fixed ft delta, or slope % of the actual gap (gaps vary,
          // e.g. 10.9 vs 17.7 ft, so a % limit scales with spacing).
          const limit=nsEndMode==='slope'?maxNSSlope*Math.max(gap,0.1):maxNSDelta;
          if(delta>limit){
            nsFlags.push({
              trackerA:other, trackerB:tid,
              endA:'north', endB:'south',
              topA:oe.northTOP, topB:e.southTOP,
              delta, gap, limit,
            });
          }
        }
      }
    }

    // E-W flags: pile-level check across consecutive rows in the same prefix group.
    // For each pile in row N, find piles in row N+1 within maxEWSpacing+2ft easting
    // AND within 1.5x the average pile spacing in northing (handles staggered rows).
    const prefixGroups={};
    for(const tid of trackerIDs){
      const pre=tid.split('-')[0];
      if(!prefixGroups[pre])prefixGroups[pre]=[];
      prefixGroups[pre].push(tid);
    }
    const ewFlags=[];
    for(const pre of Object.keys(prefixGroups)){
      const members=prefixGroups[pre]
        .filter(tid=>allResults[tid]&&trackerMap[tid])
        .sort((a,b)=>parseInt(a.split('-')[1])-parseInt(b.split('-')[1]));
      for(let i=0;i<members.length-1;i++){
        const tidA=members[i],tidB=members[i+1];
        const pilesA=[...trackerMap[tidA]].sort((a,b)=>a.Northing-b.Northing);
        const pilesB=[...trackerMap[tidB]].sort((a,b)=>a.Northing-b.Northing);
        const resA=[...allResults[tidA]].sort((a,b)=>a.Northing-b.Northing);
        const resB=[...allResults[tidB]].sort((a,b)=>a.Northing-b.Northing);
        if(!pilesA.length||!pilesB.length)continue;
        let spA=0; for(let k=1;k<pilesA.length;k++) spA+=pilesA[k].Northing-pilesA[k-1].Northing;
        spA=pilesA.length>1?spA/(pilesA.length-1):30;
        let spB=0; for(let k=1;k<pilesB.length;k++) spB+=pilesB[k].Northing-pilesB[k-1].Northing;
        spB=pilesB.length>1?spB/(pilesB.length-1):30;
        for(let ai=0;ai<pilesA.length;ai++){
          const pa=pilesA[ai],ra=resA[ai]; if(!ra)continue;
          const topA=ra.TopOfPile;
          // Find the single closest pile in row B by northing distance,
          // within the easting window. Only check that one pile (or tied pair).
          let minNsDist=Infinity,closestBi=-1;
          for(let bi=0;bi<pilesB.length;bi++){
            const pb=pilesB[bi];
            const ewDist=Math.abs(pb.Easting-pa.Easting);
            if(ewDist>maxEWSpacing+2||ewDist<=0)continue;
            const nsDist=Math.abs(pb.Northing-pa.Northing);
            if(nsDist<minNsDist){minNsDist=nsDist;closestBi=bi;}
          }
          if(closestBi<0||minNsDist>maxEWNSGap)continue; // skip if no pile within N-S gap limit
          // Check the closest pile (and any tied piles within 0.1ft)
          for(let bi=0;bi<pilesB.length;bi++){
            const pb=pilesB[bi],rb=resB[bi]; if(!rb)continue;
            const ewDist=Math.abs(pb.Easting-pa.Easting);
            if(ewDist>maxEWSpacing+2||ewDist<=0)continue;
            const nsDist=Math.abs(pb.Northing-pa.Northing);
            if(nsDist>minNsDist+0.1)continue; // only closest pile(s)
            const slope=Math.abs(topA-rb.TopOfPile)/ewDist;
            if(ewDist<=maxEWSpacing&&slope>maxEWSlope){
              ewFlags.push({
                trackerA:tidA,pileA:pilesA.length-ai,northingA:pa.Northing,topA,
                trackerB:tidB,pileB:pilesB.length-bi,northingB:pb.Northing,topB:rb.TopOfPile,
                slope,ewDist,nsDist,
              });
            }
          }
        }
      }
    }
        return{ns:nsFlags,ew:ewFlags};
  },[allResults,trackerIDs,constraints]);

  const handleFile=useCallback(e=>{
    const file=e.target.files?.[0];if(!file)return;
    setFileError("");
    setFileLoading(true);
    const isXlsx=file.name.match(/\.xlsx?$/i);
    const reader=new FileReader();
    reader.onload=evt=>{
      // Yield to the UI thread first so "Loading…" renders before heavy parse
      setTimeout(()=>{
        try{
          let rows;
          if(isXlsx){
            // raw:true skips XLSX type inference — much faster on large files
            const wb=XLSX.read(evt.target.result,{type:"array",raw:true});
            let found=false;
            for(const sheetName of wb.SheetNames){
              const ws=wb.Sheets[sheetName];
              // sheet_to_json with header:1 gives array-of-arrays — fast path
              const aoa=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:""});
              if(aoa.length<2)continue;
              // Find header row (first row with our required columns)
              const hdrs=aoa[0].map(h=>String(h).trim().toLowerCase());
              // Per-pile reveal bounds are optional but MUST be picked up here:
              // optimizeTracker treats [EG+MinReveal, EG+MaxReveal] as a hard box
              // per pile and falls back to the sliders only when they are absent.
              const MINREV=["minreveal","min_reveal","min reveal","minimumreveal","minimum reveal","minrev"];
              const MAXREV=["maxreveal","max_reveal","max reveal","maximumreveal","maximum reveal","maxrev"];
              const ci={
                tid:hdrs.findIndex(h=>h==="trackerid"||h==="tracker_id"),
                n:hdrs.findIndex(h=>h==="northing"),
                e:hdrs.findIndex(h=>h==="easting"),
                g:hdrs.findIndex(h=>h==="existingground"||h==="existing_ground"),
                mnr:hdrs.findIndex(h=>MINREV.includes(h)),
                mxr:hdrs.findIndex(h=>MAXREV.includes(h)),
              };
              if(ci.tid<0||ci.n<0||ci.g<0)continue;
              // Parse only the columns we need — skip the rest
              const mapped=[];
              for(let r=1;r<aoa.length;r++){
                const row=aoa[r];
                const tid=String(row[ci.tid]||"").trim();
                const n=parseFloat(row[ci.n]);
                const east=ci.e>=0?parseFloat(row[ci.e]):NaN;
                const g=parseFloat(row[ci.g]);
                const mnr=ci.mnr>=0?parseFloat(row[ci.mnr]):NaN;
                const mxr=ci.mxr>=0?parseFloat(row[ci.mxr]):NaN;
                if(tid&&!isNaN(n)&&!isNaN(g))mapped.push({TrackerID:tid,Northing:n,Easting:isNaN(east)?0:east,ExistingGround:g,MinReveal:isNaN(mnr)?undefined:mnr,MaxReveal:isNaN(mxr)?undefined:mxr});
              }
              if(mapped.length>0){rows=mapped;found=true;break;}
            }
            if(!found){setFileError("No sheet with TrackerID, Northing, Easting, ExistingGround columns found.");setFileLoading(false);return;}
          }else{
            rows=parseCSV(evt.target.result).map(normalizeRow)
              .filter(r=>r.TrackerID&&!isNaN(r.Northing)&&!isNaN(r.ExistingGround));
          }
          if(!rows||rows.length===0){setFileError("No valid rows found. Need: TrackerID, Northing, Easting, ExistingGround");setFileLoading(false);return;}
          // Get first tracker ID without spread (safe for large arrays)
          let firstID=rows[0].TrackerID;
          setRawData(rows);
          setSelectedTracker(firstID);
          setActiveTab("input");  // stay on input tab — chart renders on demand
        }catch(err){setFileError("Parse error: "+err.message);}
        finally{setFileLoading(false);}
      },20);
    };
    if(isXlsx)reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  },[]);

  const exportXLSX=()=>{
    if(progress.running||trackerIDs.length===0)return;
    // ── Build flat data rows ────────────────────────────────────────────────
    const data=[];
    trackerIDs.forEach(id=>{
      const res=allResults[id];if(!res)return;
      const cls=classifyMethod(res[0]?.Method);
      const solutionType=cls==="straight"?"Straight Line"
        :cls==="regrade"?"Terrain Following (Regrade)":"Terrain Following";
      // Reverse pile order within each tracker: output N→S (descending northing)
      // to match the convention of the source data files.
      const resOrdered=[...res].reverse();
      resOrdered.forEach((r,i)=>{
        const gAdj=r.CutFill!==0&&Math.abs(r.CutFill)>0.001;
        data.push({
          "Tracker ID":r.TrackerID,
          "Northing (ft)":+r.Northing.toFixed(4),
          "Easting (ft)":+r.Easting.toFixed(4),
          "Existing Ground (ft)":+r.ExistingGround.toFixed(4),
          "Top of Pile (ft)":+r.TopOfPile.toFixed(4),
          "Pile Reveal (ft)":+r.FinalReveal.toFixed(4),
          "Solution Type":solutionType,
          "Final FG (ft)":+r.FinalGround.toFixed(4),
          "Ground Adj (ft)":gAdj?+r.CutFill.toFixed(4):null,
          "Cut / Fill":gAdj?(r.CutFill<0?"Cut":"Fill"):null,
          // Tube slope and flex-joint rotation are the governing geometry
          // checks — always exported when defined (null only at the first pile
          // of a tracker, and the first two for the delta).
          "Tube Slope":r.Slope!=null?+r.Slope.toFixed(6):null,
          "Slope Delta":r.SlopeDelta!=null?+r.SlopeDelta.toFixed(6):null,
        });
      });
    });

    // ── Create workbook with two sheets ────────────────────────────────────
    const wb=XLSX.utils.book_new();

    // Sheet 1: Results
    const wsData=XLSX.utils.json_to_sheet(data,{
      header:["Tracker ID","Northing (ft)","Easting (ft)","Existing Ground (ft)",
              "Top of Pile (ft)","Pile Reveal (ft)","Solution Type","Final FG (ft)",
              "Ground Adj (ft)","Cut / Fill","Tube Slope","Slope Delta"]
    });

    // Column widths
    wsData["!cols"]=[
      {wch:14},{wch:14},{wch:14},{wch:18},
      {wch:16},{wch:14},{wch:18},{wch:14},
      {wch:14},{wch:10},{wch:12},{wch:12}
    ];

    // Style header row (bold + dark fill) — SheetJS CE supports cell styles via !styles
    const hdrStyle={font:{bold:true,color:{rgb:"C8E6D4"}},fill:{fgColor:{rgb:"0A2A1A"}},
      alignment:{horizontal:"center"},border:{bottom:{style:"medium",color:{rgb:"00E5A0"}}}};
    const hdrCols=["A","B","C","D","E","F","G","H","I","J","K","L"];
    hdrCols.forEach(col=>{const cell=wsData[col+"1"];if(cell)cell.s=hdrStyle;});

    // Style data rows: alternate row shading, number formatting
    const numFmt4="0.0000"; const numFmt6="0.000000";
    for(let row=2;row<=data.length+1;row++){
      const isAlt=row%2===0;
      const fillColor=isAlt?"071A0E":"040E09";
      hdrCols.forEach((col,ci)=>{
        const addr=col+row; const cell=wsData[addr];
        if(!cell)return;
        const baseStyle={fill:{fgColor:{rgb:fillColor}},alignment:{horizontal:"right"}};
        // Number formats
        if(ci>=1&&ci<=3)cell.z=numFmt4;    // coords + existing ground
        if(ci===4)cell.z=numFmt4;           // TOP
        if(ci===5)cell.z=numFmt4;           // reveal
        if(ci===6){cell.s={...baseStyle,alignment:{horizontal:"center"}};return;} // solution type
        if(ci===7)cell.z=numFmt4;           // final FG
        if(ci===8)cell.z=numFmt4;           // ground adj
        if(ci===9){cell.s={...baseStyle,alignment:{horizontal:"center"}};return;} // cut/fill label
        if(ci===10)cell.z=numFmt6;          // slope
        if(ci===11)cell.z=numFmt6;          // slope delta
        cell.s=baseStyle;
      });
    }
    XLSX.utils.book_append_sheet(wb,wsData,"Optimization Results");

    // Sheet: Tracker Ends — TrackerID | North pile TOP | South pile TOP
    // (for the downstream straight-line CAD workflow: the tube is fully
    // defined by its two end TOPs)
    const endRows=[["TrackerID","North Pile TOP","South Pile TOP"]];
    for(const tid of trackerIDs){
      const res=allResults[tid];
      if(!res||!res.length)continue;
      const srt=[...res].sort((a,b)=>a.Northing-b.Northing); // S→N
      endRows.push([tid,
        +srt[srt.length-1].TopOfPile.toFixed(4),  // northernmost
        +srt[0].TopOfPile.toFixed(4)]);           // southernmost
    }
    const wsEnds=XLSX.utils.aoa_to_sheet(endRows);
    wsEnds['!cols']=[{wch:14},{wch:16},{wch:16}];
    XLSX.utils.book_append_sheet(wb,wsEnds,"Tracker Ends");

    // Sheet: Design Parameters snapshot
    const params=[
      ["Parameter","Value","Unit"],
      ["Target Reveal",constraints.targetReveal,"ft"],
      ["Min Reveal",constraints.minReveal,"ft"],
      ["Max Reveal",constraints.maxReveal,"ft"],
      ["Max Tube Slope (%)",+(constraints.maxSlope*100).toFixed(1),"%"],
      ["Max Slope Delta (%)",+(constraints.maxSlopeDelta*100).toFixed(1),"%"],
      ["","",""],
      ["Run Date",new Date().toLocaleDateString(),""],
      ["Total Trackers",trackerIDs.length,""],
      ["Total Piles",rawData.length,""],
      ["Straight Line",summary.filter(s=>classifyMethod(s.method)==="straight").length,""],
      ["Optimized (no regrade)",summary.filter(s=>classifyMethod(s.method)==="optimized").length,""],
      ["Needs Regrade",summary.filter(s=>classifyMethod(s.method)==="regrade").length,""],
      ["Fleet Cut Total",summary.reduce((a,s)=>a+s.totalCut,0).toFixed(3),"ft"],
      ["Fleet Fill Total",summary.reduce((a,s)=>a+s.totalFill,0).toFixed(3),"ft"],
    ];
    const wsParams=XLSX.utils.aoa_to_sheet(params);
    wsParams["!cols"]=[{wch:28},{wch:16},{wch:8}];
    XLSX.utils.book_append_sheet(wb,wsParams,"Design Parameters");

    // ── Write and download ──────────────────────────────────────────────────
    XLSX.writeFile(wb,"TrackerOptimization_Results.xlsx");
  };

  const setC=(k,v)=>setConstraints(p=>({...p,[k]:v}));
  const c=constraints;
  const piles=trackerMap[selectedTracker]||[];
  const r0=results[0]||{};
  const reveals=results.map(r=>r.FinalReveal);

  const numSlider=(key,min,max,step,label,unit="",color="#ad1f2b")=>(
    <div style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:3}}>
        <label style={{fontSize:10,color:"#4d4d4f",letterSpacing:"0.05em"}}>{label}</label>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <input type="number" min={min} max={max} step={step} value={c[key]}
            onChange={e=>setC(key,parseFloat(e.target.value))}
            style={{width:72,background:"#f5f5f5",border:"1px solid #bcbec0",borderRadius:3,
              color,padding:"3px 6px",fontSize:12,textAlign:"right"}}/>
          {unit&&<span style={{fontSize:10,color:"#4d4d4f",width:20}}>{unit}</span>}
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={c[key]}
        onChange={e=>setC(key,parseFloat(e.target.value))}
        style={{width:"100%",accentColor:color}}/>
    </div>
  );

  // Slope/delta: display & accept % values, store internally as decimal
  const numSliderPct=(key,minPct,maxPct,stepPct,label,unit="%",color="#ad1f2b")=>(
    <div style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:3}}>
        <label style={{fontSize:10,color:"#4d4d4f",letterSpacing:"0.05em"}}>{label}</label>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <input type="number" min={minPct} max={maxPct} step={stepPct}
            value={(c[key]*100).toFixed(2)}
            onChange={e=>setC(key,parseFloat(e.target.value)/100)}
            style={{width:72,background:"#f5f5f5",border:"1px solid #bcbec0",borderRadius:3,
              color,padding:"3px 6px",fontSize:12,textAlign:"right"}}/>
          {unit&&<span style={{fontSize:10,color:"#4d4d4f",width:20}}>{unit}</span>}
        </div>
      </div>
      <input type="range" min={minPct} max={maxPct} step={stepPct}
        value={(c[key]*100).toFixed(2)}
        onChange={e=>setC(key,parseFloat(e.target.value)/100)}
        style={{width:"100%",accentColor:color}}/>
    </div>
  );

  return(    <div style={{minHeight:"100vh",background:"#ffffff",color:"#333132",fontFamily:"'Jost',system-ui,sans-serif",display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{background:"#ad1f2b",borderBottom:"1px solid #8e1922",padding:"16px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:10,color:"#f0c9cd",letterSpacing:"0.15em",textTransform:"uppercase"}}>Castillo Engineering · Civil · Utility-Scale Solar · N–S Torque Tube + Flex Joints</div>
          <div style={{fontSize:20,fontWeight:700,color:"#ffffff",letterSpacing:"-0.01em"}}>Pile Plan Optimizer — Terrain Following</div>
          <div style={{fontSize:10,color:"#f0c9cd",marginTop:1}}>{trackerIDs.length} trackers · {rawData.length} pile locations · v1.1</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
          <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
            <button onClick={()=>fileRef.current.click()} style={{padding:"7px 12px",background:"#f0f0f0",border:"1px solid #bcbec0",borderRadius:5,color:"#333132",cursor:"pointer",fontSize:11}}>{fileLoading?"⏳ Loading…":"↑ Load .xlsx / .csv"}</button>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{display:"none"}}/>
            <button onClick={exportXLSX} disabled={progress.running||trackerIDs.length===0} style={{padding:"7px 12px",background:progress.running?"#f0f0f0":"#ffffff",border:"1px solid #ffffff",borderRadius:5,color:progress.running?"#4d4d4f":"#ad1f2b",fontWeight:600,cursor:progress.running?"not-allowed":"pointer",fontSize:11}}>↓ Export .xlsx</button>
            <RunBar busy={progress.running||fileLoading}
              getSnapshot={()=>({constraints,rawData,allResults,selectedTracker,ewAnchors})}
              onOpen={openSnapshot}/>
          </div>
          {progress.total>0&&(
            <div style={{display:"flex",alignItems:"center",gap:8,minWidth:260}}>
              <div style={{flex:1,height:4,background:"#8e1922",borderRadius:2,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:2,transition:"width 0.1s",
                  background:"#ffffff",
                  width:`${progress.total>0?progress.done/progress.total*100:0}%`}}/>
              </div>
              <span style={{fontSize:9,color:progress.running?"#ffffff":"#f0c9cd",whiteSpace:"nowrap",minWidth:120,textAlign:"right"}}>
                {progress.running
                  ?`${progress.done.toLocaleString()} / ${progress.total.toLocaleString()} trackers  ${progress.elapsed}s`
                  :`${progress.total.toLocaleString()} trackers  ${progress.elapsed}s`}
              </span>
            </div>
          )}
        </div>
      </div>
      {fileError&&<div style={{background:"#ffe8e8",borderBottom:"1px solid #e12a3f",padding:"7px 24px",color:"#e12a3f",fontSize:11}}>{fileError}</div>}

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* LEFT PANEL */}
        <div style={{width:210,minWidth:210,background:"#ffffff",borderRight:"1px solid #e2e3e5",padding:"16px 14px",overflowY:"auto",flexShrink:0}}>
          <div style={{fontSize:10,color:"#4d4d4f",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:12}}>⚙ Constraints</div>

          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:9,color:"#333132",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,marginBottom:6,paddingBottom:3,borderBottom:"2px solid #ad1f2b"}}><span style={{width:8,height:8,borderRadius:2,background:"#ad1f2b",flexShrink:0}}/>Pile Reveal</div>
          {numSlider("targetReveal",1,10,0.1,"Target Reveal","ft")}
          {numSlider("minReveal",0.5,8,0.1,"Min Reveal","ft","#1f66ad")}
          {numSlider("maxReveal",2,12,0.1,"Max Reveal","ft","#8a6300")}

          <div style={{borderTop:"1px solid #e2e3e5",margin:"10px 0"}}/>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:9,color:"#333132",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,marginBottom:6,paddingBottom:3,borderBottom:"2px solid #5e4b40"}}><span style={{width:8,height:8,borderRadius:2,background:"#5e4b40",flexShrink:0}}/>Tube Geometry</div>
          {numSliderPct("maxSlope",0.1,20,0.1,"Max Tube Slope","%","#ad1f2b")}
          <div style={{fontSize:9,color:"#4d4d4f",marginTop:-8,marginBottom:8,lineHeight:1.4}}>
            Max slope of the N–S torque tube between any two pile spans
          </div>
          {numSliderPct("maxSlopeDelta",0.01,10,0.01,"Max Slope Δ","%","#8a6300")}
          <div style={{fontSize:9,color:"#4d4d4f",marginTop:-8,marginBottom:8,lineHeight:1.4}}>
            Max change in slope between consecutive spans — governs flex joint rotation
          </div>

          <div style={{borderTop:"1px solid #e2e3e5",margin:"10px 0"}}/>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:9,color:"#333132",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,marginBottom:8,paddingBottom:3,borderBottom:"2px solid #c7bb2e"}}><span style={{width:8,height:8,borderRadius:2,background:"#c7bb2e",flexShrink:0}}/>Grading Preference</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{flex:1,paddingRight:8}}>
              <div style={{fontSize:10,color:"#4d4d4f"}}>Prefer Cut on High Ground</div>
              <div style={{fontSize:9,color:"#4d4d4f",lineHeight:1.4,marginTop:2}}>Rotate tube to avoid cut at lowest end pile</div>
            </div>
            <div onClick={()=>setC("preferCutHigh",!c.preferCutHigh)}
              style={{width:36,height:20,borderRadius:10,background:c.preferCutHigh?"#ad1f2b":"#4d4d4f",
                cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
              <div style={{width:14,height:14,borderRadius:7,background:"#ffffff",position:"absolute",
                top:3,left:c.preferCutHigh?19:3,transition:"left 0.2s"}}/>
            </div>
          </div>
          <div style={{borderTop:"1px solid #e2e3e5",margin:"10px 0"}}/>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:9,color:"#333132",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,marginBottom:6,paddingBottom:3,borderBottom:"2px solid #1aa6c9"}}><span style={{width:8,height:8,borderRadius:2,background:"#1aa6c9",flexShrink:0}}/>Adjacency Limits</div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
            <span style={{fontSize:10,color:"#4d4d4f",letterSpacing:"0.05em",flex:1}}>N-S End Limit Mode</span>
            {["delta","slope"].map(md=>(
              <div key={md} onClick={()=>setC("nsEndMode",md)}
                style={{padding:"2px 10px",borderRadius:3,fontSize:10,cursor:"pointer",
                  border:`1px solid ${c.nsEndMode===md?"#c2571c":"#4d4d4f"}`,
                  background:c.nsEndMode===md?"#c2571c":"transparent",
                  color:c.nsEndMode===md?"#fff":"#4d4d4f",fontWeight:c.nsEndMode===md?700:400}}>
                {md==="delta"?"ft":"%"}
              </div>
            ))}
          </div>
          {c.nsEndMode==="slope"
            ?numSliderPct("maxNSSlope",1,100,0.5,"N-S End Slope","%","#c2571c")
            :numSlider("maxNSDelta",0.1,5,0.1,"N-S End Δ","ft","#c2571c")}
          <div style={{fontSize:9,color:"#4d4d4f",marginTop:-8,marginBottom:8,lineHeight:1.4}}>
            {c.nsEndMode==="slope"
              ?"Max end-to-end TOP slope across the N-S gap — limit scales with the actual gap"
              :"Max TOP diff between adjacent N-S tracker ends (fixed, regardless of gap)"}
          </div>
          {numSliderPct("maxEWSlope",1,20,0.5,"E-W End Slope","%","#7b4bb5")}
          <div style={{fontSize:9,color:"#4d4d4f",marginTop:-8,marginBottom:8,lineHeight:1.4}}>
            Max TOP slope between E-W adjacent piles
          </div>
          {numSlider("maxEWSpacing",5,50,1,"E-W Spacing Limit","ft","#7b4bb5")}
          <div style={{fontSize:9,color:"#4d4d4f",marginTop:-8,marginBottom:8,lineHeight:1.4}}>
            Max easting gap to check E-W adjacency (ft)
          </div>
          {numSlider("maxEWNSGap",1,100,1,"E-W N-S Gap Limit","ft","#7b4bb5")}
          <div style={{fontSize:9,color:"#4d4d4f",marginTop:-8,marginBottom:8,lineHeight:1.4}}>
            Max northing distance to consider piles E-W adjacent
          </div>
          {numSlider("maxNSGap",1,50,1,"N-S Gap Limit","ft","#1f66ad")}
          <div style={{fontSize:9,color:"#4d4d4f",marginTop:-8,marginBottom:8,lineHeight:1.4}}>
            Max northing gap to consider trackers N-S adjacent
          </div>

          <div style={{borderTop:"1px solid #e2e3e5",margin:"10px 0"}}/>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:"#333132",letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:600,marginBottom:8,paddingBottom:3,borderBottom:"2px solid #333132"}}><span style={{width:8,height:8,borderRadius:2,background:"#333132",flexShrink:0}}/>Fleet Summary</div>
          <FleetStats summary={summary} adjacencyFlags={adjacencyFlags}/>
        </div>

        {/* MAIN CONTENT */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {/* Tracker selector bar */}
          <div style={{padding:"8px 18px",background:"#ffffff",borderBottom:"1px solid #e2e3e5",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span style={{fontSize:10,color:"#4d4d4f",letterSpacing:"0.08em"}}>TRACKER</span>
            <select value={selectedTracker} onChange={e=>setSelectedTracker(e.target.value)}
              style={{background:"#f5f5f5",border:"1px solid #bcbec0",borderRadius:4,color:"#ad1f2b",padding:"4px 8px",fontSize:12}}>
              {trackerIDs.map(id=><option key={id} value={id}>{id} {(allResults[id]?.[0]?.Violations?.length||0)>0?"⚠":"✓"}</option>)}
            </select>
            {[
              {label:"Method",val:r0?.Method==="StraightLine"?"Straight Line":r0?.Method?.startsWith("Terrain Follow")?r0.Method:"—"},
              {label:"Reveals",val:reveals.length?`${arrMin(reveals).toFixed(2)}–${arrMax(reveals).toFixed(2)} ft`:"—"},
              {label:"Max Slope",val:r0?.MaxAbsSlope!=null?(r0.MaxAbsSlope*100).toFixed(2)+"%":"—",warn:r0?.MaxAbsSlope>c.maxSlope},
              {label:"Max ΔSlope",val:r0?.MaxAbsSlopeDelta!=null?(r0.MaxAbsSlopeDelta*100).toFixed(2)+"%":"—",warn:r0?.MaxAbsSlopeDelta>c.maxSlopeDelta},
              {label:"Cut",val:r0?.TotalCut!=null?r0.TotalCut.toFixed(3)+" ft":"—",col:"#e12a3f"},
              {label:"Fill",val:r0?.TotalFill!=null?r0.TotalFill.toFixed(3)+" ft":"—",col:"#1f66ad"},
            ].map(({label,val,warn,col})=>(
              <div key={label} style={{background:warn?"#ffe8e8":"#f5f5f5",border:`1px solid ${warn?"#ffe0e0":"#4d4d4f"}`,borderRadius:3,padding:"3px 7px",fontSize:10}}>
                <span style={{color:"#4d4d4f"}}>{label}: </span>
                <span style={{color:warn?"#e12a3f":col||"#333132"}}>{val}</span>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{display:"flex",borderBottom:"1px solid #e2e3e5",background:"#ffffff"}}>
            {[["chart","📊 Profile"],["slope","📈 Slope"],["table","📋 Piles"],["summary","🗂 Fleet"],["adjacency","🔗 Adjacency"],["input","⚙ Input & Export"]].map(([id,label])=>(
              <button key={id} onClick={()=>setActiveTab(id)} style={{
                padding:"7px 16px",fontSize:11,letterSpacing:"0.05em",
                background:activeTab===id?"#f5f5f5":"transparent",border:"none",
                borderBottom:activeTab===id?"2px solid #278747":"2px solid transparent",
                color:activeTab===id?"#ad1f2b":"#4d4d4f",cursor:"pointer",transition:"all 0.1s"}}>
                {label}
              </button>
            ))}
          </div>

          {/* Tab Body */}
          <div style={{flex:1,overflowY:"auto",padding:"14px 18px"}}>

            {activeTab==="chart"&&(
              <div>
                <ExplanationCard results={results}/>
                <ProfileWithAdj selectedTracker={selectedTracker} piles={piles} results={results} trackerMap={trackerMap} trackerIDs={trackerIDs} allResults={allResults} adjacencyFlags={adjacencyFlags} constraints={constraints}/>
                <div style={{marginTop:14,fontSize:10,color:"#4d4d4f",letterSpacing:"0.08em",marginBottom:6}}>PILE REVEAL DISTRIBUTION</div>
                <RevealBars results={results} minReveal={c.minReveal} maxReveal={c.maxReveal} targetReveal={c.targetReveal}/>
              </div>
            )}

            {activeTab==="slope"&&(
              <div>
                <div style={{marginBottom:12,background:"#f5f5f5",border:"1px solid #bcbec0",borderRadius:6,padding:"10px 14px",fontSize:11,color:"#333132",lineHeight:1.7}}>
                  <strong style={{color:"#ad1f2b"}}>Slope Chart Guide</strong><br/>
                  <span style={{color:"#1f66ad"}}>● Tube Slope</span> — change in top-of-pile elevation divided by horizontal distance between piles (% slope. This is the grade the N–S torque tube runs at between each consecutive pile span.<br/>
                  <span style={{color:"#8a6300"}}>⬥ Slope Δ (flex joint)</span> — change in slope between one span and the next. This is the angular rotation demanded of the flexible joint at each interior pile top. The flex joint limit is typically the most constraining geometry check on undulating terrain.
                  <br/><span style={{color:"#e12a3f"}}>Red dashed lines</span> = your constraint limits (in % slope).
                </div>
                <div style={{fontSize:10,color:"#4d4d4f",letterSpacing:"0.08em",marginBottom:6}}>TUBE SLOPE & FLEX JOINT ROTATION — {selectedTracker}</div>
                <div style={{overflowX:"auto"}}><SlopeChart results={results} maxSlope={c.maxSlope} maxSlopeDelta={c.maxSlopeDelta}/></div>
                {/* Slope table */}
                <div style={{marginTop:16,fontSize:10,color:"#4d4d4f",letterSpacing:"0.08em",marginBottom:6}}>SPAN-BY-SPAN SLOPE TABLE</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,}}>
                  <thead><tr style={{borderBottom:"1px solid #bcbec0"}}>
                    {["Span","From Pile","To Pile","Δ Northing (ft)","Δ TOP Elev (ft)","Slope %","ΔSlope %","Flex OK?"].map(h=>(
                      <th key={h} style={{padding:"4px 8px",textAlign:"right",fontSize:9,color:"#4d4d4f",fontWeight:500,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {[...results].sort((a,b)=>b.Northing-a.Northing).map((r,i,disp)=>{
                      if(i===0)return null;
                      const prev=disp[i-1]; // pile to the north
                      const dN=r.Northing-prev.Northing,dE=(r.Easting||0)-(prev.Easting||0);const dx=Math.sqrt(dN*dN+dE*dE)*Math.sign(dN||1);
                      const dz=r.TopOfPile-prev.TopOfPile;
                      const slope=dx===0?0:dz/dx;
                      const sOk=Math.abs(slope)<=c.maxSlope+1e-5;
                      // Live delta vs the previous (northern) span — stays
                      // correct after corrections move piles
                      let delta=null;
                      if(i>=2){
                        const dN2=prev.Northing-disp[i-2].Northing,dE2=(prev.Easting||0)-(disp[i-2].Easting||0);const dx0=Math.sqrt(dN2*dN2+dE2*dE2)*Math.sign(dN2||1);
                        if(dx0!==0){
                          const s0=(prev.TopOfPile-disp[i-2].TopOfPile)/dx0;
                          delta=slope-s0;
                        }
                      }
                      const dOk=delta===null||Math.abs(delta)<=c.maxSlopeDelta+1e-5;
                      return(
                        <tr key={i} style={{borderBottom:"1px solid #eceded",background:i%2===0?"transparent":"#ffffff"}}>
                          <td style={{padding:"4px 8px",textAlign:"right",color:"#4d4d4f"}}>{i}→{i+1}</td>
                          <td style={{padding:"4px 8px",textAlign:"right",color:"#333132"}}>{prev.Northing.toFixed(1)}</td>
                          <td style={{padding:"4px 8px",textAlign:"right",color:"#333132"}}>{r.Northing.toFixed(1)}</td>
                          <td style={{padding:"4px 8px",textAlign:"right",color:"#4d4d4f"}}>{Math.abs(dx).toFixed(2)}</td>
                          <td style={{padding:"4px 8px",textAlign:"right",color:"#4d4d4f"}}>{dz.toFixed(4)}</td>
                          <td style={{padding:"4px 8px",textAlign:"right",color:sOk?"#ad1f2b":"#e12a3f",fontWeight:sOk?400:700}}>{(slope*100).toFixed(3)}%</td>
                          <td style={{padding:"4px 8px",textAlign:"right",color:dOk?"#8a6300":"#e12a3f",fontWeight:dOk?400:700}}>{delta!==null?(delta*100).toFixed(3)+"%":"—"}</td>
                          <td style={{padding:"4px 8px",textAlign:"right"}}>{dOk?<span style={{color:"#ad1f2b"}}>✓</span>:<span style={{color:"#e12a3f"}}>⚠</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab==="table"&&(
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,}}>
                  <thead><tr style={{borderBottom:"1px solid #bcbec0"}}>
                    {["#","Northing","Exist. Grd","Top of Pile","Reveal","Cut/Fill","Adj. Grd","Slope %","Slope Δ %","OK"].map(h=>(
                      <th key={h} style={{padding:"5px 8px",textAlign:"right",fontSize:9,color:"#4d4d4f",fontWeight:500,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {[...results].sort((a,b)=>b.Northing-a.Northing).map((r,i,disp)=>{
                      // Live slope of the span north of this pile (pile 1 = northernmost)
                      let liveSlope=null;
                      if(i>0){
                        const dNn=r.Northing-disp[i-1].Northing,dEn=(r.Easting||0)-(disp[i-1].Easting||0);const dxn=Math.sqrt(dNn*dNn+dEn*dEn)*Math.sign(dNn||1);
                        if(dxn!==0)liveSlope=(r.TopOfPile-disp[i-1].TopOfPile)/dxn;
                      }
                      let liveDelta=null;
                      if(i>=2){
                        const dN0=disp[i-1].Northing-disp[i-2].Northing,dE0=(disp[i-1].Easting||0)-(disp[i-2].Easting||0);const dx0=Math.sqrt(dN0*dN0+dE0*dE0)*Math.sign(dN0||1);
                        if(dx0!==0&&liveSlope!==null){
                          const s0=(disp[i-1].TopOfPile-disp[i-2].TopOfPile)/dx0;
                          liveDelta=liveSlope-s0;
                        }
                      }
                      const revOk=r.FinalReveal>=c.minReveal&&r.FinalReveal<=c.maxReveal;
                      const sOk=liveSlope===null||Math.abs(liveSlope)<=c.maxSlope+1e-5;
                      const dOk=liveDelta===null||Math.abs(liveDelta)<=c.maxSlopeDelta+1e-5;
                      const cfOk=true;
                      const allOk=revOk&&sOk&&dOk;
                      return(
                        <tr key={i} style={{borderBottom:"1px solid #eceded",background:i%2===0?"transparent":"#ffffff"}}>
                          <td style={{padding:"4px 8px",textAlign:"right",color:"#4d4d4f"}}>{i+1}</td>
                          <td style={{padding:"4px 8px",textAlign:"right",color:"#333132"}}>{r.Northing.toFixed(2)}</td>
                          <td style={{padding:"4px 8px",textAlign:"right",color:"#333132"}}>{r.ExistingGround.toFixed(4)}</td>
                          <td style={{padding:"4px 8px",textAlign:"right",color:"#ad1f2b"}}>{r.TopOfPile.toFixed(4)}</td>
                          <td style={{padding:"4px 8px",textAlign:"right",color:revOk?"#ad1f2b":"#e12a3f",fontWeight:revOk?400:700}}>{r.FinalReveal.toFixed(4)}</td>
                          <td style={{padding:"4px 8px",textAlign:"right",color:Math.abs(r.CutFill)<0.001?"#4d4d4f":r.CutFill<0?"#e12a3f":"#1f66ad"}}>
                            {Math.abs(r.CutFill)<0.001?"—":r.CutFill>0?`+${r.CutFill.toFixed(4)}`:r.CutFill.toFixed(4)}
                          </td>
                          <td style={{padding:"4px 8px",textAlign:"right",color:Math.abs(r.CutFill)<0.001?"#4d4d4f":"#8a6300"}}>{r.FinalGround.toFixed(4)}</td>
                          <td style={{padding:"4px 8px",textAlign:"right",color:sOk?"#333132":"#e12a3f",fontWeight:sOk?400:700}}>{liveSlope!==null?(liveSlope*100).toFixed(3)+"%":"—"}</td>
                          <td style={{padding:"4px 8px",textAlign:"right",color:dOk?"#333132":"#e12a3f",fontWeight:dOk?400:700}}>{liveDelta!==null?(liveDelta*100).toFixed(3)+"%":"—"}</td>
                          <td style={{padding:"4px 8px",textAlign:"right"}}>{allOk?<span style={{color:"#ad1f2b"}}>✓</span>:<span style={{color:"#e12a3f"}}>⚠</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab==="summary"&&(
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,}}>
                  <thead><tr style={{borderBottom:"1px solid #bcbec0"}}>
                    {["Tracker","Method","Min Rev","Max Rev","Avg Rev","Max Slope %","Max ΔSlope %","Cut (ft)","Fill (ft)","Net (ft)","Status"].map(h=>(
                      <th key={h} style={{padding:"5px 8px",textAlign:"right",fontSize:9,color:"#4d4d4f",fontWeight:500,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {summary.map((s,i)=>(
                      <tr key={s.id} onClick={()=>{setSelectedTracker(s.id);setActiveTab("chart");}}
                        style={{borderBottom:"1px solid #eceded",background:selectedTracker===s.id?"#f5f5f5":i%2===0?"transparent":"#ffffff",cursor:"pointer"}}>
                        <td style={{padding:"4px 8px",textAlign:"right",color:"#ad1f2b",fontWeight:600}}>{s.id}</td>
                        <td style={{padding:"4px 8px",textAlign:"right",fontSize:9,color:s.method==="StraightLine"?"#1f66ad":"#8a6300"}}>
                          {s.method==="StraightLine"?"Straight":"TF"+(s.totalCut>0.001||s.totalFill>0.001?" w/Grade":"")}
                        </td>
                        <td style={{padding:"4px 8px",textAlign:"right",color:s.minRev>=c.minReveal?"#333132":"#e12a3f"}}>{s.minRev.toFixed(3)}</td>
                        <td style={{padding:"4px 8px",textAlign:"right",color:s.maxRev<=c.maxReveal?"#333132":"#e12a3f"}}>{s.maxRev.toFixed(3)}</td>
                        <td style={{padding:"4px 8px",textAlign:"right",color:"#333132"}}>{s.avgRev.toFixed(3)}</td>
                        <td style={{padding:"4px 8px",textAlign:"right",color:s.maxAbsSlope<=c.maxSlope?"#333132":"#e12a3f",fontWeight:s.maxAbsSlope>c.maxSlope?700:400}}>{(s.maxAbsSlope*100).toFixed(3)}%</td>
                        <td style={{padding:"4px 8px",textAlign:"right",color:s.maxAbsSlopeDelta<=c.maxSlopeDelta?"#333132":"#e12a3f",fontWeight:s.maxAbsSlopeDelta>c.maxSlopeDelta?700:400}}>{(s.maxAbsSlopeDelta*100).toFixed(3)}%</td>
                        <td style={{padding:"4px 8px",textAlign:"right",color:s.totalCut>0.001?"#e12a3f":"#4d4d4f"}}>{s.totalCut>0.001?s.totalCut.toFixed(3):"—"}</td>
                        <td style={{padding:"4px 8px",textAlign:"right",color:s.totalFill>0.001?"#1f66ad":"#4d4d4f"}}>{s.totalFill>0.001?s.totalFill.toFixed(3):"—"}</td>
                        <td style={{padding:"4px 8px",textAlign:"right",color:s.net<0.05?"#ad1f2b":s.net<0.5?"#8a6300":"#e12a3f"}}>{s.totalCut>0.001||s.totalFill>0.001?s.net.toFixed(3):"—"}</td>
                        <td style={{padding:"4px 8px",textAlign:"right"}}>{s.ok?<span style={{color:"#ad1f2b"}}>✓</span>:<span style={{color:"#e12a3f"}}>⚠{s.violations}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{marginTop:8,fontSize:9,color:"#4d4d4f"}}>Click any row to view profile · Blue = Straight Line (no earthwork) · Orange = Terrain Follow · Net column = remaining cut/fill imbalance after row balancing</div>
              </div>
            )}

            {activeTab==="adjacency"&&(
              <div>
                <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
                  {[
                    {label:"N-S End Flags",count:(adjacencyFlags.ns||[]).length,color:"#c2571c",desc:`TOP diff > ${constraints.maxNSDelta} ft`},
                    {label:"E-W End Flags",count:(adjacencyFlags.ew||[]).length,color:"#7b4bb5",desc:`END slope > ${(constraints.maxEWSlope*100).toFixed(1)}%`},
                  ].map(({label,count,color,desc})=>(
                    <div key={label} style={{background:"#f5f5f5",border:`1px solid ${color}44`,borderRadius:6,padding:"10px 16px",minWidth:160}}>
                      <div style={{fontSize:9,color:"#4d4d4f",letterSpacing:"0.1em",textTransform:"uppercase"}}>{label}</div>
                      <div style={{fontSize:24,color:count>0?color:"#4d4d4f",fontWeight:700}}>{count}</div>
                      <div style={{fontSize:9,color:"#4d4d4f"}}>{desc}</div>
                    </div>
                  ))}
                </div>

                {/* N-S flags table */}
                {(adjacencyFlags.ns||[]).length>0&&(
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:10,color:"#c2571c",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>
                      ⚠ N-S Adjacent End Mismatch ({(adjacencyFlags.ns||[]).length} pairs)
                    </div>
                    <div style={{fontSize:9,color:"#4d4d4f",marginBottom:6}}>
                      Pairs where TOP elevation difference between adjacent tracker ends exceeds {constraints.maxNSDelta} ft
                    </div>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,}}>
                      <thead><tr style={{borderBottom:"1px solid #bcbec0"}}>
                        {["S Tracker (N end)","N Tracker (S end)","TOP (S)","TOP (N)","Δ TOP (ft)","Gap (ft)"].map(h=>(
                          <th key={h} style={{padding:"4px 8px",textAlign:"right",fontSize:9,color:"#4d4d4f",fontWeight:500,whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {(adjacencyFlags.ns||[]).map((f,i)=>(
                          <tr key={i} style={{borderBottom:"1px solid #eceded",background:i%2===0?"transparent":"#ffffff",cursor:"pointer"}}
                            onClick={()=>{setSelectedTracker(f.trackerA);setActiveTab("chart");}}>
                            <td style={{padding:"4px 8px",textAlign:"right",color:"#c2571c",fontWeight:600}}>{f.trackerA}</td>
                            <td style={{padding:"4px 8px",textAlign:"right",color:"#c2571c",fontWeight:600}}>{f.trackerB}</td>
                            <td style={{padding:"4px 8px",textAlign:"right",color:"#333132"}}>{f.topA.toFixed(3)}</td>
                            <td style={{padding:"4px 8px",textAlign:"right",color:"#333132"}}>{f.topB.toFixed(3)}</td>
                            <td style={{padding:"4px 8px",textAlign:"right",color:"#c2571c",fontWeight:700}}>{f.delta.toFixed(3)}</td>
                            <td style={{padding:"4px 8px",textAlign:"right",color:"#4d4d4f"}}>{f.gap.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* E-W flags table */}
                {(adjacencyFlags.ew||[]).length>0&&(
                  <div>
                    <div style={{fontSize:10,color:"#7b4bb5",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>
                      ⚠ E-W Adjacent End Mismatch ({(adjacencyFlags.ew||[]).length} pairs)
                    </div>
                    <div style={{fontSize:9,color:"#4d4d4f",marginBottom:6}}>
                      Pairs where TOP slope between adjacent tracker ends exceeds {(constraints.maxEWSlope*100).toFixed(1)}% (spacing-based)
                    </div>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,}}>
                      <thead><tr style={{borderBottom:"1px solid #bcbec0"}}>
                        {["Tracker A","Pile","Tracker B","Pile","TOP A","TOP B","Slope %","ΔE (ft)","ΔN (ft)"].map(h=>(
                          <th key={h} style={{padding:"4px 8px",textAlign:"right",fontSize:9,color:"#4d4d4f",fontWeight:500,whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {(adjacencyFlags.ew||[]).map((f,i)=>(
                          <tr key={i} style={{borderBottom:"1px solid #4d4d4f",background:i%2===0?"transparent":"#f5f5f5"}}>
                              <td style={{padding:"4px 6px",textAlign:"center"}}>
                                {[f.trackerA,f.trackerB].map(tid=>{
                                  const nsFlags=adjacencyFlags.ns||[];
                                  const isClean=!nsFlags.some(n=>n.trackerA===tid||n.trackerB===tid);
                                  const isAnchor=ewAnchors.has(tid);
                                  return(
                                    <div key={tid}
                                      title={`${tid}${isClean?' ✓ NS clean':' ⚠ has NS flags'}`}
                                      onClick={(e)=>{e.stopPropagation();setEwAnchors(prev=>{const s=new Set(prev);s.has(tid)?s.delete(tid):s.add(tid);return s;});}}
                                      style={{width:14,height:14,borderRadius:2,cursor:"pointer",margin:"1px auto",
                                        border:`2px solid ${isClean?"#278747":"#4d4d4f"}`,
                                        background:isAnchor?(isClean?"#278747":"#8a6300"):"transparent",
                                        display:"flex",alignItems:"center",justifyContent:"center",
                                        fontSize:9,color:"#fff",fontWeight:700}}>
                                      {isAnchor?"✓":""}
                                    </div>
                                  );
                                })}
                              </td>
                              <td style={{padding:"4px 8px",textAlign:"right",color:ewAnchors.has(f.trackerA)?"#278747":"#7b4bb5",fontWeight:600}}
                                onClick={()=>{setSelectedTracker(f.trackerA);setActiveTab("chart");}} className="clickable">{f.trackerA}</td>
                              <td style={{padding:"4px 8px",textAlign:"right",color:"#4d4d4f"}}>{f.pileA??'—'}</td>
                              <td style={{padding:"4px 8px",textAlign:"right",color:ewAnchors.has(f.trackerB)?"#278747":"#7b4bb5",fontWeight:600}}
                                onClick={()=>{setSelectedTracker(f.trackerB);setActiveTab("chart");}} className="clickable">{f.trackerB}</td>
                              <td style={{padding:"4px 8px",textAlign:"right",color:"#4d4d4f"}}>{f.pileB??'—'}</td>
                              <td style={{padding:"4px 8px",textAlign:"right",color:"#333132"}}>{f.topA.toFixed(3)}</td>
                              <td style={{padding:"4px 8px",textAlign:"right",color:"#333132"}}>{f.topB.toFixed(3)}</td>
                              <td style={{padding:"4px 8px",textAlign:"right",color:"#7b4bb5",fontWeight:700}}>{(f.slope*100).toFixed(2)}%</td>
                              <td style={{padding:"4px 8px",textAlign:"right",color:"#4d4d4f"}}>{(f.ewDist??f.spacing??0).toFixed(1)}</td>
                              <td style={{padding:"4px 8px",textAlign:"right",color:"#4d4d4f"}}>{f.nsDist!=null?f.nsDist.toFixed(1):'—'}</td>
                            </tr>                       ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {(adjacencyFlags.ns||[]).length===0&&(adjacencyFlags.ew||[]).length===0&&(
                  <div style={{color:"#ad1f2b",fontSize:13,padding:"20px 0"}}>
                    ✓ No adjacency violations found with current parameters.
                  </div>
                )}
                {/* Correction controls */}
                <div style={{display:"flex",alignItems:"center",gap:12,marginTop:16,paddingTop:12,borderTop:"1px solid #bcbec0"}}>
                  <button
                    onClick={()=>{
                      if(Object.keys(allResults).length===0)return;
                      setNsCorrectionRunning(true);
                      setTimeout(()=>{
                        const snapshot={...allResults};
                        const{updated,residual,correctedCount}=applyNSCorrections(allResults,trackerIDs,constraints);
                        setAllResults(updated);
                        setNsCorrection({correctedCount,residual,snapshot});
                        setNsCorrectionRunning(false);
                      },20);
                    }}
                    disabled={nsCorrectionRunning||Object.keys(allResults).length===0}
                    style={{padding:"8px 18px",background:"#f0f0f0",border:"1px solid #c2571c66",borderRadius:5,
                      color:"#c2571c",fontSize:12,cursor:"pointer",
                      opacity:nsCorrectionRunning||Object.keys(allResults).length===0?0.4:1}}>
                    {nsCorrectionRunning?"⏳ Applying…":"⚡ Apply N-S Corrections"}
                  </button>
                  {nsCorrection?.snapshot&&(
                    <button
                      onClick={()=>{setAllResults(nsCorrection.snapshot);setNsCorrection(null);}}
                      style={{padding:"8px 14px",background:"#f0f0f0",border:"1px solid #1f66ad44",borderRadius:5,
                        color:"#1f66ad",fontSize:12,cursor:"pointer"}}>
                      ↩ Revert
                    </button>
                  )}
                  {nsCorrection&&(
                    <div style={{fontSize:10,color:"#4d4d4f"}}>
                      <span style={{color:"#ad1f2b"}}>{nsCorrection.correctedCount} pairs corrected</span>
                      {nsCorrection.residual.length>0&&(
                        <span style={{color:"#c2571c"}}> · {nsCorrection.residual.length} residual</span>
                      )}
                    </div>
                  )}
                </div>
                {nsCorrection&&nsCorrection.residual.length>0&&(
                  <div style={{marginTop:12}}>
                    <div style={{fontSize:10,color:"#e12a3f",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>
                      ⚠ Residual Violations ({nsCorrection.residual.length}) — could not fully resolve
                    </div>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,}}>
                      <thead><tr style={{borderBottom:"1px solid #bcbec0"}}>
                        {["S Tracker","N Tracker","Remaining Δ (ft)","Reason"].map(h=>(
                          <th key={h} style={{padding:"4px 8px",textAlign:"right",fontSize:9,color:"#4d4d4f",fontWeight:500}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {nsCorrection.residual.map((f,i)=>(
                          <tr key={i} style={{borderBottom:"1px solid #eceded",background:i%2===0?"transparent":"#ffffff"}}>
                            <td style={{padding:"4px 8px",textAlign:"right",color:"#e12a3f"}}>{f.southern}</td>
                            <td style={{padding:"4px 8px",textAlign:"right",color:"#e12a3f"}}>{f.northern}</td>
                            <td style={{padding:"4px 8px",textAlign:"right",color:"#e12a3f",fontWeight:700}}>{f.delta.toFixed(3)}</td>
                            <td style={{padding:"4px 8px",textAlign:"right",color:"#4d4d4f",fontSize:9}}>{f.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* E-W Correction */}
                <div style={{display:"flex",alignItems:"center",gap:12,marginTop:12,paddingTop:12,borderTop:"1px solid #4d4d4f"}}>
                  <button
                    onClick={()=>{
                      if(Object.keys(allResults).length===0)return;
                      setEwCorrectionRunning(true);
                      setTimeout(()=>{
                        const snapshot={...allResults};
                        const{updated,residual,correctedCount,chains}=applyEWCorrections(
                          allResults,trackerIDs,trackerMap,constraints,ewAnchors);
                        setAllResults(updated);
                        setEwCorrection({correctedCount,residual,chains,snapshot});
                        setEwCorrectionRunning(false);
                      },20);
                    }}
                    disabled={ewCorrectionRunning||Object.keys(allResults).length===0}
                    style={{padding:"8px 18px",background:"#f0f0f0",border:"1px solid #7b4bb588",borderRadius:5,
                      color:"#7b4bb5",fontSize:12,cursor:"pointer",
                      opacity:ewCorrectionRunning||Object.keys(allResults).length===0?0.4:1}}>
                    {ewCorrectionRunning?"⏳ Applying…":"⚡ Apply E-W Corrections"}
                  </button>
                  {ewCorrection?.snapshot&&(
                    <button onClick={()=>{setAllResults(ewCorrection.snapshot);setEwCorrection(null);}}
                      style={{padding:"8px 14px",background:"#f0f0f0",border:"1px solid #1f66ad44",borderRadius:5,
                        color:"#1f66ad",fontSize:12,cursor:"pointer"}}>
                      ↩ Revert E-W
                    </button>
                  )}
                  {ewCorrection&&(
                    <div style={{fontSize:10,color:"#4d4d4f"}}>
                      <span style={{color:"#7b4bb5"}}>{ewCorrection.correctedCount} pile pairs · {ewCorrection.chains} chains</span>
                      {ewCorrection.residual.length>0&&<span style={{color:"#c2571c"}}> · {ewCorrection.residual.length} residual</span>}
                    </div>
                  )}
                </div>
                {ewCorrection&&ewCorrection.residual.length>0&&(
                  <div style={{marginTop:10}}>
                    <div style={{fontSize:10,color:"#e12a3f",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>
                      ⚠ Residual E-W Violations ({ewCorrection.residual.length})
                    </div>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,}}>
                      <thead><tr style={{borderBottom:"1px solid #4d4d4f"}}>
                        {["Tracker A","Pile","Tracker B","Pile","Slope %","ΔE (ft)"].map(h=>(
                          <th key={h} style={{padding:"4px 8px",textAlign:"right",fontSize:9,color:"#4d4d4f",fontWeight:500}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {ewCorrection.residual.map((f,i)=>(
                          <tr key={i} style={{borderBottom:"1px solid #eeeeee",background:i%2===0?"transparent":"#f9f9f9"}}>
                            <td style={{padding:"4px 8px",textAlign:"right",color:"#7b4bb5",fontWeight:600}}>{f.tidA}</td>
                            <td style={{padding:"4px 8px",textAlign:"right",color:"#4d4d4f"}}>{f.ai!=null?f.ai+1:'—'}</td>
                            <td style={{padding:"4px 8px",textAlign:"right",color:"#7b4bb5",fontWeight:600}}>{f.tidB}</td>
                            <td style={{padding:"4px 8px",textAlign:"right",color:"#4d4d4f"}}>{f.bi!=null?f.bi+1:'—'}</td>
                            <td style={{padding:"4px 8px",textAlign:"right",color:"#c2571c",fontWeight:700}}>{(f.slope*100).toFixed(2)}%</td>
                            <td style={{padding:"4px 8px",textAlign:"right",color:"#4d4d4f"}}>{f.ewD!=null?f.ewD.toFixed(1):'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{marginTop:8,fontSize:9,color:"#4d4d4f",display:"flex",gap:16,flexWrap:"wrap"}}>
                  <span>Click tracker name to view profile</span>
                  <span style={{display:"flex",alignItems:"center",gap:4}}>
                    <span style={{width:12,height:12,borderRadius:2,background:"#278747",display:"inline-block"}}/>
                    <span>Anchor (NS clean)</span>
                  </span>
                  <span style={{display:"flex",alignItems:"center",gap:4}}>
                    <span style={{width:12,height:12,borderRadius:2,background:"#8a6300",display:"inline-block"}}/>
                    <span>Anchor (has NS flags)</span>
                  </span>
                  <span style={{display:"flex",alignItems:"center",gap:4}}>
                    <span style={{width:12,height:12,borderRadius:2,border:"2px solid #278747",display:"inline-block"}}/>
                    <span>NS clean (click to set anchor)</span>
                  </span>
                </div>
              </div>
            )}

            {activeTab==="input"&&(
              <div style={{maxWidth:720}}>

                {/* ── Data Source ─────────────────────────────────────────── */}
                <div style={{background:"#f5f5f5",border:"1px solid #bcbec0",borderRadius:8,padding:"18px 20px",marginBottom:16}}>
                  <div style={{fontSize:10,color:"#4d4d4f",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:12}}>
                    📂 Data Source
                  </div>
                  <div style={{fontSize:11,color:"#4d4d4f",marginBottom:10,lineHeight:1.6}}>
                    Upload an Excel (.xlsx) or CSV file containing pile location data with per-pile allowable reveals. Required columns:
                    <span style={{color:"#ad1f2b"}}> TrackerID, Northing, Easting, ExistingGround, MinReveal, MaxReveal</span>. MinReveal / MaxReveal are the allowable reveal bounds for each pile measured from the EG surface — the optimizer treats [EG + MinReveal, EG + MaxReveal] as a hard box per pile. If the two columns are absent, the global slider values apply to every pile.
                    Column names are case-insensitive. For Excel files with multiple sheets, the first sheet
                    containing the required columns will be used.
                  </div>
                  <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                    <button onClick={()=>fileRef.current.click()}
                      style={{padding:"10px 20px",background:"#f0f0f0",border:"1px solid #27874744",
                        borderRadius:6,color:"#ad1f2b",cursor:"pointer",fontSize:13,fontWeight:700,letterSpacing:"0.05em"}}>
                      {fileLoading?"⏳ Loading…":"↑ Upload .xlsx or .csv"}
                    </button>
                    <div style={{fontSize:11,color:"#4d4d4f"}}>
                      {rawData.length>0
                        ?`✓ Loaded: ${rawData.length.toLocaleString()} piles across ${trackerIDs.length.toLocaleString()} trackers`
                        :"No file loaded — using embedded sample data"}
                    </div>
                  </div>
                  {fileError&&<div style={{marginTop:10,fontSize:11,color:"#e12a3f",background:"#fff0f0",borderRadius:4,padding:"6px 10px"}}>{fileError}</div>}

                  {rawData.length>0&&(
                    <div style={{marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                      {[
                        ["Total Piles",rawData.length.toLocaleString()],
                        ["Trackers",trackerIDs.length.toLocaleString()],
                        ["Avg Piles/Tracker",(rawData.length/Math.max(trackerIDs.length,1)).toFixed(1)],
                        ["Northing Range",rawData.length>0?`${arrMinBy(rawData,r=>r.Northing).toFixed(1)} – ${arrMaxBy(rawData,r=>r.Northing).toFixed(1)}`:"—"],
                        ["Easting Range",rawData.length>0?`${arrMinBy(rawData,r=>r.Easting).toFixed(1)} – ${arrMaxBy(rawData,r=>r.Easting).toFixed(1)}`:"—"],
                        ["Elev Range",rawData.length>0?`${arrMinBy(rawData,r=>r.ExistingGround).toFixed(2)} – ${arrMaxBy(rawData,r=>r.ExistingGround).toFixed(2)} ft`:"—"],
                      ].map(([l,v])=>(
                        <div key={l} style={{background:"#f5f5f5",borderRadius:4,padding:"8px 10px"}}>
                          <div style={{fontSize:9,color:"#4d4d4f",letterSpacing:"0.08em"}}>{l}</div>
                          <div style={{fontSize:12,color:"#333132",fontWeight:600,marginTop:2}}>{v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Design Parameters ───────────────────────────────────── */}
                <div style={{background:"#f5f5f5",border:"1px solid #bcbec0",borderRadius:8,padding:"18px 20px",marginBottom:16}}>
                  <div style={{fontSize:10,color:"#4d4d4f",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:14}}>
                    ⚙ Design Parameters
                  </div>

                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
                    {/* Pile Reveal */}
                    <div>
                      <div style={{fontSize:10,color:"#1f66ad",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>Pile Reveal</div>
                      {[
                        {key:"targetReveal",label:"Target Reveal",unit:"ft",min:1,max:10,step:0.1,color:"#ad1f2b",
                         desc:"Desired reveal for terrain-following solution. The tube is set at this height above existing ground at each pile before smoothing."},
                        {key:"minReveal",label:"Min Reveal",unit:"ft",min:0.5,max:8,step:0.1,color:"#1f66ad",
                         desc:"Absolute minimum pile reveal. Piles below this require fill or a higher tube position."},
                        {key:"maxReveal",label:"Max Reveal",unit:"ft",min:2,max:12,step:0.1,color:"#8a6300",
                         desc:"Absolute maximum pile reveal. Piles above this require cut or a lower tube position."},
                      ].map(({key,label,unit,min,max,step,color,desc,isPct=false})=>(
                        <div key={key} style={{marginBottom:14}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:3}}>
                            <label style={{fontSize:11,color:"#333132"}}>{label}</label>
                            <div style={{display:"flex",alignItems:"center",gap:4}}>
                              <input type="number" min={min} max={max} step={step}
                                value={isPct?(constraints[key]*100).toFixed(step<0.1?2:1):constraints[key]}
                                onChange={e=>setC(key,isPct?parseFloat(e.target.value)/100:parseFloat(e.target.value))}
                                style={{width:72,background:"#f5f5f5",border:`1px solid ${color}44`,borderRadius:3,
                                  color,padding:"4px 8px",fontSize:13,textAlign:"right"}}/>
                              <span style={{fontSize:10,color:"#4d4d4f",width:20}}>{unit}</span>
                            </div>
                          </div>
                          <input type="range" min={min} max={max} step={step}
                            value={isPct?(constraints[key]*100).toFixed(step<0.1?2:1):constraints[key]}
                            onChange={e=>setC(key,isPct?parseFloat(e.target.value)/100:parseFloat(e.target.value))}
                            style={{width:"100%",accentColor:color,marginBottom:3}}/>
                          <div style={{fontSize:9,color:"#4d4d4f",lineHeight:1.5}}>{desc}</div>
                        </div>
                      ))}
                    </div>

                    {/* Tube Geometry */}
                    <div>
                      <div style={{fontSize:10,color:"#8a6300",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>Tube Geometry</div>
                      {[
                        {key:"maxSlope",label:"Max Tube Slope",unit:"%",min:0.1,max:20,step:0.1,color:"#ad1f2b",isPct:true,
                         desc:"Maximum % slope the N–S torque tube can run between any two consecutive pile spans. Applies to both solution types."},
                        {key:"maxSlopeDelta",label:"Max Slope Delta",unit:"%",min:0.1,max:10,step:0.01,color:"#8a6300",isPct:true,
                         desc:"Maximum change in % slope between consecutive spans — governs the angular rotation at each interior pile's flex joint. Typically the most constraining geometry check on undulating terrain."},
                      ].map(({key,label,unit,min,max,step,color,desc,isPct=false})=>(
                        <div key={key} style={{marginBottom:14}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:3}}>
                            <label style={{fontSize:11,color:"#333132"}}>{label}</label>
                            <div style={{display:"flex",alignItems:"center",gap:4}}>
                              <input type="number" min={min} max={max} step={step}
                                value={isPct?(constraints[key]*100).toFixed(step<0.1?2:1):constraints[key]}
                                onChange={e=>setC(key,isPct?parseFloat(e.target.value)/100:parseFloat(e.target.value))}
                                style={{width:72,background:"#f5f5f5",border:`1px solid ${color}44`,borderRadius:3,
                                  color,padding:"4px 8px",fontSize:13,textAlign:"right"}}/>
                              {unit&&<span style={{fontSize:10,color:"#4d4d4f",width:20}}>{unit}</span>}
                            </div>
                          </div>
                          <input type="range" min={min} max={max} step={step}
                            value={isPct?(constraints[key]*100).toFixed(step<0.1?2:1):constraints[key]}
                            onChange={e=>setC(key,isPct?parseFloat(e.target.value)/100:parseFloat(e.target.value))}
                            style={{width:"100%",accentColor:color,marginBottom:3}}/>
                          <div style={{fontSize:9,color:"#4d4d4f",lineHeight:1.5}}>{desc}</div>
                        </div>
                      ))}

                      {/* Parameter summary card */}
                      <div style={{background:"#f5f5f5",border:"1px solid #bcbec0",borderRadius:6,padding:"10px 12px",marginTop:8}}>
                        <div style={{fontSize:9,color:"#4d4d4f",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Current Parameters</div>
                        {[
                          ["Target Reveal",`${constraints.targetReveal} ft`,"#ad1f2b"],
                          ["Min / Max Reveal",`${constraints.minReveal} / ${constraints.maxReveal} ft`,"#333132"],
                          ["Max Slope",`${(constraints.maxSlope*100).toFixed(1)}%`,"#ad1f2b"],
                          ["Max Slope Δ",`${(constraints.maxSlopeDelta*100).toFixed(2)}%`,"#8a6300"],
                        ].map(([l,v,col])=>(
                          <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                            <span style={{fontSize:10,color:"#4d4d4f"}}>{l}</span>
                            <span style={{fontSize:11,color:col,fontWeight:700}}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Adjacency Parameters ──────────────────────────────── */}
                <div style={{background:"#f5f5f5",border:"1px solid #bcbec0",borderRadius:8,padding:"18px 20px",marginBottom:16}}>
                  <div style={{fontSize:10,color:"#4d4d4f",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:14}}>
                    🔗 Adjacency Check Parameters
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
                    {[
                      {key:"maxNSDelta",label:"N-S End Δ Limit",unit:"ft",min:0.1,max:5,step:0.1,color:"#c2571c",isPct:false,
                       desc:"Max TOP elevation difference between the north end of one tracker and the south end of the adjacent tracker to its north."},
                      {key:"maxNSSlope",label:"N-S End Slope (slope mode)",unit:"%",min:1,max:100,step:0.5,color:"#c2571c",isPct:true,
                       desc:"Used when N-S End Limit Mode is %: the end-to-end TOP limit equals this slope times the actual N-S gap, so wider gaps allow proportionally more delta. Toggle the mode in the left panel."},
                      {key:"maxEWSlope",label:"E-W End Slope",unit:"%",min:1,max:20,step:0.5,color:"#7b4bb5",isPct:true,
                       desc:"Max TOP elevation slope (%) between the same-end piles of E-W adjacent trackers, based on actual easting spacing."},
                      {key:"maxEWSpacing",label:"E-W Spacing Limit",unit:"ft",min:5,max:100,step:1,color:"#7b4bb5",isPct:false,
                       desc:"Maximum easting distance (ft) between piles to be considered E-W adjacent. Pairs beyond this are not checked."},
                      {key:"maxEWNSGap",label:"E-W N-S Gap Limit",unit:"ft",min:1,max:100,step:1,color:"#7b4bb5",isPct:false,
                       desc:"Maximum northing distance between a pile and its closest pile in the adjacent row for the E-W check to apply. Filters out short rows where no truly adjacent pile exists."},
                      {key:"maxNSGap",label:"N-S Gap Limit",unit:"ft",min:1,max:100,step:1,color:"#1f66ad",isPct:false,
                       desc:"Maximum northing gap between tracker ends to still be considered N-S adjacent. Pairs beyond this distance are ignored."},
                    ].map(({key,label,unit,min,max,step,color,desc,isPct=false})=>(
                      <div key={key} style={{marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:3}}>
                          <label style={{fontSize:11,color:"#333132"}}>{label}</label>
                          <div style={{display:"flex",alignItems:"center",gap:4}}>
                            <input type="number" min={min} max={max} step={step}
                              value={isPct?(constraints[key]*100).toFixed(step<0.1?2:1):constraints[key]}
                              onChange={e=>setC(key,isPct?parseFloat(e.target.value)/100:parseFloat(e.target.value))}
                              style={{width:72,background:"#f5f5f5",border:`1px solid ${color}44`,borderRadius:3,
                                color,padding:"4px 8px",fontSize:13,textAlign:"right"}}/>
                            <span style={{fontSize:10,color:"#4d4d4f",width:20}}>{unit}</span>
                          </div>
                        </div>
                        <input type="range" min={min} max={max} step={step}
                          value={isPct?(constraints[key]*100).toFixed(step<0.1?2:1):constraints[key]}
                          onChange={e=>setC(key,isPct?parseFloat(e.target.value)/100:parseFloat(e.target.value))}
                          style={{width:"100%",accentColor:color,marginBottom:3}}/>
                        <div style={{fontSize:9,color:"#4d4d4f",lineHeight:1.5}}>{desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Grading Preference ─────────────────────────────────── */}
                <div style={{background:"#f5f5f5",border:"1px solid #bcbec0",borderRadius:8,padding:"18px 20px",marginBottom:16}}>
                  <div style={{fontSize:10,color:"#4d4d4f",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:12}}>
                    ⚙ Grading Preference
                  </div>
                  <div style={{display:"flex",alignItems:"flex-start",gap:16}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,color:"#333132",marginBottom:6}}>Prefer Cut on High Ground</div>
                      <div style={{fontSize:10,color:"#4d4d4f",lineHeight:1.6}}>
                        When enabled, Step 3 rotates the tube to eliminate cut at the lowest-elevation end pile,
                        avoiding drainage bowls at low points. Default is off — standard minimum earthwork balance.
                      </div>
                    </div>
                    <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:4,paddingTop:2}}>
                      <div onClick={()=>setC("preferCutHigh",!constraints.preferCutHigh)}
                        style={{width:44,height:24,borderRadius:12,
                          background:constraints.preferCutHigh?"#ad1f2b":"#4d4d4f",
                          cursor:"pointer",position:"relative",transition:"background 0.2s"}}>
                        <div style={{width:18,height:18,borderRadius:9,background:"#ffffff",position:"absolute",
                          top:3,left:constraints.preferCutHigh?23:3,transition:"left 0.2s"}}/>
                      </div>
                      <div style={{fontSize:9,color:constraints.preferCutHigh?"#ad1f2b":"#4d4d4f"}}>
                        {constraints.preferCutHigh?"ON":"OFF"}
                      </div>
                    </div>
                  </div>
                </div>
                {/* ── Export ──────────────────────────────────────────────── */}
                <div style={{background:"#f5f5f5",border:"1px solid #bcbec0",borderRadius:8,padding:"18px 20px"}}>
                  <div style={{fontSize:10,color:"#4d4d4f",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:12}}>
                    ↓ Export Results
                  </div>
                  <div style={{fontSize:11,color:"#4d4d4f",marginBottom:14,lineHeight:1.7}}>
                    Exports a formatted Excel workbook with two sheets:
                    <span style={{color:"#ad1f2b"}}> Optimization Results</span> — all piles with TrackerID, coordinates,
                    existing ground, top of pile, reveal, solution type, final finished grade, ground adjustment,
                    and (for terrain-following trackers) tube slope and slope delta between every consecutive pile span.
                    <span style={{color:"#ad1f2b"}}> Design Parameters</span> — a snapshot of the constraints and fleet summary used for this run.
                  </div>

                  {/* Fleet readiness */}
                  <FleetReadiness allResults={allResults} trackerIDs={trackerIDs} progress={progress}/>

                  <button onClick={exportXLSX}
                    disabled={progress.running||trackerIDs.length===0||Object.keys(allResults).length===0}
                    style={{
                      padding:"12px 28px",fontSize:14,fontWeight:700,letterSpacing:"0.05em",
                      background:progress.running||trackerIDs.length===0?"#f0f0f0":"#fff5f5",
                      border:"1px solid #278747",borderRadius:6,
                      color:progress.running||trackerIDs.length===0?"#4d4d4f":"#ad1f2b",
                      cursor:progress.running||trackerIDs.length===0?"not-allowed":"pointer",
                    }}>
                    ↓ Download TrackerOptimization_Results.xlsx
                  </button>
                  <div style={{marginTop:8,fontSize:9,color:"#4d4d4f"}}>
                    Columns: Tracker ID · Northing · Easting · Existing Ground · Top of Pile · Pile Reveal ·
                    Solution Type · Final FG · Ground Adj · Cut/Fill · Tube Slope · Slope Delta
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{borderTop:"1px solid #e2e3e5",padding:"5px 24px",fontSize:9,color:"#4d4d4f",display:"flex",justifyContent:"space-between",background:"#ffffff"}}>
        <span>Step 1: Straight Line (no grade) → Step 2: Terrain Follow (balanced cut/fill)</span>
        <span>Input: .xlsx or .csv → TrackerID, Northing, Easting, ExistingGround, MinReveal, MaxReveal (per-pile allowable reveals from EG) · Export: .xlsx with Results + Parameters sheets</span>
      </div>
    </div>
  );
}
