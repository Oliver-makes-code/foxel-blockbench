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

function scaleDownUv(uv: [number, number, number, number]): [number, number, number, number] {
    return [uv[0] / 16, uv[1] / 16, uv[2] / 16, uv[3] / 16];
}

function cullFace(face: CubeFaceDirection | ""): SideConfig["culling_side"] {
    return face == "" ? "none" : face;
}

function size(from: [number, number, number], to: [number, number, number]): [number, number, number] {
    return [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
}

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
    const format = new ModelFormat({
        name: "Foxel Model",
        id: "foxel",
        icon: "bar_chart",
        animated_textures: false,
        show_on_start_screen: true,
        box_uv: false,
        optional_box_uv: true,
        single_texture: false,
        per_texture_uv_size: true,
        meshes: false,
        confidential: true,
        rotate_cubes: true,
        stretch_cubes: false
    }); 
    deletables.push(format);

    const codec = new Codec("foxel_model", {
        name: "Foxel Model",
        extension: "json",
        remember: false,
        compile(options?: any) {
            console.log(options);
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
                                texture: node.faces.north.texture || "all",
                                uv: scaleDownUv(node.faces.north.uv)
                            },
                            south: {
                                culling_side: cullFace(node.faces.south.cullface),
                                texture: node.faces.south.texture || "all",
                                uv: scaleDownUv(node.faces.south.uv)
                            },
                            east: {
                                culling_side: cullFace(node.faces.east.cullface),
                                texture: node.faces.east.texture || "all",
                                uv: scaleDownUv(node.faces.east.uv)
                            },
                            west: {
                                culling_side: cullFace(node.faces.west.cullface),
                                texture: node.faces.west.texture || "all",
                                uv: scaleDownUv(node.faces.west.uv)
                            },
                            up: {
                                culling_side: cullFace(node.faces.up.cullface),
                                texture: node.faces.up.texture || "all",
                                uv: scaleDownUv(node.faces.up.uv)
                            },
                            down: {
                                culling_side: cullFace(node.faces.down.cullface),
                                texture: node.faces.down.texture || "all",
                                uv: scaleDownUv(node.faces.down.uv)
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
            const part: ModelPart = {
                type: "list",
                name: "root",
                position: [0, 0, 0],
                size: [1, 1, 1],
                pivot: [0.5, 0.5, 0.5],
                rotation: [0, 0, 0, 1],
                parts: Outliner.root.map(createPart)
            }
            return JSON.stringify(part, null, 4);
        },
    });
    deletables.push(codec);

    const exportAction = new Action("foxel_export", {
        icon: "bar_chart",
        click() {
            codec.export();
        }
    });
    MenuBar.addAction(exportAction);
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
