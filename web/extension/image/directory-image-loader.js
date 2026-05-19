import { api } from "../../../../scripts/api.js";
import { app } from "../../../../scripts/app.js";
import { apiPost, mkName } from "../../utils.js";

const PACKAGE_NAME = "Loader";
const CLASS_NAME = mkName(PACKAGE_NAME, "DirectoryImageLoader");
const EXPANSION_MARKER = "__jupoDirectoryImageLoaderExpanded";

function getDirectoryImageLoaderEntries(prompt) {
    const output = prompt?.output ?? {};
    return Object.entries(output).filter(([, node]) => node?.class_type === CLASS_NAME);
}

function getInput(node, name, fallback = undefined) {
    const value = node?.inputs?.[name];
    return value === undefined ? fallback : value;
}

function getWidgetValue(node, widgetName, fallback = undefined) {
    const widget = node.widgets?.find((w) => w.name === widgetName);
    return widget?.value === undefined ? fallback : widget.value;
}

function setWidgetValue(node, widgetName, value) {
    const widget = node.widgets?.find((w) => w.name === widgetName);
    if (!widget) return;

    if (typeof widget.setValue === "function") {
        widget.setValue(value, { node, canvas: app.canvas });
    } else {
        widget.value = value;
        widget.callback?.(value, app.canvas, node, undefined);
    }

    if (node.properties) {
        node.properties[widgetName] = value;
    }

    const widgetIndex = node.widgets?.indexOf(widget) ?? -1;
    if (widgetIndex >= 0 && node.widgets_values) {
        node.widgets_values[widgetIndex] = value;
    }

    app.graph?.setDirtyCanvas?.(true, true);
}

async function selectDirectory(node) {
    const directoryWidget = node.widgets?.find((w) => w.name === "directory");
    const data = await apiPost(PACKAGE_NAME, "directory_image_loader_select_directory", {
        directory: directoryWidget?.value ?? "",
    });

    if (data?.directory) {
        setWidgetValue(node, "directory", data.directory);
        await updateImageCount(node);
    }
}

async function getFileCountFromValues(directory, extensions, includeSubdirectories) {
    const data = await apiPost(PACKAGE_NAME, "directory_image_loader_files", {
        directory,
        extensions,
        include_subdirectories: includeSubdirectories,
    });
    return Number(data?.count ?? 0);
}

async function updateImageCount(node) {
    if (!node.__jupoDirectoryImageLoaderCountLabel) return;

    const directory = getWidgetValue(node, "directory", "");
    const extensions = getWidgetValue(node, "extensions", "");
    const includeSubdirectories = getWidgetValue(node, "include_subdirectories", false);

    node.__jupoDirectoryImageLoaderCountLabel.textContent = "Images: checking...";

    try {
        const count = await getFileCountFromValues(directory, extensions, includeSubdirectories);
        node.__jupoDirectoryImageLoaderCountLabel.textContent = `Images: ${count}`;
    } catch (error) {
        console.warn("Failed to count directory images.", error);
        node.__jupoDirectoryImageLoaderCountLabel.textContent = "Images: error";
    }
}

function createImageCountElement() {
    const element = document.createElement("div");
    element.style.boxSizing = "border-box";
    element.style.width = "100%";
    element.style.padding = "6px 8px";
    element.style.border = "1px solid var(--border-color, #444)";
    element.style.borderRadius = "4px";
    element.style.color = "var(--fg-color, #ddd)";
    element.style.background = "var(--comfy-input-bg, rgba(0, 0, 0, 0.18))";
    element.style.fontSize = "12px";
    element.style.lineHeight = "16px";
    element.textContent = "Images: -";
    return element;
}

function addImageCountWidget(node) {
    if (
        node.__jupoDirectoryImageLoaderCountWidget
        && node.widgets?.includes(node.__jupoDirectoryImageLoaderCountWidget)
    ) {
        return;
    }

    const element = createImageCountElement();
    node.__jupoDirectoryImageLoaderCountLabel = element;

    if (typeof node.addDOMWidget === "function") {
        node.__jupoDirectoryImageLoaderCountWidget = node.addDOMWidget(
            "image_count",
            "DOM",
            element,
        );
    } else {
        node.__jupoDirectoryImageLoaderCountWidget = node.addWidget(
            "text",
            "image_count",
            "Images: -",
            () => {},
        );
        node.__jupoDirectoryImageLoaderCountLabel = {
            get textContent() {
                return node.__jupoDirectoryImageLoaderCountWidget.value;
            },
            set textContent(value) {
                node.__jupoDirectoryImageLoaderCountWidget.value = value;
            },
        };
    }
}

