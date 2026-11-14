"""
VELARA UE setup — project khulne ke baad EK BAAR chalao:
  Tools > Execute Python Script > ue5/Content/Python/setup_assets.py

Kya karta hai:
  1. factory/out/*.fbx (hi-detail buildings + street kit) ko /Game/Meshes me import
  2. Audio/RAW ke WAVs ko /Game/Sounds me import
  3. VelaraMain level banao (ground plane + skylight + sun + CityBuilder + PlayerStart)
  4. Sab save — phir bas PIE khel lo (ya Android package karo)

NOTE: FBX pehle repo me aa chuke hone chahiye (designer workflow unhe
factory/out me render karta hai — pull kar lena).
"""
import os
import unreal

REPO = os.path.normpath(os.path.join(unreal.SystemLibrary.get_project_directory(),
                                     "..", "factory", "out"))

MESHES = [
    "tower-glass", "midrise-concrete", "shop-low", "shop-enterable",
    "hydrant", "drain", "bench", "meter", "sign",
]

at = unreal.AssetToolsHelpers.get_asset_tools()

# ---------------------------------------------------------------- 1. meshes
imported = 0
for name in MESHES:
    src = os.path.join(REPO, name + ".fbx")
    if not os.path.exists(src):
        unreal.log_warning("[setup] FBX missing (designer render pending?): " + src)
        continue
    dst = "/Game/Meshes/" + name
    if unreal.EditorAssetLibrary.does_asset_exist(dst):
        unreal.log("[setup] already imported: " + name)
        continue
    task = unreal.AssetImportTask()
    task.filename = src
    task.destination_path = "/Game/Meshes"
    task.destination_name = name
    task.automated = True
    task.save = True
    task.replace_existing = False
    at.import_asset_tasks([task])
    imported += 1
    unreal.log("[setup] imported mesh: " + name)

# ---------------------------------------------------------------- 2. audio
audio_dir = os.path.normpath(os.path.join(unreal.SystemLibrary.get_project_directory(),
                                          "Content", "Audio", "RAW"))
a_imported = 0
if os.path.isdir(audio_dir):
    for f in sorted(os.listdir(audio_dir)):
        if not f.lower().endswith(".wav"):
            continue
        name = f[:-4]
        dst = "/Game/Sounds/" + name
        if unreal.EditorAssetLibrary.does_asset_exist(dst):
            continue
        task = unreal.AssetImportTask()
        task.filename = os.path.join(audio_dir, f)
        task.destination_path = "/Game/Sounds"
        task.destination_name = name
        task.automated = True
        task.save = True
        at.import_asset_tasks([task])
        a_imported += 1
        unreal.log("[setup] imported sound: " + name)

# ---------------------------------------------------------------- 3. level
MAP_PATH = "/Game/Maps/VelaraMain"
if not unreal.EditorAssetLibrary.does_asset_exist(MAP_PATH):
    unreal.EditorLevelLibrary.new_level(MAP_PATH)
    unreal.log("[setup] level created: " + MAP_PATH)
else:
    unreal.EditorLevelLibrary.load_level(MAP_PATH)

world = unreal.EditorLevelLibrary.get_editor_world()

# sun + sky + fog (basic AAA-ish start — look-dev ke baad upgrade)
existing = {a.get_actor_label() for a in unreal.EditorLevelLibrary.get_all_level_actors()}

if "Sun" not in existing:
    sun = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 400), unreal.Rotator(-35, 45, 0))
    sun.set_actor_label("Sun")
    sun.get_component_by_class(unreal.DirectionalLightComponent).set_intensity(8.0)

if "Sky" not in existing:
    sky = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 200), unreal.Rotator(0, 0, 0))
    sky.set_actor_label("Sky")

if "Atmosphere" not in existing:
    atmo = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector(0, 0, 0), unreal.Rotator(0, 0, 0))
    atmo.set_actor_label("Atmosphere")

# ground: 1km x 1km plane (city 380m hai — baaki horizon)
if "Ground" not in existing:
    ground = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, 0, 0), unreal.Rotator(0, 0, 0))
    ground.set_actor_label("Ground")
    gsmc = ground.get_component_by_class(unreal.StaticMeshComponent)
    gsmc.set_static_mesh(unreal.EditorAssetLibrary.load_asset("/Engine/BasicShapes/Plane"))
    gsmc.set_world_scale3d(unreal.Vector(200, 200, 1))

# city builder actor (JSON se instanced city)
if "VelaraCity" not in existing:
    city_cls = getattr(unreal, "VelaraCityBuilder", None)
    if city_cls:
        city = unreal.EditorLevelLibrary.spawn_actor_from_class(city_cls, unreal.Vector(0, 0, 0), unreal.Rotator(0, 0, 0))
        city.set_actor_label("VelaraCity")
    else:
        unreal.log_warning("[setup] VelaraCityBuilder class nahi mili — C++ module compile pehle (Build > Compile)")

