import { app } from "../../../scripts/app.js";

const enableLogging = false;

app.registerExtension({
    name: "ImageScaleToTotalPixelsX.centerText.globalObserver",
    
    init() {
        if (enableLogging) {
            console.log("[ImageScaleToTotalPixelsX] Initializing global observer to center resolution text.");
        }

        // Create an observer to watch for new elements being added to the entire page.
        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.addedNodes.length) {
                    for (const addedNode of mutation.addedNodes) {
                        // We only care about HTML elements, not text or other node types.
                        if (addedNode.nodeType === 1) { // Node.ELEMENT_NODE
                            
                            // We check querySelector for safety in case the addedNode is not an element.
                            const span = addedNode.querySelector ? addedNode.querySelector('span') : null;
                            
                            // The pattern is "digits" then "x" then "digits" (e.g., "1168x880")
                            if (span && span.textContent.match(/^\d+x\d+$/)) {
                                
                                if (enableLogging) {
                                    console.log(`[ImageScaleToTotalPixelsX] Detected resolution text widget: "${span.textContent}"`);
                                }
                                
                                const flexContainer = span.closest('.flex-1');

                                if (flexContainer) {
                                    if (enableLogging) {
                                        console.log("[ImageScaleToTotalPixelsX] Found flex container. Applying centering style.");
                                    }
                                    
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
            childList: true,
            subtree: true
        });
    }
});
