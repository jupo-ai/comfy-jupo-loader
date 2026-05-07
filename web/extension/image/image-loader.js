import { app } from "../../../../scripts/app.js";
import { mkName, Path } from "../../utils.js";
import { ImageExplorer } from "../../dialog/explorer/image-explorer.js";

const PACKAGE_NAME = "Loader";
const CLASS_NAMES = [
    mkName(PACKAGE_NAME, "ImageLoader"), 
];

async function showImageExplorer({ node, widget, e, canvas }) {
    const explorer = new ImageExplorer(file => {
        const path = normalizeImagePath(file.path);
        const parts = new Path(path).parts;
        let value = path;
        if (parts[0] === "clipspace") {
            value += " [input]";
        }
        widget.setValue(value, { e, node, canvas });
    });
    const dirPath = new Path(widget.value).parent.toString();
    await explorer.show(dirPath);
}

function normalizeImagePath(value) {
    return String(value ?? "").replace(/\\/g, "/");
}

function normalizeImageWidgetValue(value) {
    if (typeof value !== "string") return value;

    const typeMatch = value.match(/ \[[^\]]+\]$/);
    const suffix = typeMatch?.[0] ?? "";
    const path = suffix ? value.slice(0, -suffix.length) : value;
    return normalizeImagePath(path) + suffix;
}

function normalizeImageWidget(widget, node) {
    if (!widget) return;

    const normalized = normalizeImageWidgetValue(widget.value);
    if (normalized === widget.value) return;

    widget.value = normalized;

    if (node?.properties) {
        node.properties.image = normalized;
    }

    if (node?.widgets_values && node?.widgets) {
        const widgetIndex = node.widgets.indexOf(widget);
        if (widgetIndex >= 0) {
            node.widgets_values[widgetIndex] = normalized;
        }
    }
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
    if (window.__jupoImageLoaderNodes2ClickPatched) return;
    window.__jupoImageLoaderNodes2ClickPatched = true;

    document.addEventListener("click", async (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;

        const nodeElement = target.closest(".lg-node[data-node-id]");
        const node = getNodeByElement(nodeElement);
        if (!node || !CLASS_NAMES.includes(node.comfyClass)) return;

        const row = target.closest('[data-testid="node-widget"]');
        if (!row || !nodeElement.contains(row)) return;

        const clickedWidget = findVueWidgetForRow(node, nodeElement, row);
        if (clickedWidget?.name !== "image") return;

        if (target.closest("label")) return;
        if (!target.closest("button")) return;

        const widget = node.widgets?.find(w => w.name === "image");
        if (!widget) return;
        normalizeImageWidget(widget, node);

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        await showImageExplorer({ node, widget, e, canvas: app.canvas });
    }, true);
}

const extension = {
    name: mkName(PACKAGE_NAME, "ImageLoader"), 

    init: async function() {
        patchNodes2ClickHandler();
    }, 

    beforeRegisterNodeDef: async function(nodeType, nodeData, app) {
        if (!CLASS_NAMES.includes(nodeType.comfyClass)) return;

        // --------------------------------------
        // onNodeCreated
        // --------------------------------------
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function() {
            const res = onNodeCreated?.apply(this, arguments);

            this.imageWidget = this.widgets.find(w => w.name === 'image');
            if (this.imageWidget) {
                normalizeImageWidget(this.imageWidget, this);
                this._hookImageWidget();
            }

            return res;
        }

        // --------------------------------------
        // _hookImageWidget
        // --------------------------------------
        nodeType.prototype._hookImageWidget = function() {
            // onClick
            this.imageWidget.onClick = async function({ e, node, canvas }) {
                normalizeImageWidget(this, node);

                const x = e.canvasX - node.pos[0];
                const width = this.width || node.size[0];

                if (x < 40) return this.decrementValue({ e, node, canvas });
                if (x > width - 40) return this.incrementValue({ e, node, canvas });

                await showImageExplorer({ node, widget: this, e, canvas });

                return true;
            }
        }

        // --------------------------------------
        // configure
        // --------------------------------------
        const configure = nodeType.prototype.configure;
        nodeType.prototype.configure = function() {
            const res = configure?.apply(this, arguments);

            this.imageWidget = this.widgets.find(w => w.name === "image");
            if (this.imageWidget) {
                normalizeImageWidget(this.imageWidget, this);
                this._hookImageWidget();
            }

            return res;
        }
    }
};

app.registerExtension(extension);
