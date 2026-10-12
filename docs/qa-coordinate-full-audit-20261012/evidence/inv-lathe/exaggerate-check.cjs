'use strict';
// Check that the display exaggeration toggle does not change any lathe reading.
const fs=require('node:fs');process.chdir('/home/user/Training-tools');
const env=require('/home/user/Training-tools/tests/leveling-dom-env.cjs')({pureLeveling:true});
env.read(fs.readFileSync('src/lathe-inspection.js','utf8'));env.read(fs.readFileSync('src/lathe-inspection-ui.js','utf8'));env.read('updateLatheInspectionUI=()=>{};');
env.read("openMachine(machines.find(m=>m.kind==='lathe'));machineProfile=window.MachineAccuracy.generate('used',123456,['X','Z'],6);supportHeights=[0,0,0,0,.1,0];positions={X:0,Y:0,Z:0,A:0,C:0};");
const read=g=>{env.read(`$('exaggerate').checked=${g};updateLeveling();`);return env.json('(()=>{const d=latheInspectionGeometry();return {face:d.face,flat:d.flat,dx:d.dx,dy:d.dy,barSide:d.barSide,barTop:d.barTop,xz:referenceScan({key:"XZ"}).microns,factor:displayFactor()}})()');};
const a=read(false),b=read(true);console.log(JSON.stringify({off:a,on:b}));
fs.writeFileSync(__dirname+'/exaggerate-check.json',JSON.stringify({off:a,on:b},null,1));
