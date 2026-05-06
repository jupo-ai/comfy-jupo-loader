import { app } from "../../../../scripts/app.js";
import { mkName, applyContextMenuPatch, Path } from "../../utils.js";
import { ResourceInfo } from "../../dialog/model-info/resource-info.js";
import { ResourceExplorer } from "../../dialog/explorer/resource-explorer.js";

const PACKAGE_NAME = "Model";
const LOADER_CONFIGS = {
    [mkName(PACKAGE_NAME, "CheckpointLoader")]: {
        widgets: [
            {
                name: "ckpt_name",
                apiDir: "checkpoints",
                title: "Checkpoint",
            },
        ],
    },
    [mkName(PACKAGE_NAME, "DiffusionModelLoader")]: {
        widgets: [
            {
                name: "model_name",
                apiDir: "diffusion_models",
                title: "Diffusion Model",
            },
        ],
    },
    [mkName(PACKAGE_NAME, "VAELoader")]: {
        widgets: [
            {
                name: "vae_name",
                apiDir: "vae",
                title: "VAE",
            },
        ],
    },
    [mkName(PACKAGE_NAME, "CLIPLoader")]: {
        widgets: [
            {
                name: "clip_name",
                apiDir: "text_encoders",
                title: "CLIP",
            },
        ],
    },
    [mkName(PACKAGE_NAME, "DualCLIPLoader")]: {
        widgets: [
            {
                name: "clip_name1",
                apiDir: "text_encoders",
                title: "CLIP 1",
            },
            {
                name: "clip_name2",
                apiDir: "text_encoders",
                title: "CLIP 2",
            },
        ],
    },
    [mkName(PACKAGE_NAME, "TripleCLIPLoader")]: {
        widgets: [
            {
                name: "clip_name1",
                apiDir: "text_encoders",
                title: "CLIP 1",
            },
            {
                name: "clip_name2",
                apiDir: "text_encoders",
                title: "CLIP 2",
            },
            {
                name: "clip_name3",
                apiDir: "text_encoders",
                title: "CLIP 3",
            },
        ],
    },
    [mkName(PACKAGE_NAME, "QuadrupleCLIPLoader")]: {
        widgets: [
            {
                name: "clip_name1",
                apiDir: "text_encoders",
                title: "CLIP 1",
            },
            {
                name: "clip_name2",
                apiDir: "text_encoders",
                title: "CLIP 2",
            },
            {
                name: "clip_name3",
                apiDir: "text_encoders",
                title: "CLIP 3",
            },
            {
                name: "clip_name4",
                apiDir: "text_encoders",
                title: "CLIP 4",
            },
        ],
    },
};
const CLASS_NAMES = Object.keys(LOADER_CONFIGS);

function getComboOptions(widget) {
    const options = widget?.options?.values ?? widget?.options?.options ?? widget?.values;
    return Array.isArray(options) ? options : [];
}

function normalizeComboPath(path, widget) {
    const rawPath = String(path ?? "");
    const candidates = [
        rawPath,
        rawPath.replaceAll("/", "\\"),
        rawPath.replaceAll("\\", "/"),
    ];
    const options = getComboOptions(widget);

    return candidates.find(candidate => options.includes(candidate)) ?? candidates[1];
}

function getLoaderConfig(node) {
    return LOADER_CONFIGS[node?.comfyClass ?? node?.constructor?.comfyClass];
}

function getWidgetConfig(node, widget) {
    const config = getLoaderConfig(node);
    return config?.widgets.find(w => w.name === widget?.name);
}

async function showResourceExplorer({ node, widget, widgetConfig, e, canvas }) {
    const explorer = new ResourceExplorer(file => {
        widget.setValue(normalizeComboPath(file.path, widget), { e, node, canvas });
    }, {
        apiDir: widgetConfig.apiDir,
        title: widgetConfig.title,
    });
    const dirPath = new Path(widget.value).parent.toString();
    await explorer.show(dirPath);
}

function findVueWidgetForRow(node, nodeElement, row) {
    const rows = Array.from(nodeElement.querySelectorAll('[data-testid="node-widget"]'));
    const rowIndex = rows.indexOf(row);
    if (rowIndex < 0) return null;

    const vueWidgets = node.widgets?.filter(w => w.type && !w.options?.canvasOnly) ?? [];
    return vueWidgets[rowIndex] ?? null;
}

