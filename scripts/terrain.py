"""
Cut the Copernicus GLO-30 DEM around the Giza origin into a local heightfield.

The tiles live in data/terrain as downloaded (they are gitignored); the two
small files this writes are committed:

    data/terrain/giza-glo30.json   header: frame, grid, source, SHA-256
    data/terrain/giza-glo30.f32    little-endian float32, row-major,
                                   rows south to north, columns west to east

Run it with the system Python (numpy and Pillow), not Blender's:

    python scripts/terrain.py

What it does. The georeferencing is read from each GeoTIFF's own tags, never
assumed: ModelTiepointTag and ModelPixelScaleTag give the grid, and the
GeoKeyDirectory's GTRasterType says whether an integer raster coordinate is a
pixel centre (PixelIsPoint) or a pixel corner (PixelIsArea). A window of
`--radius` metres in every direction from the origin is resampled by bilinear
interpolation onto a regular local grid of `--spacing` metres in east-north
metres. Degrees become metres through the WGS84 meridional and prime-vertical
radii of curvature at the origin latitude, taken from the measurement database
(earth.radius.equatorial and earth.radius.polar, source wgs84) and checked
against the ellipsoid the GeoTIFF itself declares. Over 3 km that local tangent
plane is accurate to centimetres.

Heights are left exactly as the DEM gives them: Copernicus DEM heights are
orthometric on EGM2008, not ellipsoidal.

The 3 km window crosses latitude 30 N, the edge of the N29 tile, so the tile to
the north is needed as well. The reader mosaics every tile it finds in the
directory onto one arc-second grid and refuses to write a window it cannot fill.

Note for the plan. GLO-30 is a surface model, so the monuments are in it and
the sample at the origin does not stand on the ground under Khufu. It does not
stand on Khufu either: the product's editing mask, AUXFILES/*_EDM.tif in the
same bucket, marks the pyramid footprints with value 2, and the Great Pyramid
comes through as a smooth mound peaking near 94 m rather than an apex near
200 m. So near a monument this grid is neither bedrock nor the built surface.
The ground beneath each pyramid has to come from the surveyed base elevations
and the GPMP contours, and the monuments themselves from the measurement
database, in a later step.

The georeferencing was checked against the water body mask of the same tile:
at 29.95 N it puts the Nile between 31.2519 and 31.2608 E at a flat 14.0 m,
which is where the river is.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA_DIR = os.path.join(ROOT, "data")
TERRAIN_DIR = os.path.join(DATA_DIR, "terrain")
SOURCE_ID = "copernicus-glo30"

sys.path.insert(0, os.path.join(ROOT, "blender"))
import seked_data  # noqa: E402  the project's stdlib reader, so no number is typed twice

# GeoTIFF tags and geokeys this script understands.
TAG_MODEL_PIXEL_SCALE = 33550
TAG_MODEL_TIEPOINT = 33922
TAG_MODEL_TRANSFORMATION = 34264
TAG_GEO_KEY_DIRECTORY = 34735
TAG_GEO_DOUBLE_PARAMS = 34736
TAG_GEO_ASCII_PARAMS = 34737
TAG_GDAL_NODATA = 42113
KEY_RASTER_TYPE = 1025          # 1 = PixelIsArea, 2 = PixelIsPoint
KEY_GEOGRAPHIC_TYPE = 2048
KEY_SEMI_MAJOR_AXIS = 2057
KEY_INV_FLATTENING = 2059


def geo_keys(tags):
    """The GeoKeyDirectory as {key id: value}, resolving double and ASCII references."""
    directory = tags.get(TAG_GEO_KEY_DIRECTORY)
    if not directory:
        return {}
    doubles = tags.get(TAG_GEO_DOUBLE_PARAMS, ())
    ascii_params = tags.get(TAG_GEO_ASCII_PARAMS, "")
    out = {}
    count = directory[3]
    for i in range(count):
        key, location, length, offset = directory[4 + 4 * i: 8 + 4 * i]
        if location == 0:
            out[key] = offset
        elif location == TAG_GEO_DOUBLE_PARAMS:
            out[key] = doubles[offset] if length == 1 else tuple(doubles[offset:offset + length])
        elif location == TAG_GEO_ASCII_PARAMS:
            out[key] = ascii_params[offset:offset + length].rstrip("|\x00")
    return out


class Tile:
    """One GeoTIFF on a geographic grid, with its samples and where they sit."""

    def __init__(self, path):
        from PIL import Image

        self.path = path
        self.name = os.path.basename(path)
        image = Image.open(path)
        tags = image.tag_v2
        if TAG_MODEL_TRANSFORMATION in tags and TAG_MODEL_TIEPOINT not in tags:
            raise ValueError(f"{self.name}: ModelTransformationTag is not supported; expected a tiepoint and a pixel scale")
        tie = tags.get(TAG_MODEL_TIEPOINT)
        scale = tags.get(TAG_MODEL_PIXEL_SCALE)
        if tie is None or scale is None:
            raise ValueError(f"{self.name}: no ModelTiepointTag or ModelPixelScaleTag, so the grid is unknown")
        self.keys = geo_keys(tags)
        self.raster_type = int(self.keys.get(KEY_RASTER_TYPE, 1))
        if self.raster_type not in (1, 2):
            raise ValueError(f"{self.name}: unknown GTRasterType {self.raster_type}")
        nodata = tags.get(TAG_GDAL_NODATA)
        self.nodata = float(nodata) if nodata not in (None, "") else None
        self.tiepoint = tuple(float(v) for v in tie[:6])
        self.pixel_scale = (float(scale[0]), float(scale[1]))
        self.width, self.height = image.size
        self.raster_type_name = "pixel-is-point" if self.raster_type == 2 else "pixel-is-area"

        # An integer raster coordinate is a pixel centre under pixel-is-point and a
        # pixel corner under pixel-is-area, so the centre of pixel (col, row) sits at
        # raster (col + half, row + half).
        half = 0.0 if self.raster_type == 2 else 0.5
        i, j, _k, x, y, _z = self.tiepoint
        self.lon_step, self.lat_step = self.pixel_scale
        self.lon0 = x + (half - i) * self.lon_step      # centre of column 0
        self.lat0 = y - (half - j) * self.lat_step      # centre of row 0, rows run north to south

        self.samples = np.asarray(image, dtype=np.float64)
        if self.samples.shape != (self.height, self.width):
            raise ValueError(f"{self.name}: expected {self.height} by {self.width} samples, got {self.samples.shape}")
        if self.nodata is not None:
            self.samples = np.where(self.samples == self.nodata, np.nan, self.samples)

    def describe(self):
        return (
            f"{self.name}: {self.width} x {self.height}, tiepoint {self.tiepoint}, "
            f"pixel scale {self.pixel_scale}, {self.raster_type_name}, nodata {self.nodata}, "
            f"centre of pixel (0, 0) at lon {self.lon0:.6f} lat {self.lat0:.6f}"
        )


def load_tiles(directory):
    names = sorted(n for n in os.listdir(directory) if n.lower().endswith("_dem.tif"))
    if not names:
        raise SystemExit(
            f"no *_DEM.tif in {directory}. Download the Copernicus GLO-30 tiles, for example\n"
            "  https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N29_00_E031_00_DEM/"
            "Copernicus_DSM_COG_10_N29_00_E031_00_DEM.tif"
        )
    return [Tile(os.path.join(directory, n)) for n in names]


class Mosaic:
    """Several tiles of one arc-second grid, indexed by whole grid steps from lon 0, lat 0."""

    def __init__(self, tiles, lon_min, lon_max, lat_min, lat_max, margin=2):
        first = tiles[0]
        self.lon_step, self.lat_step = first.lon_step, first.lat_step
        for tile in tiles:
            if abs(tile.lon_step - self.lon_step) > 1e-12 or abs(tile.lat_step - self.lat_step) > 1e-12:
                raise ValueError(f"{tile.name}: pixel scale {tile.pixel_scale} differs from {first.name}")
        self.col_min = int(math.floor(lon_min / self.lon_step)) - margin
        self.col_max = int(math.ceil(lon_max / self.lon_step)) + margin
        self.row_min = int(math.floor(lat_min / self.lat_step)) - margin
        self.row_max = int(math.ceil(lat_max / self.lat_step)) + margin
        self.grid = np.full((self.row_max - self.row_min + 1, self.col_max - self.col_min + 1), np.nan)
        self.used = []
        for tile in tiles:
            if self._insert(tile):
                self.used.append(tile.name)
        missing = int(np.count_nonzero(np.isnan(self.grid)))
        if missing:
            raise SystemExit(
                f"{missing} of {self.grid.size} samples in the window have no data. "
                "Download the neighbouring GLO-30 tiles into data/terrain and run again."
            )

    def _insert(self, tile):
        """Copy the part of one tile that falls inside the window. True if anything was used."""
        col0 = tile.lon0 / self.lon_step
        row0 = tile.lat0 / self.lat_step
        if abs(col0 - round(col0)) > 1e-6 or abs(row0 - round(row0)) > 1e-6:
            raise ValueError(f"{tile.name}: grid is offset from whole steps of the pixel scale, so tiles cannot be mosaicked")
        col0, row0 = int(round(col0)), int(round(row0))
        # Tile rows run north to south; flip so both index spaces increase with latitude.
        lo_col, hi_col = max(self.col_min, col0), min(self.col_max, col0 + tile.width - 1)
        lo_row, hi_row = max(self.row_min, row0 - tile.height + 1), min(self.row_max, row0)
        if lo_col > hi_col or lo_row > hi_row:
            return False
        block = tile.samples[row0 - hi_row: row0 - lo_row + 1, lo_col - col0: hi_col - col0 + 1][::-1]
        self.grid[lo_row - self.row_min: hi_row - self.row_min + 1, lo_col - self.col_min: hi_col - self.col_min + 1] = block
        return True

    def sample(self, lon, lat):
        """Bilinear interpolation at arrays of longitudes and latitudes, in degrees."""
        fx = np.asarray(lon, dtype=np.float64) / self.lon_step - self.col_min
        fy = np.asarray(lat, dtype=np.float64) / self.lat_step - self.row_min
        if fx.min() < 0 or fy.min() < 0 or fx.max() > self.grid.shape[1] - 1 or fy.max() > self.grid.shape[0] - 1:
            raise ValueError("a sample falls outside the mosaic")
        x0 = np.floor(fx).astype(np.int64)
        y0 = np.floor(fy).astype(np.int64)
        x0 = np.clip(x0, 0, self.grid.shape[1] - 2)
        y0 = np.clip(y0, 0, self.grid.shape[0] - 2)
        tx = fx - x0
        ty = fy - y0
        g = self.grid
        top = g[y0 + 1, x0] * (1 - tx) + g[y0 + 1, x0 + 1] * tx
        bottom = g[y0, x0] * (1 - tx) + g[y0, x0 + 1] * tx
        return bottom * (1 - ty) + top * ty


def curvature_radii(a, b, latitude_deg):
    """WGS84 meridional (M) and prime-vertical (N) radii of curvature at a latitude."""
    e2 = 1.0 - (b / a) ** 2
    s = math.sin(math.radians(latitude_deg))
    w = 1.0 - e2 * s * s
    return a * (1.0 - e2) / w ** 1.5, a / math.sqrt(w)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Cut the Copernicus GLO-30 DEM into the project's local frame.")
    parser.add_argument("--site", default="giza")
    parser.add_argument("--radius", type=float, default=3000.0, help="half-width of the window in metres")
    parser.add_argument("--spacing", type=float, default=20.0, help="grid spacing in metres")
    parser.add_argument("--preset", default="canonical", help="measurement preset for the ellipsoid and the pyramid offsets")
    parser.add_argument("--tiles", default=TERRAIN_DIR, help="directory of Copernicus *_DEM.tif tiles")
    parser.add_argument("--out", default=TERRAIN_DIR, help="directory for the header and the binary")
    parser.add_argument("--name", default="giza-glo30", help="base name of the two output files")
    args = parser.parse_args(argv)

    steps = args.radius * 2 / args.spacing
    if abs(steps - round(steps)) > 1e-9:
        raise SystemExit(f"a window of {args.radius} m does not divide into steps of {args.spacing} m")
    n = int(round(steps)) + 1

    sites = json.load(open(os.path.join(DATA_DIR, "sites.json"), encoding="utf-8"))
    site = next((s for s in sites if s["id"] == args.site), None)
    if site is None:
        raise SystemExit(f'unknown site "{args.site}"')
    lat0, lon0 = site["origin"]["latitude"], site["origin"]["longitude"]

    values = seked_data.resolve(seked_data.load_database(), args.preset)["values"]
    a = values["earth.radius.equatorial"]
    b = values["earth.radius.polar"]
    for key, value in (("g1.center.latitude", lat0), ("g1.center.longitude", lon0)):
        if key in values and abs(values[key] - value) > 1e-6:
            print(f"note: {key} is {values[key]} but sites.json says {value}; regenerate after deciding which is right", file=sys.stderr)

    tiles = load_tiles(args.tiles)
    for tile in tiles:
        print(tile.describe())
        declared_a = tile.keys.get(KEY_SEMI_MAJOR_AXIS)
        declared_if = tile.keys.get(KEY_INV_FLATTENING)
        if declared_a and abs(declared_a - a) > 1e-3:
            print(f"note: {tile.name} declares a = {declared_a} m, the database says {a} m", file=sys.stderr)
        if declared_if and abs(declared_if - 1.0 / (1.0 - b / a)) > 1e-3:
            print(f"note: {tile.name} declares 1/f = {declared_if}, the database gives {1.0 / (1.0 - b / a)}", file=sys.stderr)

    meridional, prime_vertical = curvature_radii(a, b, lat0)
    metres_per_deg_lat = meridional * math.pi / 180.0
    metres_per_deg_lon = prime_vertical * math.cos(math.radians(lat0)) * math.pi / 180.0

    x = np.linspace(-args.radius, args.radius, n)          # east, metres
    y = np.linspace(-args.radius, args.radius, n)          # north, metres
    lon = lon0 + x / metres_per_deg_lon
    lat = lat0 + y / metres_per_deg_lat
    lon_grid, lat_grid = np.meshgrid(lon, lat)             # row 0 is the southern edge

    mosaic = Mosaic(tiles, lon.min(), lon.max(), lat.min(), lat.max())
    heights = mosaic.sample(lon_grid, lat_grid)
    if not np.isfinite(heights).all():
        raise SystemExit("the resampled window contains values that are not finite")

    binary_name = f"{args.name}.f32"
    payload = np.ascontiguousarray(heights, dtype="<f4").tobytes()   # little-endian float32, row-major
    digest = hashlib.sha256(payload).hexdigest()

    header = {
        "site": site["id"],
        "origin": {"latitude": lat0, "longitude": lon0},
        "frame": "East-north-up at the Great Pyramid's base centre; +X east, +Y north, +Z up, metres.",
        "horizontalDatum": site["datum"],
        "verticalDatum": "EGM2008",
        "heights": binary_name,
        "dtype": "float32",
        "byteOrder": "little-endian",
        "layout": "row-major",
        "rowOrder": "south-to-north",
        "columnOrder": "west-to-east",
        "spacing": args.spacing,
        "nx": n,
        "ny": n,
        "x0": float(x[0]),
        "y0": float(y[0]),
        "resampling": "bilinear",
        "projection": (
            "Local tangent plane at the origin: east = (longitude - origin) * cos(origin latitude) * N * pi / 180, "
            "north = (latitude - origin) * M * pi / 180, with M the meridional and N the prime-vertical WGS84 radius "
            "of curvature at the origin latitude (a and b from earth.radius.equatorial and earth.radius.polar)."
        ),
        "source": SOURCE_ID,
        "tiles": [tile.name for tile in tiles if tile.name in mosaic.used],
        "script": "scripts/terrain.py",
        "sha256": digest,
        "note": (
            "Heights are orthometric on EGM2008, as Copernicus delivers them. GLO-30 is a surface model, so the "
            "monuments are in it, but their footprints are edited: the product's editing mask (AUXFILES/*_EDM.tif) "
            "marks them with value 2 and the Great Pyramid comes through as a smooth mound peaking near 94 m rather "
            "than an apex near 200 m. The sample at the origin is therefore neither the ground under Khufu nor the "
            "built surface of Khufu. The ground beneath each pyramid must come from the surveyed base elevations and "
            "the GPMP contours, and the monuments themselves from the measurement database, in a later step."
        ),
    }

    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, binary_name), "wb") as f:
        f.write(payload)
    with open(os.path.join(args.out, f"{args.name}.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(header, f, indent=2, ensure_ascii=False)
        f.write("\n")

    def at(east, north):
        return float(mosaic.sample(
            np.array([lon0 + east / metres_per_deg_lon]),
            np.array([lat0 + north / metres_per_deg_lat]),
        )[0])

    print(f"window: {lon.min():.6f} to {lon.max():.6f} E, {lat.min():.6f} to {lat.max():.6f} N")
    print(f"grid: {n} x {n} at {args.spacing} m, x and y from {x[0]:.0f} to {x[-1]:.0f} m, {len(payload)} bytes, sha256 {digest}")
    print(f"metres per degree: {metres_per_deg_lat:.3f} north, {metres_per_deg_lon:.3f} east")
    print(f"heights: min {heights.min():.2f} m, max {heights.max():.2f} m, mean {heights.mean():.2f} m")
    print(f"at the origin (g1 centre): {at(0.0, 0.0):.2f} m")
    for structure in ("g2", "g3"):
        east = -values.get(f"{structure}.centre.offset.west", 0.0)
        north = -values.get(f"{structure}.centre.offset.south", 0.0)
        print(f"at the {structure} centre ({east:.2f} E, {north:.2f} N): {at(east, north):.2f} m")
    print(f"2 km north-east of the origin: {at(2000 / math.sqrt(2), 2000 / math.sqrt(2)):.2f} m")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
