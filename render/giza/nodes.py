"""A small builder for Blender shader node trees, and colour helpers."""


def lin(c):
    """An sRGB triple in 0..1 to linear RGBA, which is what Blender's colour sockets take."""
    f = lambda u: u / 12.92 if u <= 0.04045 else ((u + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1.0)


def hexlin(h):
    h = h.lstrip("#")
    return lin(tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)))


class Tree:
    """Wraps a material's or world's node tree with short constructors."""

    def __init__(self, owner):
        if getattr(owner, "node_tree", None) is None:
            owner.use_nodes = True
        self.t = owner.node_tree
        self.t.nodes.clear()
        self.n = self.t.nodes
        self.x = 0

    def node(self, kind, **props):
        nd = self.n.new(kind)
        nd.location = (self.x, 0)
        self.x += 200
        for k, v in props.items():
            setattr(nd, k, v)
        return nd

    def link(self, a, b):
        self.t.links.new(a, b)

    def _feed(self, sock, v):
        if isinstance(v, (int, float, tuple)):
            sock.default_value = v
        else:
            self.link(v, sock)

    def math(self, op, a, b=None, clamp=False):
        m = self.node("ShaderNodeMath", operation=op, use_clamp=clamp)
        for i, v in enumerate((a, b)):
            if v is not None:
                self._feed(m.inputs[i], v)
        return m.outputs[0]

    def mix(self, fac, c1, c2, blend="MIX"):
        m = self.node("ShaderNodeMixRGB", blend_type=blend)
        self._feed(m.inputs["Fac"], fac)
        self._feed(m.inputs["Color1"], c1)
        self._feed(m.inputs["Color2"], c2)
        return m.outputs["Color"]

    def grey(self, value):
        """A float socket as a grey colour."""
        c = self.node("ShaderNodeCombineXYZ")
        for i in range(3):
            self.link(value, c.inputs[i])
        return c.outputs[0]

    def attr(self, name, out="Fac"):
        """An attribute of the instance being shaded (or the object's custom property)."""
        a = self.node("ShaderNodeAttribute", attribute_type="INSTANCER", attribute_name=name)
        return a.outputs[out]

    def ramp(self, fac, stops, interp="LINEAR"):
        r = self.node("ShaderNodeValToRGB")
        r.color_ramp.interpolation = interp
        els = r.color_ramp.elements
        while len(els) > 1:
            els.remove(els[-1])
        els[0].position, els[0].color = stops[0]
        for pos, col in stops[1:]:
            e = els.new(pos)
            e.color = col
        self.link(fac, r.inputs["Fac"])
        return r.outputs["Color"]

    def band(self, value, lo, hi):
        mr = self.node("ShaderNodeMapRange", clamp=True)
        mr.inputs["From Min"].default_value = lo
        mr.inputs["From Max"].default_value = hi
        self.link(value, mr.inputs["Value"])
        return mr.outputs["Result"]

    def noise(self, vector, scale, detail=4.0, rough=0.55):
        nz = self.node("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = scale
        nz.inputs["Detail"].default_value = detail
        nz.inputs["Roughness"].default_value = rough
        self.link(vector, nz.inputs["Vector"])
        return nz.outputs["Fac"]
