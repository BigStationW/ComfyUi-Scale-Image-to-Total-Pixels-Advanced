import { app } from "../../scripts/app.js";

const TARGET_CLASS = "ImageScaleToTotalPixelsX";

const LABEL_ROW_HEIGHT = 42;
const LABEL_BOTTOM_PADDING = 10;
const FALLBACK_WIDGET_GAP = 4;

function getNodeId(node) {
    return String(node?.id ?? "");
}

function isTargetNode(node) {
    return node?.comfyClass === TARGET_CLASS || node?.type === TARGET_CLASS;
}

function getDefaultNodeFontSize() {
    return window?.LiteGraph?.NODE_TEXT_SIZE || window?.LiteGraph?.WIDGET_TEXT_SIZE || 16;
}

function getDefaultNodeFontFamily() {
    return window?.LiteGraph?.NODE_TEXT_FONT || "Arial, sans-serif";
}

function getDefaultWidgetHeight() {
    return window?.LiteGraph?.NODE_WIDGET_HEIGHT || 20;
}

function markCanvasDirty(node) {
    if (typeof node?.setDirtyCanvas === "function") {
        node.setDirtyCanvas(true, true);
    } else if (app?.canvas?.setDirty) {
        app.canvas.setDirty(true, true);
    }
}

function getWidgetY(widget) {
    const y = Number(widget?.last_y ?? widget?.y);
    return Number.isFinite(y) ? y : null;
}

function getWidgetHeight(widget) {
    const h = Number(widget?.height);
    return Number.isFinite(h) && h > 0 ? h : getDefaultWidgetHeight();
}

function getDrawableWidgets(node) {
    return (node.widgets || [])
        .map((widget) => {
            const y = getWidgetY(widget);
            if (y === null || y <= 0) return null;
            return { widget, y, height: getWidgetHeight(widget) };
        })
        .filter(Boolean)
        .sort((a, b) => a.y - b.y);
}

function getNaturalWidgetGap(node) {
    const widgets = getDrawableWidgets(node);
    if (widgets.length < 2) return FALLBACK_WIDGET_GAP;

    const gaps = [];
    for (let i = 0; i < widgets.length - 1; i++) {
        const gap = widgets[i + 1].y - (widgets[i].y + widgets[i].height);
        if (Number.isFinite(gap) && gap >= 0 && gap <= 24) gaps.push(gap);
    }

    if (!gaps.length) return FALLBACK_WIDGET_GAP;
    gaps.sort((a, b) => a - b);
    return gaps[Math.floor(gaps.length / 2)];
}

function getLastWidgetBottom(node) {
    const widgets = getDrawableWidgets(node);
    if (!widgets.length) return 0;
    
    let bottom = 0;
    for (const item of widgets) bottom = Math.max(bottom, item.y + item.height);
    return bottom;
}

function getComputedNodeHeight(node) {
    const currentHeight = Number(node?.size?.[1]) || 0;
    try {
        if (typeof node.computeSize === "function") {
            const computed = node.computeSize();
            if (Number.isFinite(computed?.[1])) return computed[1];
        }
    } catch {
        return currentHeight;
    }
    return currentHeight;
}

function getLabelTop(node) {
    const lastWidgetBottom = getLastWidgetBottom(node);
    if (lastWidgetBottom > 0) return Math.ceil(lastWidgetBottom + getNaturalWidgetGap(node));
    return Math.max(0, getComputedNodeHeight(node) - LABEL_ROW_HEIGHT - LABEL_BOTTOM_PADDING);
}

function ensureLabelSpace(node, forceResize = false) {
    if (!node || !isTargetNode(node)) return;

    const currentWidth = Number(node.size?.[0]) || 300;
    const currentHeight = Number(node.size?.[1]) || 0;

    const labelTop = getLabelTop(node);
    const wantedHeight = Math.ceil(labelTop + LABEL_ROW_HEIGHT + LABEL_BOTTOM_PADDING);

    node._scaleImageTotalPixelsLabelTop = labelTop;
    node._scaleImageTotalPixelsWantedHeight = wantedHeight;

    if (forceResize || currentHeight < wantedHeight) {
        const newSize = [currentWidth, wantedHeight];
        if (typeof node.setSize === "function") node.setSize(newSize);
        else node.size = newSize;
        markCanvasDirty(node);
    }
}

function getLabelY(node) {
    const labelTop = Number(node._scaleImageTotalPixelsLabelTop) || getLabelTop(node);
    return labelTop + (LABEL_ROW_HEIGHT / 2);
}

function applyLabelToNode(node, text) {
    if (!node) return;
    node._scaleImageTotalPixelsLabel = String(text || "");
    ensureLabelSpace(node, true);
    markCanvasDirty(node);
}

function patchNodeDrawing(node) {
    if (!isTargetNode(node) || node._scaleImageTotalPixelsPatched) return;
    
    node._scaleImageTotalPixelsPatched = true;
    const originalOnDrawForeground = node.onDrawForeground;

    node.onDrawForeground = function(ctx) {
        if (originalOnDrawForeground) originalOnDrawForeground.apply(this, arguments);

        const text = this._scaleImageTotalPixelsLabel;
        if (!text) return;

        ensureLabelSpace(this, false);

        const nodeWidth = Number(this.size?.[0]) || 300;
        const x = nodeWidth / 2;
        const y = getLabelY(this);

        ctx.save();
        ctx.font = `700 ${getDefaultNodeFontSize()}px ${getDefaultNodeFontFamily()}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, x, y);
        ctx.restore();
    };
}

app.registerExtension({
    name: "scale_image_to_total_pixels_adv.resolution_label",

    async nodeCreated(node) {
        if (!isTargetNode(node)) return;
        patchNodeDrawing(node);

        // This handles NATIVE ComfyUI updates (both new generations and Cache History Hits)
        const originalOnExecuted = node.onExecuted;
        node.onExecuted = function(message) {
            if (originalOnExecuted) originalOnExecuted.apply(this, arguments);
            
            if (message && message.text) {
                applyLabelToNode(this, message.text[0]);
            }
        };

        requestAnimationFrame(() => {
            ensureLabelSpace(node, false);
            markCanvasDirty(node);
        });

        setTimeout(() => {
            ensureLabelSpace(node, false);
            markCanvasDirty(node);
        }, 100);
    },
});