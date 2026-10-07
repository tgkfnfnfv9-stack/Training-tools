'use strict';
// Independent fixture geometry: upper column leans towards machine front.
// No production direction table, drawing, support map or sign table is used.
const assert = require('node:assert/strict');
const M = require('../src/reference-measurement.js');
let checks = 0;
const near = (actual, expected, label) => {
  assert.ok(Math.abs(actual - expected) < 1e-7, `${label}: ${actual} vs ${expected}`);
  checks++;
};
const rotate = ([x, y, z]) => {
  const a = .37, b = -.23;
  const Y = y * Math.cos(a) - z * Math.sin(a), Z = y * Math.sin(a) + z * Math.cos(a);
  return [x * Math.cos(b) + Z * Math.sin(b), Y, -x * Math.sin(b) + Z * Math.cos(b)];
};
const move = p => rotate(p).map((v, i) => v + [1.2, -.7, 2.3][i]);
const rigid = pose => ({point: move(pose.point), normal: rotate(pose.normal), body: move(pose.body), probe: rotate(pose.probe)});
for (const theta of [0, .0001, -.0001]) for (const side of [1, -1]) {
  // Coordinates: up +y, back +z. S is z=0. side=+1 contacts from back.
  // Forward lean means Z-up=(0,cos(theta),-sin(theta)). Descending L
  // therefore takes the body BACK by L*sin(theta), independently of the ray solver.
  const start = {point: [0, 0, 0], normal: [0, 0, 1], body: [0, 0, side * .01], probe: [0, 0, -side]};
  const end = {...start, body: [0, -.3 * Math.cos(theta), side * .01 + .3 * Math.sin(theta)]};
  const expected = -side * .3 * Math.sin(theta) * 1e6;
  const label = `theta=${theta}, contact side=${side}`;
  const result = M.compare(start, end);
  assert.equal(result.valid, true);
  near(result.microns, expected, label);
  near(M.compare(end, start).microns, -expected, `${label}, fixed setup reversed and re-zeroed`);
  near(M.compare(rigid(start), rigid(end)).microns, expected, `${label}, common rigid motion`);
}
console.log(`YZ independent contact-side geometry: ${checks} numerical checks passed`);
