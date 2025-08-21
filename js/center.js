import { app } from "../../../scripts/app.js";

const enableLogging = false;

app.registerExtension({
    name: "ImageScaleToTotalPixelsX.display",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData?.name !== "ImageScaleToTotalPixelsX") return;

        // Create the widget immediately when the node is created
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function() {
            onNodeCreated?.apply(this, arguments);
            
            // Create the resolution display widget as a pure display element
            this.widgets ??= [];
            let w = this.widgets.find(w => w.name === "resolution");
            if (!w) {
                // Create a custom display widget instead of using ComfyWidgets STRING
                w = {
                    name: "resolution",
                    type: "display",
                    value: "",
                    options: {},
                    // Make it completely non-interactive
                    draw: function(ctx, node, widget_width, y, widget_height) {
                        const margin = 17;
                        const text = this.value || "";
                        
                        // Draw background
                        ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
                        ctx.fillRect(margin, y, widget_width - margin * 2, widget_height);
                        
                        // Draw text
                        ctx.fillStyle = "#ffffff";
                        ctx.font = "14px sans-serif";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(text, widget_width / 2, y + widget_height / 2);
                        
                        return y + widget_height;
                    },
                    computeSize: function(width) {
                        return [width, 25]; // height of 25px
                    },
                    mouse: function() {
                        return false; // Ignore all mouse events
                    },
                    onRemove: function() {}
                };
                
                this.widgets.push(w);
                this.setSize?.(this.computeSize());
                
                if (enableLogging) console.log("[ImageScaleToTotalPixelsX] Custom display widget created");
            }
        };

        const prev = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function(message) {
            prev?.apply(this, arguments);
            
            try {
                // Find the existing widget
                const w = this.widgets?.find(w => w.name === "resolution");
                
                if (w) {
                    const text = Array.isArray(message?.text) ? message.text.join("") : (message?.text || "");
                    
                    if (enableLogging) console.log("[ImageScaleToTotalPixelsX] Updating with text:", text);
                    
                    w.value = text;
                    
                    this.onResize?.(this.size);
                    this.setDirtyCanvas(true, true);
                }
            } catch (error) {
                console.error("[ImageScaleToTotalPixelsX] Error in onExecuted:", error);
            }
        };

        // Handle node reconfiguration
        const originalOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function(info) {
            originalOnConfigure?.apply(this, arguments);
            
            const w = this.widgets?.find(w => w.name === "resolution");
            if (w) {
                w.value = "";
            }
        };
    },
});