function getNodeByElement(nodeElement) {
    const nodeId = nodeElement?.dataset?.nodeId;
    if (nodeId == null) return null;
    return app.graph?.getNodeById?.(Number(nodeId)) ?? null;
}

function patchNodes2ClickHandler() {
    if (window.__jupoResourceLoaderNodes2ClickPatched) return;
    window.__jupoResourceLoaderNodes2ClickPatched = true;

    document.addEventListener("click", async (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;

        const nodeElement = target.closest(".lg-node[data-node-id]");
        const node = getNodeByElement(nodeElement);
        if (!node || !CLASS_NAMES.includes(node.comfyClass)) return;

        const row = target.closest('[data-testid="node-widget"]');
        if (!row || !nodeElement.contains(row)) return;

        const clickedWidget = findVueWidgetForRow(node, nodeElement, row);
        const widgetConfig = getWidgetConfig(node, clickedWidget);
        if (!widgetConfig) return;
        if (target.closest("label")) return;

        const widget = node.widgets?.find(w => w.name === clickedWidget.name);
        if (!widget) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        await showResourceExplorer({ node, widget, widgetConfig, e, canvas: app.canvas });
    }, true);
}

const extension = {
    name: mkName(PACKAGE_NAME, "ResourceLoader"),

    init: async function(app) {
        applyContextMenuPatch(CLASS_NAMES);
        patchNodes2ClickHandler();
    },

    beforeRegisterNodeDef: async function(nodeType, nodeData, app) {
        if (!CLASS_NAMES.includes(nodeType.comfyClass)) return;
        const config = LOADER_CONFIGS[nodeType.comfyClass];

        // --------------------------------------
        // onNodeCreated
        // --------------------------------------
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function() {
            const res = onNodeCreated?.apply(this, arguments);

            this._hookResourceWidgets();

            return res;
        }

        // --------------------------------------
        // configure
        // --------------------------------------
        const configure = nodeType.prototype.configure;
        nodeType.prototype.configure = function() {
            const res = configure?.apply(this, arguments);
            this._hookResourceWidgets();
            return res;
        }

        // --------------------------------------
        // _hookResourceWidgets
        // --------------------------------------
        nodeType.prototype._hookResourceWidgets = function() {
            config.widgets.forEach(widgetConfig => {
                const widget = this.widgets.find(w => w.name === widgetConfig.name);
                if (widget) {
                    this._hookResourceWidget(widget, widgetConfig);
                }
            });
        }

        // --------------------------------------
        // _hookResourceWidget
        // --------------------------------------
        nodeType.prototype._hookResourceWidget = function(widget, widgetConfig) {
            // --- isClickedAt メソッド ---
            widget.isClickedAt = function(x, y, node) {
                const widgetY = this.last_y || 0;
                const widgetHeight = 20;
                const margin = 10;

                return (
                    x >= margin &&
                    x <= node.size[0] - margin &&
                    y >= widgetY &&
                    y <= widgetY + widgetHeight
                );
            };

            // --- showContextMenu メソッド ---
            widget.showContextMenu = function(event, node) {
                const menuOptions = [
                    {
                        content: "ℹ️ 情報を開く",
                        callback: () => {
                            const dialog = new ResourceInfo({
                                apiDir: widgetConfig.apiDir,
                                modelPath: widget.value,
                            });
                            dialog.show();
                        }
                    }
                ];

                new LiteGraph.ContextMenu(menuOptions, {
                    event: event,
                    title: widget.value,
                    calssName: "custom-lora-menu",
                    node: node,
                    filter: false,
                }, window);
            };

            // --- onClick メソッド ---
            widget.onClick = async function({ e, node, canvas }) {
                const x = e.canvasX - node.pos[0];
                const width = this.width || node.size[0];

                if (x < 40) return this.decrementValue({ e, node, canvas });
                if (x > width - 40) return this.incrementValue({ e, node, canvas });

                await showResourceExplorer({ node, widget: this, widgetConfig, e, canvas });

                return true;
            }
        }

        // --------------------------------------
        // getClickedWidget
        // --------------------------------------
        nodeType.prototype.getClickedWidget = function(x, y) {
            for (const widgetConfig of config.widgets) {
                const widget = this.widgets.find(w => w.name === widgetConfig.name);
                if (widget?.isClickedAt(x, y, this)) {
                    return widget;
                }
            }
            return null;
        }
    }
};

app.registerExtension(extension);
