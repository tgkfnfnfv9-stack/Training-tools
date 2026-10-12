# compact investigation (inv-compact)
- 3 frames: master on table(workFrame saddle seat), dial on head(toolFrame). XY owner master (table moves, P point 0.50 m), XZ/YZ owner body (head moves -Z 300mm). Zero: XY front-right, XZ top-right, YZ top-back. Out-of-range shows "—".
- 触れ = spindle rotation r=0.15, front zero. Common rigid tilt: frames & sweep unchanged, column lean display changes (gravity ref) - physically correct.
- gain=5: posture change, not drawing. Rotates head frame & Z by 4δ about X (δ=support-only YZ pitch at centre datum). Affects YZ + sweep. Example seed 20261012 centre, A -0.150→-0.050: YZ phys +19.02→+18.78 (+19→+19) vs display +22.29→+21.09 (+22→+21). Off-centre (X50,Y-60,Z40): phys +1.35 vs display +0.39.
- Displays only B (auto realign+rezero). C==B for XY,XZ; YZ off-centre B14.96 vs C13.46.
- A: 条件不足 (master size/position/contact height/arm undefined). Under assumption H (contact=P, rigid): start shift XY+8.4, XZ+11.7, YZ+0.4.
- Spindle axis == Z guide == column lean (same intrinsic vector); no separate spindle-axis error.
- Test bar not implemented for compact.
- Save: no measured values saved; removing gain needs no model id migration; test check-coupled-yz-sweep-independent.cjs depends on gain.
# compact verifier (ver-compact) seed 12345 new
- Unscaled B matches product unscaled within 0.001 µm all cases. XY/XZ display = physical. YZ & sweep display differ up to 3.4 µm, fully explained by gain (reproduced within 0.001).
- Table: init XY -31.477/-31, XZ +21.929/+22, YZ phys -15.177 display -14 (-13.645). P1-0.2: XY B -38.155 A -54.9; XZ B +35.991 A +12.6; YZ B -14.696 A -15.5 display -11 (-11.248).
- Sweep P1-0.2 B +10.6/-14.7/-25.3/0 vs display +12/-11/-24/0.
- A computed with rigid arm assumption (verifier says determinable under rigid assumption) differs up to ~23 µm from B.
- Indistinguishable: spindle axis = Z feed; R-L of sweep == XZ scan, B-F == YZ scan within 0.01.
# lathe investigation (inv-lathe) seed used 123456, XZ 16.959
- Flange XZ: ref=spindle (headstock frame), dial=turret (carriage), turret -X 300; B; contact at representative origin -> A 条件不足. Card computed but hidden by lathe UI override (lathe-inspection-ui.js:74,78). Detail shows local angle at 500 mm +28.27 (different length & sign from -17).
- Turret accuracy X face / Z flat: dial "主軸台側に固定" but actually world-fixed point (Z flat dial 1.44 m behind spindle centre, no mount path). B.
- Bore: rotating indicator at spindle centre vs virtual holder on turret; C (rezero at a).
- Testbar side/top: bar on spindle (not rotated), dial on turret bracket at carriage material point [0.08,1.5,0.20], bar φ50 cantilever 2.2 m (scaled with width) -> a at 0.455-1.555 m from nose, different from runout panel a/b (root/300mm). Same letters confusing. Product-assumed fixture.
- B matches independent within 0.0022 µm. Out of range shows "—".
- Support 3 +0.1 at X0 Z0: X face -3.758 same, Z flat 7.827 same, bar side -16.959->-16.960, bar top -0.006->-7.506 (0->-8), bore dx +124->+168. A: bar side a -43.75 b -60.71; X face a +21.0; Z flat a +43.7. C≈B.
- Problems: (1) level vial fixed at x=0 (bed centre), cannot measure transverse slope at each longitudinal position; support3 +0.1 -> headstock-end transverse slope 0.0595 mm/m but shows 0.000. Twist defined Δ/width -0.025 vs transverse diff Δ/depth 0.0595. (2) one intrinsic XZ used for both spindle direction (bar side) and flange XZ; X-Z cross-slide squareness always 0. (3) flange card hidden; (4) no A.
- Runout = intrinsic, invariant. Top-surface accuracy hidden for lathe (style.css:744).
# horizontal verifier (ver-horizontal) report.md exists there
- B matches product all 160 cases (<=2.8e-3 µm), integers match DOM. Extensions 9.87-10.14 mm valid.
- A computable (fixtures defined); A vs B large: centre4 +0.05 YZ: A -130 C -75 B -79; E -0.10 b: A +156 C +30 B +30; E -0.10 XY: A +41 C +31 B +6.
- XY +26 vs intrinsic -1.3 due to back-cell twist pitching column along X (~23 µm/300).
- Text says X uses two rails but finite scan X path uses column seat point only (rails not used in scan).
- Z parallel a≈-XZ, b≈-YZ when flat: spindle axis = head frame z; no independent spindle error.
# portal investigation (inv-portal) seed 20261012 new
- Layout per spec: master on table, dial on head/ram; S scans move dial only (owner body). Values match own model to 3.5e-12.
- Representative fixed posture harmless for S scans (Y/Z don't relocate support seat).
- Out-of-range "—", sweep "面外"; but squareness checks only start & end samples (:161) for non-varying scans.
- travel support1 -0.150→-0.050: XZ ext 10.012084→10.013299, raw -12.084→-13.299, -12→-13; YZ +18 unchanged (Y,Z on same column frame); sweep -19/+13/+32/0 → -17/+16/+33/0.
- gate support10: XY -1→+62, XZ -25→+2, YZ +47→+20 (beam yaw from column lean diff).
- gantry supports 1,2,7,8 affect nothing (outside central bilinear cell); support3 XY 0→+16.
- PROBLEM 1: R alignment uses tangent at current X instead of actually feeding X 300 mm (horizontal does real feed). Chord-vs-tangent: travel X30-75 10.6-32 µm/300 (XZ); gate X0→43 9.2 (after support5 26.9). Posture change during X feed moves tip (arm length estimated): travel XY/XZ 3.5-17.8, gantry XY 0.8-8.5, gate XY 1.4-4.1.
- PROBLEM 2: finite scan == local angle×300 (same magnitude; XY same sign, XZ/YZ opposite). Note "局所角度換算とは別" not substantive here.
- PROBLEM 3: sweep spindle axis == Z feed vector; gate/gantry table top tilt == X feed direction so sweep 奥 == XZ.
- Conditions: squareness B; sweep C-like (front rezero).
- A 条件不足 (S point abstract world origin :147; master position/arm undefined). Increment-only differences up to ~39: travel s1 YZ B+18 Ainc+22; travel s2 XZ B-11 Ainc-24; gate s5 YZ B+47 Ainc+8; gate s10 YZ B+20 Ainc+26.
# horizontal investigation (inv-horizontal) seed 20261012 used & 7 new
- Layout per spec; B only (autoZero), matches own calc ≤0.0006.
- Example left-front +0.1, X=Y=Z=0: XY B +22→+22, A start +5 (ext 9.99525) end +29, C +24; YZ B -89→-73, A +27/-49, C -77; Zpar b B +67→+42, A +26/+67, C +42. (A/C under own "install at initial heights" assumption; inv says A undefined → 条件不足, verifier says computable under product's defined fixtures.)
- Fixture assumption: spindle centre 2.55 m, pallet top 1.27 m; ~1.25 m arm/bracket implied; B depends on fixture placement: XY +26..+18 over master z -0.3..+0.3; XZ -8→-5 for +0.2 m height.
- X defined twice: local-angle/ref search uses rail average (accuracy-ui L155-162); finite scan & 3D points use column seat path (X correction 0). Text "Xは二本の走行レール" (L487) mismatches. XY: local -4.7, seat-path converted -5.3, finite +22.
- b contacts underside of bar (pushes upward) – screen states it; not "上面".
- Column lean == spindle axis tilt; pallet top tilt == Z guide (minus intrinsic).
- Horizontal has no "spindle dial on table" measurement (sweep replaced by Z parallel).
- Evaluation (reference search/targets) uses local angles; main display uses finite B; Z parallel not in evaluation.
# common investigation (inv-common)
- Bubble/twist/lean signs OK all 6 (independent). Rigid plane: squareness/scan/sweep invariant; lean moves by plane rotation.
- Intrinsic squareness: dot=-sinθ, + = opens (obtuse). Local angle sign vs scan push sign opposite for XZ/YZ/lathe XZ (XZ local +13.94, scan -13.94).
- Scan == start-point local angle×0.3 except compact Y & horizontal Z (ref-ui:139).
- Hidden 4th value: evaluation length L 0.5 m in hidden card. accuracy-card hidden (index.html:35); local level hidden (index.html:70).
- Initial/current: B; sweep C (front rezero); A absent. travel A vs B: right-back +0.1 B XZ 0 / A +3.8; left-back +0.1 B 1.2 / A 12.0 (A absolute 条件不足).
- Problems: spindle=Z guide=column lean same vector; horizontal body front-back lean lacks intrinsic YZ (only XY); gain5 posture change (rear-left +0.1: YZ 18.445→19.403 exactly 5x support change) while evaluation/reference/local use physical → mismatch between displayed numbers and fine-tuning trend; gate twist extrapolated TPS at bounding-rect corners (bed right-back +0.2 → bed-only 0.130 vs product 0.067; columns only gives 0.015); lathe "right" = +z (back) ambiguous viewpoint; guide straightness drawn but not used in calc except fine status; eval length 500 vs 300 mixed; average bubble saturates at ±0.107 mm/m with no out-of-range indication, initial ~0.14 so pinned; gate/gantry finePanel says 前後倒れ but value is spindle representative direction; calc model id lacks intrinsic/scan/gain version; lathe tool=headstock work=carriage naming.
- OK: reference adjust, save/load roundtrip, out-of-range "—".
# lathe verifier (ver-lathe) 18 cases, 3 seeds
- B matches product <7e-10 µm; DOM 6/6.
- Example seed 20261012 op2 (B+0.1,D-0.2,F+0.3) X0Z0 after B: Z -40, X -2, bore 0/+134/+274/+141, centre diff +137/+3, side +40, top +33, runout 3/7.
- Table: turretX B -1.53(-2) A -5.99/-7.52 C -1.53; turretZ B -9.59→-39.59 A -51.74/-91.33; flange XZ +1.335 hidden, A 条件不足; detail -2.23 (0.5 m local); bore A +52/186/326/193; bar side +10.10→+40.09 A +51.75/+91.84; bar top +25.80→+33.27 A +1.94/+35.13 C +33.18; runout invariant.
- Physical issues: carriage posture from single seat (x, z=0.15) tangent plane, though drawn carriage on 2 rails z=±0.4, length 0.8: 4-pad average changes Z flat -9.6→+11.3, bar side +10.1→-10.8, bore dx 189→167 (sign flips); pitch jumps when seat crosses x=0.
- Turret X scan line (r 0→0.30) interferes with drawn hub disc (35 mm protrusion > 20 mm stroke) and tool pockets; product says infinite-plane approx.
- Test bar 2.2 m (product assumption): scan at 1.155-1.455 m; 300 mm bar unreachable over full Z (0.455-1.855) → 条件不足; self-weight sag tip 7.0 mm, interval diff 1.0-1.3 mm (ignored); spindle angular position unspecified → bar tilt 1.3-8.6 µm undetermined.
- Flange XZ 300 mm card hidden; DOM shows 0.5 m angle only.
# portal verifier (ver-portal) seed 20261012 new; report.md in ver-portal/
- Product = B1 (R aligned to local base-axis direction at current position, start zero). Matches B1 ≤1e-4 (travel,gantry), ≤0.021 (gate XY/XZ). Sweep travel/gantry matches.
- Mismatch vs B2 (R aligned by actually feeding X 300 mm, posture varies; varies=false in referenceScan): travel XY +4.75/+10.96, XZ -8.91/-20.55 (int XY -1 vs -6/-12; XZ -12 vs -3, -10 vs +11); gate XY +4.36/-7.59, XZ +1.35/-2.34; gantry XY -0.32/-6.20, XZ -0.10/-1.92.
- gate YZ & sweep L/R: product +47/+86 vs rigid-beam model +18/+18; product reproduced exactly by its stated assumption (ram follows mean column up, not orthogonalized to beam). Model assumption, needs connection spec.
- C: travel XY -6.09 XZ +5.68 YZ +4.85; gate -98.47/-77.18/+13.93; gantry +31.09/-13.84/+14.81. A squareness 条件不足 (arm/master position undefined); gate YZ start jump -389 µm from 2.51 m column lean. Sweep A uniform offset: travel +24.09, gate +82.52, gantry -1.69.
- Sweep: measures relative tilt spindle axis vs table normal (2 comps); 奥=右+左 with front zero; cannot separate column lean vs table tilt, spindle vs Z guide, intrinsic vs support.
- Extensions 9.94-10.39 mm.
# RE-VERIFY after fix (rever-portal, commit e464c7f)
- B reproduced: travel ≤9e-10, gate ≤0.0021, gantry ≤0.0017 µm; sweep ≤1e-6. 240 normal + 90 rigid tilt + 108 extreme + 96 non-default config. 0 integer/—/面外 mismatches.
- Alignment interval with clamp matches (travel X=100: 700→1000 mm).
- YZ invariant under supports (≤1e-11) for all three; rigid tilt invariant.
- A/C table (seed 20261012): travel centre-back +0.1 XY B -5.83→-2.895 C -5.83 A +17.34; XZ B -1.46→-9.618 C -17.26 A +5.91; gate left-col-front +0.1 XY -4.21→+58.024 A +16.14, YZ A +404.87 (beam lateral move); gantry XY +0.64→+18.645 C/A +15.86. A depends on assumed S contact (travel ≤20, gate YZ 58 µm per +300 mm).
- Notes: gate XY very sensitive to column supports (two column points -0.2/+0.15 → XY -222) – consequence of rigid beam on 2.51 m columns; travel table centre on cell boundary x=0 → left supports don't affect table posture; gantry end rows 0,1,6,7 never affect anything; outside UI range (|h|≥13 mm) representation diff.
