"""
Point clouds that Geometry Nodes turns into instances. Each point carries `rot`
(Euler XYZ), `scl` (metres), `var` (which variant) and the shading attributes `tone`
and `wear`; Instance on Points carries every point attribute onto its instance, where
the materials read them with an Attribute node in Instancer mode.
"""
import bpy
import numpy as np

_GROUP = None


def points_object(name, pos, attrs, coll):
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(pos))
    me.vertices.foreach_set("co", np.asarray(pos, np.float32).ravel())
    for aname, (atype, arr) in attrs.items():
        a = me.attributes.new(aname, atype, "POINT")
        key = "vector" if atype == "FLOAT_VECTOR" else "value"
        a.data.foreach_set(key, np.asarray(arr, np.int32 if atype == "INT" else np.float32).ravel())
    me.update()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def group():
    global _GROUP
    if _GROUP is not None and _GROUP.name in bpy.data.node_groups:
        return _GROUP
    ng = bpy.data.node_groups.new("instance by attributes", "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Collection", in_out="INPUT", socket_type="NodeSocketCollection")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    n, L = ng.nodes, ng.links
    gi, go = n.new("NodeGroupInput"), n.new("NodeGroupOutput")
    ci = n.new("GeometryNodeCollectionInfo")
    ci.transform_space = "ORIGINAL"
    ci.inputs["Separate Children"].default_value = True
    ci.inputs["Reset Children"].default_value = True
    iop = n.new("GeometryNodeInstanceOnPoints")
    iop.inputs["Pick Instance"].default_value = True
    named = {}
    for nm, dt in (("var", "INT"), ("rot", "FLOAT_VECTOR"), ("scl", "FLOAT_VECTOR")):
        a = n.new("GeometryNodeInputNamedAttribute")
        a.data_type = dt
        a.inputs["Name"].default_value = nm
        named[nm] = a
    e2r = n.new("FunctionNodeEulerToRotation")
    L.new(gi.outputs["Collection"], ci.inputs["Collection"])
    L.new(gi.outputs["Geometry"], iop.inputs["Points"])
    L.new(ci.outputs[0], iop.inputs["Instance"])
    L.new(named["var"].outputs["Attribute"], iop.inputs["Instance Index"])
    L.new(named["rot"].outputs["Attribute"], e2r.inputs[0])
    L.new(e2r.outputs[0], iop.inputs["Rotation"])
    L.new(named["scl"].outputs["Attribute"], iop.inputs["Scale"])
    L.new(iop.outputs["Instances"], go.inputs["Geometry"])
    _GROUP = ng
    return ng


def field(name, variants, pos, rot, scl, var, tone, wear, coll, log=print):
    ob = points_object(name, pos, {"rot": ("FLOAT_VECTOR", rot), "scl": ("FLOAT_VECTOR", scl), "var": ("INT", var),
                                   "tone": ("FLOAT", tone), "wear": ("FLOAT", wear)}, coll)
    mod = ob.modifiers.new("instances", "NODES")
    ng = group()
    mod.node_group = ng
    for item in ng.interface.items_tree:
        if getattr(item, "in_out", "") == "INPUT" and item.name == "Collection":
            mod[item.identifier] = variants
    log(f"{name}: {len(pos):,} instances of {len(variants.objects)} variants")
    return ob


class Field:
    """Accumulates instances, then emits one point cloud."""

    def __init__(self):
        self.pos, self.rot, self.scl, self.var, self.tone, self.wear = [], [], [], [], [], []

    def add(self, p, r, s, v, tone, wear):
        self.pos.append(p)
        self.rot.append(r)
        self.scl.append(s)
        self.var.append(v)
        self.tone.append(tone)
        self.wear.append(wear)

    def __len__(self):
        return len(self.pos)

    def emit(self, name, variants, coll, log=print):
        if not self.pos:
            return None
        return field(name, variants, np.array(self.pos), np.array(self.rot), np.array(self.scl), np.array(self.var),
                     np.array(self.tone), np.array(self.wear), coll, log)