function addDirectoryButton(node) {
    if (
        node.__jupoDirectoryImageLoaderButton
        && node.widgets?.includes(node.__jupoDirectoryImageLoaderButton)
    ) {
        return;
    }

    node.__jupoDirectoryImageLoaderButton = node.addWidget(
        "button",
        "Select Directory",
        null,
        async () => {
            await selectDirectory(node);
        },
    );
}

function removeIndexWidget(node) {
    const widgetIndex = node.widgets?.findIndex((w) => w.name === "index") ?? -1;
    if (widgetIndex < 0) return;

    node.widgets.splice(widgetIndex, 1);
    node.widgets_values?.splice?.(widgetIndex, 1);
}

function hookCountRefresh(node) {
    for (const widgetName of ["directory", "extensions", "include_subdirectories"]) {
        const widget = node.widgets?.find((w) => w.name === widgetName);
        if (!widget || widget.__jupoDirectoryImageLoaderCountRefreshHooked) continue;
        widget.__jupoDirectoryImageLoaderCountRefreshHooked = true;

        const callback = widget.callback;
        widget.callback = function() {
            const result = callback?.apply(this, arguments);
            updateImageCount(node);
            return result;
        };
    }
}

function setupNode(node) {
    removeIndexWidget(node);
    addImageCountWidget(node);
    addDirectoryButton(node);
    hookCountRefresh(node);
    updateImageCount(node);
}

async function getFileCount(node) {
    return await getFileCountFromValues(
        getInput(node, "directory", ""),
        getInput(node, "extensions", ""),
        getInput(node, "include_subdirectories", false),
    );
}

function clonePrompt(prompt) {
    return structuredClone(prompt);
}

function buildExpandedPrompt(prompt, loaderEntries, index) {
    const nextPrompt = clonePrompt(prompt);
    nextPrompt[EXPANSION_MARKER] = true;

    for (const [nodeId] of loaderEntries) {
        const node = nextPrompt.output?.[nodeId];
        if (!node?.inputs) continue;

        node.inputs.index = index;
    }

    return nextPrompt;
}

function patchQueuePrompt() {
    if (window.__jupoDirectoryImageLoaderQueuePatched) return;
    window.__jupoDirectoryImageLoaderQueuePatched = true;

    const queuePrompt = api.queuePrompt;
    api.queuePrompt = async function(index, prompt, ...args) {
        if (prompt?.[EXPANSION_MARKER]) {
            return await queuePrompt.apply(api, arguments);
        }

        const loaderEntries = getDirectoryImageLoaderEntries(prompt);
        if (!loaderEntries.length) {
            return await queuePrompt.apply(api, arguments);
        }

        const firstLoader = loaderEntries[0][1];
        const count = await getFileCount(firstLoader);
        if (count <= 0) {
            return await queuePrompt.apply(api, arguments);
        }

        let firstResponse = null;
        for (let imageIndex = 0; imageIndex < count; imageIndex++) {
            const expandedPrompt = buildExpandedPrompt(prompt, loaderEntries, imageIndex);
            const response = await queuePrompt.apply(api, [index, expandedPrompt, ...args]);
            firstResponse ??= response;
        }

        return firstResponse;
    };
}

app.registerExtension({
    name: mkName(PACKAGE_NAME, "DirectoryImageLoaderQueueExpansion"),
    init: async function() {
        patchQueuePrompt();
    },
    beforeRegisterNodeDef: async function(nodeType) {
        if (nodeType.comfyClass !== CLASS_NAME) return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function() {
            const result = onNodeCreated?.apply(this, arguments);
            setupNode(this);
            return result;
        };

        const configure = nodeType.prototype.configure;
        nodeType.prototype.configure = function() {
            const result = configure?.apply(this, arguments);
            setupNode(this);
            return result;
        };
    },
});
