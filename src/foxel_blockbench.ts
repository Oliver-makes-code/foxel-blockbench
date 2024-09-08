/// <reference types="blockbench-types" />

const version: string = "0.1.0";

const deletables: Deletable[] = [];

function degToRad(degrees: number): number {
  return degrees * (Math.PI/180);
}

function eulerToQuaternion(euler: [number, number, number]): [number, number, number, number] {
    const [roll, pitch, yaw] = euler.map(degToRad).map(it => -it);

    // Calculate trigonometric values
    const cy = Math.cos(yaw * 0.5);
    const sy = Math.sin(yaw * 0.5);
    const cp = Math.cos(pitch * 0.5);
    const sp = Math.sin(pitch * 0.5);
    const cr = Math.cos(roll * 0.5);
    const sr = Math.sin(roll * 0.5);

    // Calculate quaternion components
    const w = cr * cp * cy + sr * sp * sy;
    const x = sr * cp * cy - cr * sp * sy;
    const y = cr * sp * cy + sr * cp * sy;
    const z = cr * cp * sy - sr * sp * cy;

    return [x, y, z, w];
}

function scaleDownVec3(vec: [number, number, number]): [number, number, number] {
    return [vec[0] / 16, vec[1] / 16, vec[2] / 16];
}

function scaleDownUv(uv: [number, number, number, number], textureUuid?: string): [number, number, number, number] {
    if (textureUuid) {
        const texture = Texture.all.filter(it => it.uuid == textureUuid)[0];
        const width = texture.uv_width;
        const height = texture.uv_height;
        return [uv[0] / width, uv[1] / height, uv[2] / width, uv[3] / height];
    }

    return [uv[0] / 16, uv[1] / 16, uv[2] / 16, uv[3] / 16];
}

function cullFace(face: CubeFaceDirection | ""): SideConfig["culling_side"] {
    return face == "" ? "none" : face;
}