# player start (plaza ke paas)
if "PlayerStart" not in existing:
    ps = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.PlayerStart, unreal.Vector(0, 200, 100), unreal.Rotator(0, 0, 0))
    ps.set_actor_label("PlayerStart")

# ---------------------------------------------------- 3b. gang thugs (v0.8.0)
# three.js src/gameplay/gang.js SPOTS ka mirror — Old Market district (NW).
# Mapping: three.js (x,z) -> UE cm (x*100, z*100), +100cm ground offset.
GANG_SPOTS = [(-140, -142), (-88, -148), (-40, -146), (-8, -138), (-150, -88), (-144, -40)]
gang_cls = getattr(unreal, "VelaraGangAgent", None)
if gang_cls:
    n_gang = 0
    for i, (gx, gz) in enumerate(GANG_SPOTS):
        label = "GangThug_%02d" % i
        if label in existing:
            continue
        thug = unreal.EditorLevelLibrary.spawn_actor_from_class(
            gang_cls, unreal.Vector(gx * 100, gz * 100, 100), unreal.Rotator(0, 0, 0))
        thug.set_actor_label(label)
        n_gang += 1
    if n_gang:
        unreal.log("[setup] gang thugs placed: %d (Old Market NW)" % n_gang)
else:
    unreal.log_warning("[setup] VelaraGangAgent class nahi mili — C++ compile pehle")

# ---------------------------------------------------- 3c. PBR materials (v0.10.0)
# Lookdev refs (Content/Refs/lookdev) ke targets: 4 master materials,
# parametric (textures Phase-2 mein Higgsfield-ref se).
import unreal

def make_master_mat(name, base_color, roughness, metallic):
    path = "/Game/Materials/" + name
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        return unreal.EditorAssetLibrary.load_asset(path)
    m = unreal.AssetToolsHelpers.get_asset_tools().create_asset(name, "/Game/Materials", unreal.Material, unreal.MaterialFactoryNew())
    # base color
    bc = unreal.MaterialExpressionConstant3Vector(material=m)
    bc.constant = unreal.LinearColor(base_color[0], base_color[1], base_color[2], 1.0)
    m.get_editor_property("expressions").append(bc)
    unreal.MaterialEditingLibrary.connect_material_property(bc, "", unreal.MaterialProperty.MP_BASE_COLOR)
    # roughness
    r = unreal.MaterialExpressionConstant(material=m)
    r.r = roughness
    m.get_editor_property("expressions").append(r)
    unreal.MaterialEditingLibrary.connect_material_property(r, "", unreal.MaterialProperty.MP_ROUGHNESS)
    # metallic
    mt = unreal.MaterialExpressionConstant(material=m)
    mt.r = metallic
    m.get_editor_property("expressions").append(mt)
    unreal.MaterialEditingLibrary.connect_material_property(mt, "", unreal.MaterialProperty.MP_METALLIC)
    unreal.MaterialEditingLibrary.recompile_material(m)
    return m

mat_tower = make_master_mat("M_Velara_GlassTower", (0.28, 0.22, 0.15), 0.12, 0.85)     # 01-tower ref
mat_concrete = make_master_mat("M_Velara_Concrete", (0.55, 0.54, 0.52), 0.88, 0.0)    # 02-midrise
mat_shop = make_master_mat("M_Velara_Shop", (0.62, 0.5, 0.42), 0.8, 0.0)              # 03-street-shop
mat_foliage = make_master_mat("M_Velara_Foliage", (0.16, 0.32, 0.14), 0.9, 0.0)       # seasons ref
unreal.log("[setup] PBR master materials ready: glass/concrete/shop/foliage")

# city builder par overrides lagao
for actor in unreal.EditorLevelLibrary.get_all_level_actors():
    if actor.get_class().get_name() == "VelaraCityBuilder":
        overrides = {
            "tower-glass": mat_tower,
            "midrise-concrete": mat_concrete,
            "shop-low": mat_shop,
            "shop-enterable": mat_shop,
        }
        actor.set_editor_property("MaterialOverrides", overrides)
        unreal.log("[setup] material overrides applied on VelaraCityBuilder")
        break

# ---------------------------------------------------------------- 4. save
unreal.EditorLevelLibrary.save_current_level()
unreal.EditorAssetLibrary.save_directory("/Game/Meshes", only_if_is_dirty=True)
unreal.EditorAssetLibrary.save_directory("/Game/Sounds", only_if_is_dirty=True)

unreal.log("[setup] DONE — meshes:%d sounds:%d — PIE chalao!" % (imported, a_imported))
