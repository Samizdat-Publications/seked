"""Diagnose the foot of the king's bust on a carved Sphinx era (night list, item 8b).

Prints, row by row up to the bust's foot, the lion faces in front of it under the chin: how far forward they
lie, which way they face, and how tightly the texture is packed on them against the lion's median. Run
inside Blender:

    blender -b --factory-startup -P render/bust_foot.py -- build/models/sphinx-master-built/model.glb

On the carve committed at 08:40 UTC on 20 October the top row faces down (nz -0.46) and its texture is packed
36 times over: the grey plate under the chin."""
import bpy, bmesh, sys
import numpy as np
path = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)
o = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
bm = bmesh.new(); bm.from_mesh(o.data); bm.transform(o.matrix_world)
uv = bm.loops.layers.uv.active
def uva(f):
    p = [l[uv].uv for l in f.loops]
    return abs(sum(p[i].x * p[i - 1].y - p[i - 1].x * p[i].y for i in range(len(p)))) / 2
king = [f for f in bm.faces if f.material_index == 1]
kc = np.array([f.calc_center_median()[:] for f in king[::20]])
xc = np.median(kc[:, 0]); kfoot = kc[:, 2].min()
print("king x centre", round(xc, 4), "foot z", round(kfoot, 4), "front y", round(kc[:, 1].min(), 4))
lion = [f for f in bm.faces if f.material_index == 0]
dens_all = np.median([uva(f) / f.calc_area() for f in lion[::50] if f.calc_area() > 0])
print("lion median uv density", dens_all)
rows = []
for f in lion:
    c = f.calc_center_median()
    if abs(c.x - xc) < 0.04 and -0.96 < c.y < -0.78 and kfoot - 0.04 < c.z < kfoot + 0.03:
        a = f.calc_area()
        if a > 0: rows.append((c.x, c.y, c.z, f.normal.y, f.normal.z, uva(f) / a / dens_all, a))
r = np.array(rows)
print("faces", len(r))
# bin by z and y
for zlo in np.arange(kfoot - 0.04, kfoot + 0.03, 0.01):
    s = r[(r[:, 2] >= zlo) & (r[:, 2] < zlo + 0.01)]
    if len(s):
        print(f" z {zlo:.3f}: n={len(s)} y {s[:,1].min():.3f}..{s[:,1].max():.3f} nz med {np.median(s[:,4]):+.2f} ny med {np.median(s[:,3]):+.2f} uvdens med {np.median(s[:,5]):.2f} p10 {np.percentile(s[:,5],10):.2f} p90 {np.percentile(s[:,5],90):.2f}")
