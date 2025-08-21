import { app } from "../../../scripts/app.js";

// --- Configuration ---
// Set this to 'true' to see debug messages in the browser's console (F12).
// Set this to 'false' to hide them for normal use.
const enableLogging = false;
// -------------------

app.registerExtension({
    name: "ImageScaleToTotalPixelsX.centerText.globalObserver",
    
    // The 'init' function runs once when the ComfyUI frontend starts.
    init() {
        if (enableLogging) {
            console.log("[ImageScaleToTotalPixelsX] Initializing global observer to center resolution text.");
        }

        // Create an observer to watch for new elements being added to the entire page.
        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                // Check if any new elements (nodes) were added.
                if (mutation.addedNodes.length) {
                    for (const addedNode of mutation.addedNodes) {
                        // We only care about HTML elements, not text or other node types.
                        if (addedNode.nodeType === 1) { // Node.ELEMENT_NODE
                            
                            // Efficiently search within the new element for a span that matches our pattern.
                            // We check querySelector for safety in case the addedNode is not an element.
                            const span = addedNode.querySelector ? addedNode.querySelector('span') : null;
                            
                            // The pattern is "digits" then "x" then "digits" (e.g., "1168x880")
                            if (span && span.textContent.match(/^\d+x\d+$/)) {
                                
                                if (enableLogging) {
                                    console.log(`[ImageScaleToTotalPixelsX] Detected resolution text widget: "${span.textContent}"`);
                                }
                                
                                // From your HTML, we know the span is inside a div with the class "flex-1".
                                const flexContainer = span.closest('.flex-1');

                                if (flexContainer) {
                                    if (enableLogging) {
                                        console.log("[ImageScaleToTotalPixelsX] Found flex container. Applying centering style.");
                                    }
                                    
                                    // This is the correct CSS to center an item within a flex container.
                                    flexContainer.style.justifyContent = 'center';
                                }
                            }
                        }
                    }
                }
            }
        });

        // Start the observer on the main body of the document.
        observer.observe(document.body, { 
            childList: true,  // Watch for nodes being added or removed
            subtree: true     // Watch all descendants, not just direct children
        });
    }
});
