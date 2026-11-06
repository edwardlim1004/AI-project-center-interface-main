import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const data=JSON.parse(read('data/snapshot.json'));
const app=read('assets/app.js'),html=read('index.html');
test('separate repository; original untouched',()=>{
 assert.equal(data.sourceRepository,'edwardlim1004/realestate_AI_anysis_20260927');
 assert.match(read('README.md'),/AI-project-center-interface-main/);
 assert.match(html,/<main id="main">/);
 assert.match(app,/fetch\(url,\{signal:controller\.signal/);
 assert.doesNotMatch(app,/fetch\([^\n]*method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/);
});
test('all ten modules have codes, distinct IDs and allowed path string',()=>{
 assert.equal(data.modules.length,10);
 assert.deepEqual(data.modules.map(m=>m.code),['01','02','03','04','05','06','07','08','09','10']);
 assert.equal(new Set(data.modules.map(m=>m.id)).size,10);
 for(const m of data.modules){assert.ok(m.paths.length>=1);assert.ok(m.owner);assert.ok(m.description);for(const p of m.paths)assert.doesNotMatch(p,/^\/|\.\./);}
});
test('research restrictions and failure indicators',()=>{
 assert.equal(data.modules.find(m=>m.id==='valuation').status,'failure');
 assert.equal(data.modules.find(m=>m.id==='liquidity').status,'validation');
 assert.equal(data.modules.find(m=>m.id==='gsadf').status,'research');
 assert.equal(data.modules.find(m=>m.id==='har').status,'research');
 assert.equal(data.models.find(m=>m.id==='valuation').status,'failure');
});
test('scope counts are transparent and not silently normalized',()=>{
 const c=data.collection;
 assert.equal(c.totalCompletedScopes,35344);
 assert.equal(c.totalCompletedScopes-(c.seoul+c.gyeonggi+c.daejeon),1310);
 assert.equal(c.reportedBackendScopes.r2+c.reportedBackendScopes.gdrive,c.totalCompletedScopes);
});
test('all module evidence references trace to source or actual theory',()=>{
 const refIds=new Set(data.references.map(r=>r.id));
 for(const m of data.modules){for(const id of m.papers)assert.ok(refIds.has(id));}
 for(const m of data.models)assert.ok(!m.evidence.startsWith('/'));
 for(const r of data.references)assert.match(r.url,/^https:\/\//);
});
test('deployment files exist; no external runtime packages',()=>{
 for(const file of ['index.html','assets/styles.css','assets/app.js','data/snapshot.json','.github/workflows/pages.yml','.nojekyll'])assert.ok(fs.existsSync(path.join(root,file)),file);
 assert.ok(!fs.existsSync(path.join(root,'package.json')));
});