function size(from: [number, number, number], to: [number, number, number]): [number, number, number] {
    return [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
}

function getTextureName(textureUuid?: string|false): string {
    if (!textureUuid)
        return "all";
    return Texture.all.filter(it => it.uuid == textureUuid)[0].name;
}

type ModelRoot = {
    textures: {[k in string]: string},
    model: ModelPart
};

type SideConfig = {
    texture: string,
    culling_side: "north"|"south"|"east"|"west"|"up"|"down"|"none",
    uv: [number, number, number, number]
};

type ModelPart = {
    type: "list"|"cube"|"reference",
    name: string
    position: [number, number, number],
    size: [number, number, number],
    pivot: [number, number, number],
    rotation: [number, number, number, number]
} & (
    {
        type: "list",
        parts: ModelPart[]
    } | {
        type: "cube",
        sides: {
            north: SideConfig,
            south: SideConfig,
            east: SideConfig,
            west: SideConfig,
            up: SideConfig,
            down: SideConfig,
        }
    } | {
        type: "reference",
        model: string
    }
)

//@ts-ignore
const groupNeedsUniqueName = Group.prototype.needsUniqueName, cubeNeedsUniqueName = Cube.prototype.needsUniqueName;

function pluginLoad() {
    Language.addTranslations("en", {
        "action.foxel_export": "Foxel Engine Model"
    });

    const format = new ModelFormat({
        name: "Foxel Engine Model",
        id: "foxel",
        icon: "bar_chart",
        animated_textures: false,
        show_on_start_screen: true,
        box_uv: false,
        optional_box_uv: true,
        single_texture: false,
        per_texture_uv_size: true,
        meshes: false,
        rotate_cubes: true,
        stretch_cubes: false,
        centered_grid: false,
        locators: true,
        java_face_properties: true,
        model_identifier: true,
        legacy_editable_file_name: true,
        texture_folder: true
    }); 
    deletables.push(format);

    const codec = new Codec("foxel_model", {
        name: "Foxel Model",
        extension: "json",
        remember: false,
        compile() {
            function createPart(node: OutlinerNode): ModelPart {
                if (node instanceof Cube) {
                    return {
                        type: "cube",
                        name: node.name,
                        position: scaleDownVec3(node.from),
                        size: scaleDownVec3(size(node.from, node.to)),
                        pivot: scaleDownVec3(node.origin),
                        rotation: eulerToQuaternion(node.rotation),
                        sides: {
                            north: {
                                culling_side: cullFace(node.faces.north.cullface),
                                texture: getTextureName(node.faces.north.texture),
                                uv: scaleDownUv(node.faces.north.uv, node.faces.north.texture || undefined)
                            },
                            south: {
                                culling_side: cullFace(node.faces.south.cullface),
                                texture: getTextureName(node.faces.south.texture),
                                uv: scaleDownUv(node.faces.south.uv, node.faces.south.texture || undefined)
                            },
                            east: {
                                culling_side: cullFace(node.faces.east.cullface),
                                texture: getTextureName(node.faces.east.texture),
                                uv: scaleDownUv(node.faces.east.uv, node.faces.east.texture || undefined)
                            },
                            west: {
                                culling_side: cullFace(node.faces.west.cullface),
                                texture: getTextureName(node.faces.west.texture),
                                uv: scaleDownUv(node.faces.west.uv, node.faces.west.texture || undefined)
                            },
                            up: {
                                culling_side: cullFace(node.faces.up.cullface),
                                texture: getTextureName(node.faces.up.texture),
                                uv: scaleDownUv(node.faces.up.uv, node.faces.up.texture || undefined)
                            },
                            down: {
                                culling_side: cullFace(node.faces.down.cullface),
                                texture: getTextureName(node.faces.down.texture),
                                uv: scaleDownUv(node.faces.down.uv, node.faces.down.texture || undefined)
                            }
                        }
                    }
                }
                if (node instanceof Group) {
                    return {
                        type: "list",
                        name: node.name,
                        position: [0, 0, 0],
                        size: [1, 1, 1],
                        pivot: scaleDownVec3(node.origin),
                        rotation: eulerToQuaternion(node.rotation),
                        parts: node.children.map(createPart)
                    }
                }
                //@ts-ignore
                return {}
            }
            const model: ModelPart = {
                type: "list",
                name: "root",
                position: [0, 0, 0],
                size: [1, 1, 1],
                pivot: [0.5, 0.5, 0.5],
                rotation: [0, 0, 0, 1],
                parts: Outliner.root.map(createPart)
            }

            const textures: {[k in string]: string} = {};

            Texture.all.forEach(it => {
                textures[it.name] = `${it.namespace}:${it.folder ? it.folder + "/" : ""}${it.name}`;
            });

            const root: ModelRoot = {
                textures,
                model
            };
            return JSON.stringify(root, null, 4);
        },
    });
    deletables.push(codec);

    const exportAction = new Action("foxel_export", {
        icon: "bar_chart",
        click() {
            codec.export();
        }
    });
    MenuBar.addAction(exportAction, "file.export.0");
    deletables.push(exportAction);

    const check = new ValidatorCheck(
        "foxel_check",
        {
            update_triggers: ["update_selection"],
            condition: {
                method: () => Format.id == format.id
            },
            run() {
                function process(nodes: OutlinerNode[]) {
                    const names = new Set<string>();
                    for (let node of nodes) {
                        while (names.has(node.name))
                            node.name = node.name + "_";
                        names.add(node.name);

                        if (node instanceof Group)
                            process(node.children);
                    }
                }
                process(Outliner.root);
            }
        }
    );
    deletables.push(check);
}

function pluginUnload() {
    deletables.forEach(it => it.delete())
}

BBPlugin.register("foxel_blockbench", {
    title: "Foxel Blockbench",
    author: "Foxel Developers",
    description: "Blockbench plugin for the Foxel engine",
    icon: "bar_chart",
    variant: "both",
    version,
    onload: pluginLoad,
    onunload: pluginUnload
});
