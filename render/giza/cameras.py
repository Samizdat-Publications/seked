"""
Cameras. A shot is framed: a position, a target and a lens. A station is a
360-degree equirectangular panorama, level, with its centre on true north and azimuth
increasing to the right, which is how apps/walk reads it.
"""
import math

import bpy
from mathutils import Vector


def make(scene):
    cam_data = bpy.data.cameras.new("camera")
    cam_data.sensor_width = 36
    cam_data.clip_start = 0.1
    cam_data.clip_end = 60000
    cam = bpy.data.objects.new("camera", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    return cam


def frame(cam, location, target, lens):
    cam.data.type = "PERSP"
    cam.data.lens = lens
    cam.location = location
    cam.rotation_euler = (Vector(target) - Vector(location)).to_track_quat("-Z", "Y").to_euler()


def station(cam, location):
    cam.data.type = "PANO"
    cam.data.panorama_type = "EQUIRECTANGULAR"
    cam.location = location
    cam.rotation_euler = (math.radians(90.0), 0.0, 0.0)
