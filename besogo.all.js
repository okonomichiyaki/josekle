/*
MIT License

Copyright (c) 2015-2018 Ye Wang
https://yewang.github.io/besogo/

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
(function() { // Main components
'use strict';
var besogo = window.besogo = window.besogo || {}; // Establish our namespace
besogo.VERSION = '0.0.2-alpha';

besogo.create = function(container, options) {
    var editor, // Core editor object
        resizer, // Auto-resizing function
        boardDiv, // Board display container
        panelsDiv, // Parent container of panel divs
        makers = { // Map to panel creators
            control: besogo.makeControlPanel,
            names: besogo.makeNamesPanel,
            hint: besogo.makeHintPanel,
            comment: besogo.makeCommentPanel,
            tool: besogo.makeToolPanel,
            tree: besogo.makeTreePanel,
            file: besogo.makeFilePanel
        },
        insideText = container.textContent || container.innerText || '',
        i, panelName; // Scratch iteration variables

    container.className += ' besogo-container'; // Marks this div as initialized

    // Process options and set defaults
    options = options || {}; // Makes option checking simpler
    options.size = besogo.parseSize(options.size || 19);
    options.coord = options.coord || 'none';
    options.tool = options.tool || 'auto';
    if (options.panels === '') {
        options.panels = [];
    }
    options.panels = options.panels || 'control+names+comment+tool+tree+file';
    if (typeof options.panels === 'string') {
        options.panels = options.panels.split('+');
    }
    options.path = options.path || '';
    if (options.shadows === undefined) {
        options.shadows = 'auto';
    } else if (options.shadows === 'off') {
        options.shadows = false;
    }

    // Make the core editor object
    editor = besogo.makeEditor(options.size.x, options.size.y);
    container.editor = editor;
    editor.setTool(options.tool);
    editor.setCoordStyle(options.coord);
    if (options.realstones) { // Using realistic stones
        editor.REAL_STONES = true;
        editor.SHADOWS = options.shadows;
    } else { // SVG stones
        editor.SHADOWS = (options.shadows && options.shadows !== 'auto');
    }
    if (options.zoom) { // Set initial zoom value if given
        editor.setZoom(+options.zoom)
    }

    if (!options.nokeys) { // Add keypress handler unless nokeys option is truthy
        addKeypressHandler(container, editor);
    }

    if (options.sgf) { // Load SGF file from URL
        try {
            fetchParseLoad(options.sgf, editor, options.path);
        } catch(e) {
            // Silently fail on network error
        }
    } else if (insideText.match(/\s*\(\s*;/)) { // Text content looks like an SGF file
        parseAndLoad(insideText, editor);
        navigatePath(editor, options.path); // Navigate editor along path
    }

    if (typeof options.variants === 'number' || typeof options.variants === 'string') {
        editor.setVariantStyle(+options.variants); // Converts to number
    }

    while (container.firstChild) { // Remove all children of container
        container.removeChild(container.firstChild);
    }

    boardDiv = makeDiv('besogo-board'); // Create div for board display
    besogo.makeBoardDisplay(boardDiv, editor); // Create board display

    if (!options.nowheel) { // Add mousewheel handler unless nowheel option is truthy
        addWheelHandler(boardDiv, editor);
    }

    if (options.panels.length > 0) { // Only create if there are panels to add
        panelsDiv = makeDiv('besogo-panels');
        for (i = 0; i < options.panels.length; i++) {
            panelName = options.panels[i];
            if (makers[panelName]) { // Only add if creator function exists
                makers[panelName](makeDiv('besogo-' + panelName, panelsDiv), editor);
            }
        }
        if (!panelsDiv.firstChild) { // If no panels were added
            container.removeChild(panelsDiv); // Remove the panels div
            panelsDiv = false; // Flags panels div as removed
        }
    }


    if (options.resize === 'fixed') {
        setDimensions(container.clientWidth, container.clientHeight);
    } else { // Add auto-resizing unless resize option is "fixed"
        resizer = function() {
            var // height = window.innerHeight, // Viewport height
                height = parseFloat(getComputedStyle(container.parentElement).height),
                // Calculated width of parent element
                width = parseFloat(getComputedStyle(container.parentElement).width),

                minPanelsWidth = +(options.minpanelswidth || 350),
                minPanelsHeight = +(options.minpanelsheight || 350),

                // Calculated dimensions for the panels div
                panelsWidth,
                panelsHeight;

            if (width >= height) { // Landscape mode
                container.style['flex-direction'] = 'row';
                panelsWidth = (width - height >= minPanelsWidth) ? (width - height) : minPanelsWidth;
                panelsDiv.style.height = height + 'px';
                panelsDiv.style.width = panelsWidth + 'px';
                boardDiv.style.height = height + 'px';
                boardDiv.style.width = (width - panelsWidth) + 'px';
            } else { // Portrait mode
                container.style['flex-direction'] = 'column';
                panelsHeight = (height - width >= minPanelsHeight) ? (height - width) : minPanelsHeight;
                panelsDiv.style.height = panelsHeight + 'px';
                panelsDiv.style.width = width + 'px';
                boardDiv.style.height = (height - panelsHeight) + 'px';
                boardDiv.style.width = width + 'px';
            }
        };
        window.addEventListener("resize", resizer);
        resizer(); // Initial div sizing
    }

    // Sets dimensions with optional height param
    function setDimensions(width, height) {
        if (height && width > height) { // Landscape mode
            container.style['flex-direction'] = 'row';
            boardDiv.style.height = height + 'px';
            boardDiv.style.width = height + 'px';
            if (panelsDiv) {
                panelsDiv.style.height = height + 'px';
                panelsDiv.style.width = (width - height) + 'px';
            }
        } else { // Portrait mode (implied if height is missing)
            container.style['flex-direction'] = 'column';
            boardDiv.style.height = width + 'px';
            boardDiv.style.width = width + 'px';
            if (panelsDiv) {
                if (height) { // Only set height if param present
                    panelsDiv.style.height = (height - width) + 'px';
                }
                panelsDiv.style.width = width + 'px';
            }
        }
    }

    // Creates and adds divs to specified parent or container
    function makeDiv(className, parent) {
        var div = document.createElement("div");
        if (className) {
            div.className = className;
        }
        parent = parent || container;
        parent.appendChild(div);
        return div;
    }
}; // END function besogo.create

// Parses size parameter from SGF format
besogo.parseSize = function(input) {
    var matches,
        sizeX,
        sizeY;

    input = (input + '').replace(/\s/g, ''); // Convert to string and remove whitespace

    matches = input.match(/^(\d+):(\d+)$/); // Check for #:# pattern
    if (matches) { // Composed value pattern found
        sizeX = +matches[1]; // Convert to numbers
        sizeY = +matches[2];
    } else if (input.match(/^\d+$/)) { // Check for # pattern
        sizeX = +input; // Convert to numbers
        sizeY = +input; // Implied square
    } else { // Invalid input format
        sizeX = sizeY = 19; // Default size value
    }
    if (sizeX > 52 || sizeX < 1 || sizeY > 52 || sizeY < 1) {
        sizeX = sizeY = 19; // Out of range, set to default
    }

    return { x: sizeX, y: sizeY };
};

// Automatically converts document elements into besogo instances
besogo.autoInit = function() {
    var allDivs = document.getElementsByTagName('div'), // Live collection of divs
        targetDivs = [], // List of divs to auto-initialize
        options, // Structure to hold options
        i, j, attrs; // Scratch iteration variables

    for (i = 0; i < allDivs.length; i++) { // Iterate over all divs
        if ( (hasClass(allDivs[i], 'besogo-editor') || // Has an auto-init class
              hasClass(allDivs[i], 'besogo-viewer') ||
              hasClass(allDivs[i], 'besogo-diagram')) &&
             !hasClass(allDivs[i], 'besogo-container') ) { // Not already initialized
                targetDivs.push(allDivs[i]);
        }
    }

    for (i = 0; i < targetDivs.length; i++) { // Iterate over target divs
        options = {}; // Clear the options struct
        if (hasClass(targetDivs[i], 'besogo-editor')) {
            options.panels = ['control', 'names', 'comment', 'tool', 'tree', 'file'];
            options.tool = 'auto';
        } else if (hasClass(targetDivs[i], 'besogo-viewer')) {
            options.panels = ['control', 'names', 'comment'];
            options.tool = 'navOnly';
        } else if (hasClass(targetDivs[i], 'besogo-diagram')) {
            options.panels = [];
            options.tool = 'navOnly';
        }

        attrs = targetDivs[i].attributes;
        for (j = 0; j < attrs.length; j++) { // Load attributes as options
            options[attrs[j].name] = attrs[j].value;
        }
        besogo.create(targetDivs[i], options);
    }

    function hasClass(element, str) {
        return (element.className.split(' ').indexOf(str) !== -1);
    }
};

// Sets up keypress handling
function addKeypressHandler(container, editor) {
    if (!container.getAttribute('tabindex')) {
        container.setAttribute('tabindex', '0'); // Set tabindex to allow div focusing
    }

    container.addEventListener('keydown', function(evt) {
        evt = evt || window.event;
        switch (evt.keyCode) {
            case 33: // page up
                editor.prevNode(10);
                break;
            case 34: // page down
                editor.nextNode(10);
                break;
            case 35: // end
                editor.nextNode(-1);
                break;
            case 36: // home
                editor.prevNode(-1);
                break;
            case 37: // left
                if ( evt.shiftKey ) {
                    editor.prevBranchPoint();
                } else {
                    editor.prevNode(1);
                }
                break;
            case 38: // up
                editor.nextSibling(-1);
                break;
            case 39: // right
                editor.nextNode(1);
                break;
            case 40: // down
                editor.nextSibling(1);
                break;
            case 46: // delete
                editor.cutCurrent();
                break;
        } // END switch (evt.keyCode)
        if (evt.keyCode >= 33 && evt.keyCode <= 40) {
            evt.preventDefault(); // Suppress page nav controls
        }
    }); // END func() and addEventListener
} // END function addKeypressHandler

// Sets up mousewheel handling
function addWheelHandler(boardDiv, editor) {
    boardDiv.addEventListener('wheel', function(evt) {
        evt = evt || window.event;
        if (evt.deltaY > 0) {
            editor.nextNode(1);
            evt.preventDefault();
        } else if (evt.deltaY < 0) {
            editor.prevNode(1);
            evt.preventDefault();
        }
    });
}

// Parses SGF string and loads into editor
function parseAndLoad(text, editor) {
    var sgf;
    try {
        sgf = besogo.parseSgf(text);
    } catch (error) {
        return; // Silently fail on parse error
    }
    besogo.loadSgf(sgf, editor);
}

// Fetches text file at url from same domain
function fetchParseLoad(url, editor, path) {
    var http = new XMLHttpRequest();

    http.onreadystatechange = function() {
        if (http.readyState === 4 && http.status === 200) { // Successful fetch
            parseAndLoad(http.responseText, editor);
            navigatePath(editor, path);
        }
    };
    http.overrideMimeType('text/plain'); // Prevents XML parsing and warnings
    http.open("GET", url, true); // Asynchronous load
    http.send();
}

function navigatePath(editor, path) {
    var subPaths,
        i, j; // Scratch iteration variables

    path = path.split(/[Nn]+/); // Split into parts that start in next mode
    for (i = 0; i < path.length; i++) {
        subPaths = path[i].split(/[Bb]+/); // Split on switches into branch mode
        executeMoves(subPaths[0], false); // Next mode moves
        for (j = 1; j < subPaths.length; j++) { // Intentionally starting at 1
            executeMoves(subPaths[j], true); // Branch mode moves
        }
    }

    function executeMoves(part, branch) {
        var i;
        part = part.split(/\D+/); // Split on non-digits
        for (i = 0; i < part.length; i++) {
            if (part[i]) { // Skip empty strings
                if (branch) { // Branch mode
                    if (editor.getCurrent().children.length) {
                        editor.nextNode(1);
                        editor.nextSibling(part[i] - 1);
                    }
                } else { // Next mode
                    editor.nextNode(+part[i]); // Converts to number
                }
            }
        }
    }
}

})(); // END closure

besogo.makeBoardDisplay = function(container, editor) {
    'use strict';
    var CELL_SIZE = 88, // Including line width
        COORD_MARGIN = 75, // Margin for coordinate labels
        EXTRA_MARGIN = 6, // Extra margin on the edge of board
        BOARD_MARGIN, // Total board margin

        // Board size parameters
        sizeX = editor.getCurrent().getSize().x,
        sizeY = editor.getCurrent().getSize().y,

        svg, // Holds the overall board display SVG element
        stoneGroup, // Group for stones
        markupGroup, // Group for markup
        hoverGroup, // Group for hover layer
        markupLayer, // Array of markup layer elements
        hoverLayer, // Array of hover layer elements

        randIndex, // Random index for stone images

        TOUCH_FLAG = false, // Flag for touch interfaces
        xDown = null, // Touch event start flags
        yDown = null;

    initializeBoard(editor.getCoordStyle(), editor.getZoom()); // Initialize SVG element and draw the board
    container.appendChild(svg); // Add the SVG element to the document
    editor.addListener(update); // Register listener to handle editor/game state updates
    redrawAll(editor.getCurrent()); // Draw stones, markup and hover layer

    // Set listener to detect touch interfaces
    container.addEventListener('touchstart', setTouchFlag);

    // Function for setting the flag for touch interfaces
    function setTouchFlag () {
        TOUCH_FLAG = true; // Set flag to prevent needless function calls
        hoverLayer = []; // Drop hover layer references, kills events
        svg.removeChild(hoverGroup); // Remove hover group from SVG
        // Remove self when done
        container.removeEventListener('touchstart', setTouchFlag);
    }

    container.addEventListener('touchstart', handleTouchStart, false);
    container.addEventListener('touchmove', handleTouchMove, false);

    function handleTouchStart(evt) {
        xDown = evt.touches[0].clientX;
        yDown = evt.touches[0].clientY;
    }

    function handleTouchMove(evt) {
        var xUp = evt.touches[0].clientX,
            yUp = evt.touches[0].clientY,
            xDiff, yDiff;

        if ( ! xDown || ! yDown ) {
            return;
        }
        xDiff = xDown - xUp;
        yDiff = yDown - yUp;

        if ( Math.abs( xDiff ) > Math.abs( yDiff ) ) {
            if ( xDiff > 0 ) {
                editor.nextNode(1);
            } else {
                editor.prevNode(1);
            }
        } else {
            if ( yDiff > 0 ) {
                editor.nextSibling(1);
            } else {
                editor.nextSibling(-1);
            }
        }

        xDown = null;
        yDown = null;
    }

    // Initializes the SVG and draws the board
    function initializeBoard(coord, zoom) {
        drawBoard(coord, zoom); // Initialize the SVG element and draw the board

        stoneGroup = besogo.svgEl("g");
        markupGroup = besogo.svgEl("g");

        svg.appendChild(stoneGroup); // Add placeholder group for stone layer
        svg.appendChild(markupGroup); // Add placeholder group for markup layer

        if (!TOUCH_FLAG) {
            hoverGroup = besogo.svgEl("g");
            svg.appendChild(hoverGroup);
        }

        addEventTargets(); // Add mouse event listener layer

        if (editor.REAL_STONES) { // Generate index for realistic stone images
            randomizeIndex();
        }
    }

    // Callback for board display redraws
    function update(msg) {
        var current = editor.getCurrent(),
            currentSize = current.getSize(),
            reinit = false, // Board redraw flag
            oldSvg = svg;

        // Check if board size has changed
        if (currentSize.x !== sizeX || currentSize.y !== sizeY || msg.coord || msg.zoom) {
            sizeX = currentSize.x;
            sizeY = currentSize.y;
            initializeBoard(msg.coord || editor.getCoordStyle(), msg.zoom || editor.getZoom());
            container.replaceChild(svg, oldSvg);
            reinit = true; // Flag board redrawn
        }

        // Redraw stones only if needed
        if (reinit || msg.navChange || msg.stoneChange) {
            redrawStones(current);
            redrawMarkup(current);
            redrawHover(current);
        } else if (msg.markupChange || msg.treeChange) {
            redrawMarkup(current);
            redrawHover(current);
        } else if (msg.tool || msg.label) {
            redrawHover(current);
        }
    }

    function redrawAll(current) {
        redrawStones(current);
        redrawMarkup(current);
        redrawHover(current);
    }

    // Initializes the SVG element and draws the board
    function drawBoard(coord, zoom) {
        var boardWidth,
            boardHeight,
            string = "", // Path string for inner board lines
            i; // Scratch iteration variable

        BOARD_MARGIN = (coord === 'none' ? 0 : COORD_MARGIN) + EXTRA_MARGIN;
        boardWidth = 2*BOARD_MARGIN + sizeX*CELL_SIZE;
        boardHeight = 2*BOARD_MARGIN + sizeY*CELL_SIZE;

        var viewBoxWidth = boardWidth / zoom;
        var viewBoxHeight = boardHeight / zoom;
        var viewBoxMinX = boardWidth - viewBoxWidth;
        var viewBoxMinY = 0;
        svg = besogo.svgEl("svg", { // Initialize the SVG element
            width: "100%",
            height: "100%",
            viewBox: `${viewBoxMinX} ${viewBoxMinY} ${viewBoxWidth} ${viewBoxHeight}`
        });

        svg.appendChild(besogo.svgEl("rect", { // Fill background color
            width: boardWidth,
            height: boardHeight,
            'class': 'besogo-svg-board'
        }) );

        svg.appendChild(besogo.svgEl("rect", { // Draw outer square of board
            width: CELL_SIZE*(sizeX - 1),
            height: CELL_SIZE*(sizeY - 1),
            x: svgPos(1),
            y: svgPos(1),
            'class': 'besogo-svg-lines'
        }) );

        for (i = 2; i <= (sizeY - 1); i++) { // Horizontal inner lines
            string += "M" + svgPos(1) + "," + svgPos(i) + "h" + CELL_SIZE*(sizeX - 1);
        }
        for (i = 2; i <= (sizeX - 1); i++) { // Vertical inner lines
            string += "M" + svgPos(i) + "," + svgPos(1) + "v" + CELL_SIZE*(sizeY - 1);
        }
        svg.appendChild( besogo.svgEl("path", { // Draw inner lines of board
            d: string,
            'class': 'besogo-svg-lines'
        }) );

        drawHoshi(); // Draw the hoshi points
        if (coord !== 'none') {
            drawCoords(coord); // Draw the coordinate labels
        }
    }

    // Draws coordinate labels on the board
    function drawCoords(coord) {
        var labels = besogo.coord[coord](sizeX, sizeY),
            labelXa = labels.x, // Top edge labels
            labelXb = labels.xb || labels.x, // Bottom edge
            labelYa = labels.y, // Left edge
            labelYb = labels.yb || labels.y, // Right edge
            shift = COORD_MARGIN + 10,
            i, x, y; // Scratch iteration variable

        for (i = 1; i <= sizeX; i++) { // Draw column coordinate labels
            x = svgPos(i);
            drawCoordLabel(x, svgPos(1) - shift, labelXa[i]);
            drawCoordLabel(x, svgPos(sizeY) + shift, labelXb[i]);
        }

        for (i = 1; i <= sizeY; i++) { // Draw row coordinate labels
            y = svgPos(i);
            drawCoordLabel(svgPos(1) - shift, y, labelYa[i]);
            drawCoordLabel(svgPos(sizeX) + shift, y, labelYb[i]);
        }

        function drawCoordLabel(x, y, label) {
            var element = besogo.svgEl("text", {
                x: x,
                y: y,
                dy: ".65ex", // Seems to work for vertically centering these fonts
                "font-size": 32,
                "text-anchor": "middle", // Horizontal centering
                "font-family": "Helvetica, Arial, sans-serif",
                fill: 'black'
            });
            element.appendChild( document.createTextNode(label) );
            svg.appendChild(element);
        }
    }

    // Draws hoshi onto the board at procedurally generated locations
    function drawHoshi() {
        var cx, cy, // Center point calculation
            pathStr = ""; // Path string for drawing star points

        if (sizeX % 2 && sizeY % 2) { // Draw center hoshi if both dimensions are odd
            cx = (sizeX - 1)/2 + 1; // Calculate the center of the board
            cy = (sizeY - 1)/2 + 1;
            drawStar(cx, cy);

            if (sizeX >= 17 && sizeY >= 17) { // Draw side hoshi if at least 17x17 and odd
                drawStar(4, cy);
                drawStar(sizeX - 3, cy);
                drawStar(cx, 4);
                drawStar(cx, sizeY - 3);
            }
        }

        if (sizeX >= 11 && sizeY >= 11) { // Corner hoshi at (4, 4) for larger sizes
            drawStar(4, 4);
            drawStar(4, sizeY - 3);
            drawStar(sizeX - 3, 4);
            drawStar(sizeX - 3, sizeY - 3);
        } else if (sizeX >= 8 && sizeY >= 8) { // Corner hoshi at (3, 3) for medium sizes
            drawStar(3, 3);
            drawStar(3, sizeY - 2);
            drawStar(sizeX - 2, 3);
            drawStar(sizeX - 2, sizeY - 2);
        } // No corner hoshi for smaller sizes

        if (pathStr) { // Only need to add if hoshi drawn
            svg.appendChild( besogo.svgEl('path', { // Drawing circles via path points
                d: pathStr, // Hack to allow radius adjustment via stroke-width
                'stroke-linecap': 'round', // Makes the points round
                'class': 'besogo-svg-hoshi'
            }) );
        }

        function drawStar(i, j) { // Extend path string to draw star point
            pathStr += "M" + svgPos(i) + ',' + svgPos(j) + 'l0,0'; // Draws a point
        }
    }

    // Remakes the randomized index for stone images
    function randomizeIndex() {
        var maxIndex = besogo.BLACK_STONES * besogo.WHITE_STONES,
            i, j;

        randIndex = [];
        for (i = 1; i <= sizeX; i++) {
            for (j = 1; j <= sizeY; j++) {
                randIndex[fromXY(i, j)] = Math.floor(Math.random() * maxIndex);
            }
        }
    }

    // Adds a grid of squares to register mouse events
    function addEventTargets() {
        var element,
            i, j;

        for (i = 1; i <= sizeX; i++) {
            for (j = 1; j <= sizeY; j++) {
                element = besogo.svgEl("rect", { // Make a transparent event target
                    x: svgPos(i) - CELL_SIZE/2,
                    y: svgPos(j) - CELL_SIZE/2,
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    opacity: 0
                });

                // Add event listeners, using closures to decouple (i, j)
                element.addEventListener("click", handleClick(i, j));

                if (!TOUCH_FLAG) { // Skip hover listeners for touch interfaces
                    element.addEventListener("mouseover", handleOver(i, j));
                    element.addEventListener("mouseout", handleOut(i, j));
                }

                svg.appendChild(element);
            }
        }
    }

    function handleClick(i, j) { // Returns function for click handling
        return function(event) {
            // Call click handler in editor
            editor.click(i, j, event.ctrlKey, event.shiftKey);
            if(!TOUCH_FLAG) {
                (handleOver(i, j))(); // Ensures that any updated tool is visible
            }
        };
    }
    function handleOver(i, j) { // Returns function for mouse over
        return function() {
            var element = hoverLayer[ fromXY(i, j) ];
            if (element) { // Make tool action visible on hover over
                element.setAttribute('visibility', 'visible');
            }
        };
    }
    function handleOut(i, j) { // Returns function for mouse off
        return function() {
            var element = hoverLayer[ fromXY(i, j) ];
            if (element) { // Make tool action invisible on hover off
                element.setAttribute('visibility', 'hidden');
            }
        };
    }

    // Redraws the stones
    function redrawStones(current) {
        var group = besogo.svgEl("g"), // New stone layer group
            shadowGroup, // Group for shadow layer
            i, j, x, y, color; // Scratch iteration variables

        if (editor.SHADOWS) { // Add group for shawdows
            shadowGroup = besogo.svgShadowGroup();
            group.appendChild(shadowGroup);
        }

        for (i = 1; i <= sizeX; i++) {
            for (j = 1; j <= sizeY; j++) {
                color = current.getStone(i, j);
                if (color) {
                    x = svgPos(i);
                    y = svgPos(j);

                    if (editor.REAL_STONES) { // Realistic stone
                        group.appendChild(besogo.realStone(x, y, color, randIndex[fromXY(i, j)]));
                    } else { // SVG stone
                        group.appendChild(besogo.svgStone(x, y, color));
                    }

                    if (editor.SHADOWS) { // Draw shadows
                        shadowGroup.appendChild(besogo.svgShadow(x - 2, y - 4));
                        shadowGroup.appendChild(besogo.svgShadow(x + 2, y + 4));
                    }
                }
            }
        }

        svg.replaceChild(group, stoneGroup); // Replace the stone group
        stoneGroup = group;
    }

    // Redraws the markup
    function redrawMarkup(current) {
        var element, i, j, x, y, // Scratch iteration variables
            group = besogo.svgEl("g"), // Group holding markup layer elements
            lastMove = current.move,
            variants = editor.getVariants(),
            mark, // Scratch mark state {0, 1, 2, 3, 4, 5}
            stone, // Scratch stone state {0, -1, 1}
            color; // Scratch color string

        markupLayer = []; // Clear the references to the old layer

        // Mark all variants first, which allows them to be overwritten with hints later
        markRemainingVariants(variants, current, group);

        for (i = 1; i <= sizeX; i++) {
            for (j = 1; j <= sizeY; j++) {
                mark = current.getMarkup(i, j);
                if (mark) {
                    x = svgPos(i);
                    y = svgPos(j);
                    stone = current.getStone(i, j);
                    color = stone; // Stone color int, may be overwriten with class str
                    if (lastMove && lastMove.x === i && lastMove.y === j) {
                        color = 'last';
                    }
                    else if (checkVariants(variants, current, i, j)) {
                        color = 'variant';
                    }
                    if (typeof mark === 'number') { // Markup is a basic shape
                        switch(mark) {
                            case 1: // Green (unnumbered and not used anymore)
                                element = besogo.svgCircle(x, y, color);
                                break;
                            case 2: // Yellow (actually purple)
                                element = besogo.svgSquare(x, y, color);
                                break;
                            case 3: // Missing
                                element = besogo.svgTriangle(x, y, color);
                                break;
                        }
                        if (mark < 0) { // Negative markup is green hint with number
                            if (!stone) { // If placing label on empty spot
                                element = makeBacker(x, y);
                                group.appendChild(element);
                            }
                            element = besogo.svgLabel(x, y, color, -mark + '');
                            markupLayer[ fromXY(i, j) ] = element;
                            group.appendChild(element);
                            element = besogo.svgCircle(x, y, color);
                        }
                    } else { // Markup is a label (unused for josekle)
                        if (!stone) { // If placing label on empty spot
                            element = makeBacker(x, y);
                            group.appendChild(element);
                        }
                        element = besogo.svgLabel(x, y, color, mark);
                        markupLayer[ fromXY(i, j) ] = element;
                    }
                    group.appendChild(element);
                } // END if (mark)
            } // END for j
        } // END for i

        // Mark last move with plus if not already marked
        if (lastMove && lastMove.x !== 0 && lastMove.y !== 0) {
            i = lastMove.x;
            j = lastMove.y;
            if (!markupLayer[ fromXY(i, j) ]) { // Last move not marked
                element = besogo.svgPlus(svgPos(i), svgPos(j));
                group.appendChild(element);
                markupLayer[ fromXY(i, j) ] = element;
            }
        }

        svg.replaceChild(group, markupGroup); // Replace the markup group
        markupGroup = group;
    } // END function redrawMarkup

    function makeBacker(x, y) { // Makes a label markup backer at (x, y)
        return besogo.svgEl("rect", {
            x: x - CELL_SIZE/2,
            y: y - CELL_SIZE/2,
            height: CELL_SIZE,
            width: CELL_SIZE,
            opacity: 0.85,
            stroke: "none",
            'class': 'besogo-svg-board besogo-svg-backer'
        });
    }

    // Checks if (x, y) is in variants
    function checkVariants(variants, current, x, y) {
        var i, move;
        for (i = 0; i < variants.length; i++) {
            if (variants[i] !== current) { // Skip current (within siblings)
                move = variants[i].move;
                if (move && move.x === x && move.y === y) {
                    return true;
                }
            }
        }
        return false;
    }

    // Marks variants that have not already been marked
    function markRemainingVariants(variants, current, group) {
        var element,
            move, // Variant move
            label, // Variant label
            stone, // Stone state
            i, x, y; // Scratch iteration variables

        for (i = 0; i < variants.length; i++) {
            if (variants[i] !== current) { // Skip current (within siblings)
                move = variants[i].move;
                // Check if move, not a pass, and no mark yet
                if (move && move.x !== 0 && current.getMarkup(move.x, move.y) >= 0) {
                    stone = current.getStone(move.x, move.y);
                    x = svgPos(move.x); // Get SVG positions
                    y = svgPos(move.y);
                    if (!stone) { // If placing label on empty spot
                        element = makeBacker(x, y);
                        group.appendChild(element);
                    }
                    // Label variants with letters A-Z cyclically
                    label = String.fromCharCode('A'.charCodeAt(0) + (i % 26));
                    element = besogo.svgLabel(x, y, 'variant', label);
                    group.appendChild(element);
                    markupLayer[ fromXY(move.x, move.y) ] = element;
                }
            }
        }
    } // END function markRemainingVariants

    // Redraws the hover layer
    function redrawHover(current) {
        if (TOUCH_FLAG) {
            return; // Do nothing for touch interfaces
        }

        var element, i, j, x, y, // Scratch iteration variables
            group = besogo.svgEl("g"), // Group holding hover layer elements
            tool = editor.getTool(),
            children,
            stone, // Scratch stone state {0, -1, 1} or move
            color; // Scratch color string

        hoverLayer = []; // Clear the references to the old layer
        group.setAttribute('opacity', '0.35');

        if (tool === 'navOnly') { // Render navOnly hover by iterating over children
            children = current.children;
            for (i = 0; i < children.length; i++) {
                stone = children[i].move;
                if (stone && stone.x !== 0) { // Child node is move and not a pass
                    x = svgPos(stone.x);
                    y = svgPos(stone.y);
                    element = besogo.svgStone(x, y, stone.color);
                    element.setAttribute('visibility', 'hidden');
                    group.appendChild(element);
                    hoverLayer[ fromXY(stone.x, stone.y) ] = element;
                }
            }
        } else { // Render hover for other tools by iterating over grid
            for (i = 1; i <= sizeX; i++) {
                for (j = 1; j <= sizeY; j++) {
                    element = null;
                    x = svgPos(i);
                    y = svgPos(j);
                    stone = current.getStone(i, j);
                    color = (stone === -1) ? "white" : "black"; // White on black
                    switch(tool) {
                        case 'auto':
                            element = besogo.svgStone(x, y, current.nextMove());
                            break;
                        case 'playB':
                            element = besogo.svgStone(x, y, -1);
                            break;
                        case 'playW':
                            element = besogo.svgStone(x, y, 1);
                            break;
                        case 'addB':
                            if (stone === -1) {
                                element = besogo.svgCross(x, y, besogo.RED);
                            } else {
                                element = besogo.svgEl('g');
                                element.appendChild(besogo.svgStone(x, y, -1));
                                element.appendChild(besogo.svgPlus(x, y, besogo.RED));
                            }
                            break;
                        case 'addW':
                            if (stone === 1) {
                                element = besogo.svgCross(x, y, besogo.RED);
                            } else {
                                element = besogo.svgEl('g');
                                element.appendChild(besogo.svgStone(x, y, 1));
                                element.appendChild(besogo.svgPlus(x, y, besogo.RED));
                            }
                            break;
                        case 'addE':
                            if (stone) {
                                element = besogo.svgCross(x, y, besogo.RED);
                            }
                            break;
                        case 'clrMark':
                            break; // Nothing
                        case 'circle':
                            element = besogo.svgCircle(x, y, color);
                            break;
                        case 'square':
                            element = besogo.svgSquare(x, y, color);
                            break;
                        case 'triangle':
                            element = besogo.svgTriangle(x, y, color);
                            break;
                        case 'cross':
                            element = besogo.svgCross(x, y, color);
                            break;
                        case 'block':
                            element = besogo.svgBlock(x, y, color);
                            break;
                        case 'label':
                            element = besogo.svgLabel(x, y, stone, editor.getLabel());
                            break;
                    } // END switch (tool)
                    if (element) {
                        element.setAttribute('visibility', 'hidden');
                        group.appendChild(element);
                        hoverLayer[ fromXY(i, j) ] = element;
                    }
                } // END for j
            } // END for i
        } // END else

        svg.replaceChild(group, hoverGroup); // Replace the hover layer group
        hoverGroup = group;
    } // END function redrawHover

    function svgPos(x) {  // Converts (x, y) coordinates to SVG position
        return BOARD_MARGIN + CELL_SIZE/2 + (x-1) * CELL_SIZE;
    }

    function fromXY(x, y) { // Converts (x, y) coordinates to linear index
        return (x - 1)*sizeY + (y - 1);
    }
};

besogo.makeHintPanel = function(container, editor) {
    'use strict';
    container.appendChild(document.getElementById("title"));
    container.appendChild(document.getElementById("output"));
}

besogo.makeCommentPanel = function(container, editor) {
    'use strict';
    var infoTexts = {}, // Holds text nodes for game info properties
        gameInfoTable = document.createElement('table'),
        gameInfoEdit = document.createElement('table'),
        commentBox = document.createElement('div'),
        commentEdit = document.createElement('textarea'),
        playerInfoOrder = 'PW WR WT PB BR BT'.split(' '),
        infoOrder = 'HA KM RU TM OT GN EV PC RO DT RE ON GC AN US SO CP'.split(' '),
        infoIds = {
            PW: 'White Player',
            WR: 'White Rank',
            WT: 'White Team',
            PB: 'Black Player',
            BR: 'Black Rank',
            BT: 'Black Team',

            HA: 'Handicap',
            KM: 'Komi',
            RU: 'Rules',
            TM: 'Timing',
            OT: 'Overtime',

            GN: 'Game Name',
            EV: 'Event',
            PC: 'Place',
            RO: 'Round',
            DT: 'Date',

            RE: 'Result',
            ON: 'Opening',
            GC: 'Comments',

            AN: 'Annotator',
            US: 'Recorder',
            SO: 'Source',
            CP: 'Copyright'
        };

    container.appendChild(makeInfoButton());
    container.appendChild(makeInfoEditButton());
    container.appendChild(makeCommentButton());
    container.appendChild(gameInfoTable);
    container.appendChild(gameInfoEdit);
    infoTexts.C = document.createTextNode('');
    container.appendChild(commentBox);
    commentBox.appendChild(infoTexts.C);
    container.appendChild(commentEdit);

    commentEdit.onblur = function() {
        editor.setComment(commentEdit.value);
    };
    commentEdit.addEventListener('keydown', function(evt) {
        evt = evt || window.event;
        evt.stopPropagation(); // Stop keydown propagation when in focus
    });

    editor.addListener(update);
    update({ navChange: true, gameInfo: editor.getGameInfo() });
    gameInfoEdit.style.display = 'none'; // Hide game info editting table initially

    function update(msg) {
        var temp; // Scratch for strings

        if (msg.navChange) {
            temp = editor.getCurrent().comment || '';
            updateText(commentBox, temp, 'C');
            if (editor.getCurrent() === editor.getRoot() &&
                gameInfoTable.firstChild &&
                gameInfoEdit.style.display === 'none') {
                    gameInfoTable.style.display = 'table';
            } else {
                gameInfoTable.style.display = 'none';
            }
            commentEdit.style.display = 'none';
            commentBox.style.display = 'block';
        } else if (msg.comment !== undefined) {
            updateText(commentBox, msg.comment, 'C');
            commentEdit.value = msg.comment;
        }

        if (msg.gameInfo) { // Update game info
            updateGameInfoTable(msg.gameInfo);
            updateGameInfoEdit(msg.gameInfo);
        }
    } // END function update

    function updateGameInfoTable(gameInfo) {
        var table = document.createElement('table'),
            i, id, row, cell, text; // Scratch iteration variable

        table.className = 'besogo-gameInfo';
        for (i = 0; i < infoOrder.length ; i++) { // Iterate in specified order
            id = infoOrder[i];

            if (gameInfo[id]) { // Only add row if property exists
                row = document.createElement('tr');
                table.appendChild(row);

                cell = document.createElement('td');
                cell.appendChild(document.createTextNode(infoIds[id]));
                row.appendChild(cell);

                cell = document.createElement('td');
                text = document.createTextNode(gameInfo[id]);
                cell.appendChild(text);
                row.appendChild(cell);
            }
        }
        if (!table.firstChild || gameInfoTable.style.display === 'none') {
            table.style.display = 'none'; // Do not display empty table or if already hidden
        }
        container.replaceChild(table, gameInfoTable);
        gameInfoTable = table;
    }

    function updateGameInfoEdit(gameInfo) {
        var table = document.createElement('table'),
            infoTableOrder = playerInfoOrder.concat(infoOrder),
            i, id, row, cell, text;

        table.className = 'besogo-gameInfo';
        for (i = 0; i < infoTableOrder.length ; i++) { // Iterate in specified order
            id = infoTableOrder[i];
            row = document.createElement('tr');
            table.appendChild(row);

            cell = document.createElement('td');
            cell.appendChild(document.createTextNode(infoIds[id]));
            row.appendChild(cell);

            cell = document.createElement('td');
            text = document.createElement('input');
            if (gameInfo[id]) {
                text.value = gameInfo[id];
            }
            text.onblur = function(t, id) {
                return function() { // Commit change on blur
                    editor.setGameInfo(t.value, id);
                };
            }(text, id);
            text.addEventListener('keydown', function(evt) {
                evt = evt || window.event;
                evt.stopPropagation(); // Stop keydown propagation when in focus
            });
            cell.appendChild(text);
            row.appendChild(cell);
        }
        if (gameInfoEdit.style.display === 'none') {
            table.style.display = 'none'; // Hide if already hidden
        }
        container.replaceChild(table, gameInfoEdit);
        gameInfoEdit = table;
    }

    function updateText(parent, text, id) {
        var textNode = document.createTextNode(text);
        parent.replaceChild(textNode, infoTexts[id]);
        infoTexts[id] = textNode;
    }

    function makeInfoButton() {
        var button = document.createElement('input');
        button.type = 'button';
        button.value = 'Info';
        button.title = 'Show/hide game info';

        button.onclick = function() {
            if (gameInfoTable.style.display === 'none' && gameInfoTable.firstChild) {
                gameInfoTable.style.display = 'table';
            } else {
                gameInfoTable.style.display = 'none';
            }
            gameInfoEdit.style.display = 'none';
        };
        return button;
    }

    function makeInfoEditButton() {
        var button = document.createElement('input');
        button.type = 'button';
        button.value = 'Edit Info';
        button.title = 'Edit game info';

        button.onclick = function() {
            if (gameInfoEdit.style.display === 'none') {
                gameInfoEdit.style.display = 'table';
            } else {
                gameInfoEdit.style.display = 'none';
            }
            gameInfoTable.style.display = 'none';
        };
        return button;
    }

    function makeCommentButton() {
        var button = document.createElement('input');
        button.type = 'button';
        button.value = 'Comment';
        button.title = 'Edit comment';

        button.onclick = function() {
            if (commentEdit.style.display === 'none') { // Comment edit box hidden
                commentBox.style.display = 'none'; // Hide static comment display
                gameInfoTable.style.display = 'none'; // Hide game info table
                commentEdit.value = editor.getCurrent().comment;
                commentEdit.style.display = 'block'; // Show comment edit box
            } else { // Comment edit box open
                commentEdit.style.display = 'none'; // Hide comment edit box
                commentBox.style.display = 'block'; // Show static comment display
            }
        };
        return button;
    }

};

besogo.makeControlPanel = function(container, editor) {
    'use strict';
    var leftElements = [], // SVG elements for previous node buttons
        rightElements = [], // SVG elements for next node buttons
        siblingElements = [], // SVG elements for sibling buttons
        variantStyleButton, // Button for changing variant style
        hideVariantButton, // Button for toggling show/hide variants
        childVariantElement, // SVG element for child style variants
        siblingVariantElement, // SVG element for sibling style variants
        hideVariantElement; // SVG element for hiding variants

    drawNavButtons();
    drawStyleButtons();

    makeButtonText('Delete', 'Remove branch', editor.cutCurrent);
    if (typeof submit !== "undefined") {
        makeButtonText('Submit', 'Submit guess', submit);
    }

    // Creates text button
    function makeButtonText(text, tip, callback) {
        var button = document.createElement('input');
        button.type = 'button';
        button.value = text;
        button.id = text;
        button.title = tip;
        button.onclick = callback;
        container.appendChild(button);
    }

    editor.addListener(update);
    update({ navChange: true, variantStyle: editor.getVariantStyle() }); // Initialize

    // Callback for variant style and nav state changes
    function update(msg) {
        var current;

        if (msg.variantStyle !== undefined) {
            updateStyleButtons(msg.variantStyle);
        }

        if (msg.navChange || msg.treeChange) { // Update the navigation buttons
            current = editor.getCurrent();
            if (current.parent) { // Has parent
                arraySetColor(leftElements, 'black');
                if (current.parent.children.length > 1) { // Has siblings
                    arraySetColor(siblingElements, 'black');
                } else { // No siblings
                    arraySetColor(siblingElements, besogo.GREY);
                }
            } else { // No parent
                arraySetColor(leftElements, besogo.GREY);
                arraySetColor(siblingElements, besogo.GREY);
            }
            if (current.children.length) { // Has children
                arraySetColor(rightElements, 'black');
            } else { // No children
                arraySetColor(rightElements, besogo.GREY);
            }
        }

        function updateStyleButtons(style) { // Updates the variant style buttons
            if (style % 2) { // Sibling style variants
                childVariantElement.setAttribute('fill', 'black');
                siblingVariantElement.setAttribute('fill', besogo.BLUE);
                variantStyleButton.title = 'Variants: child/[sibling]';
            } else { // Child style variants
                childVariantElement.setAttribute('fill', besogo.BLUE);
                siblingVariantElement.setAttribute('fill', besogo.RED);
                variantStyleButton.title = 'Variants: [child]/sibling';
            }
            if (style >= 2) { // Hide auto-markup for variants
                hideVariantElement.setAttribute('visibility', 'visible');
                hideVariantButton.title = 'Variants: show/[hide]';
            } else { // Show auto-markup for variants
                hideVariantElement.setAttribute('visibility', 'hidden');
                hideVariantButton.title = 'Variants: [show]/hide';
            }
        }

        function arraySetColor(list, color) { // Changes fill color of list of svg elements
            var i;
            for (i = 0; i < list.length; i++) {
                list[i].setAttribute('fill', color);
            }
        }
    } // END function update

    // Draws the navigation buttons
    function drawNavButtons() {
        leftElements.push(makeNavButton('First node',
            '5,10 5,90 25,90 25,50 95,90 95,10 25,50 25,10',
            function() {
                editor.prevNode(-1);
            })
        );
        /* Removed jump 10 buttons
        leftElements.push(makeNavButton('Jump back',
            '95,10 50,50 50,10 5,50 50,90 50,50 95,90',
            function() {
                editor.prevNode(10);
            })
        ); */
        leftElements.push(makeNavButton('Previous node', '85,10 85,90 15,50', function() {
            editor.prevNode(1);
        }));

        rightElements.push(makeNavButton('Next node', '15,10 15,90 85,50', function() {
            editor.nextNode(1);
        }));
        /* Removed jump 10 buttons
        rightElements.push(makeNavButton('Jump forward',
            '5,10 50,50 50,10 95,50 50,90 50,50 5,90',
            function() {
                editor.nextNode(10);
            })
        ); */
        rightElements.push(makeNavButton('Last node',
            '95,10 95,90 75,90 75,50 5,90 5,10 75,50 75,10',
            function() {
                editor.nextNode(-1);
            })
        );

        siblingElements.push(makeNavButton('Previous sibling', '10,85 90,85 50,15', function() {
            editor.nextSibling(-1);
        }));
        siblingElements.push(makeNavButton('Next sibling', '10,15 90,15 50,85', function() {
            editor.nextSibling(1);
        }));

        function makeNavButton(tooltip, pointString, action) { // Creates a navigation button
            var button = document.createElement('button'),
                svg = makeButtonContainer(),
                element = besogo.svgEl("polygon", {
                    points: pointString,
                    stroke: 'none',
                    fill: 'black'
                });

            button.title = tooltip;
            button.onclick = action;
            button.appendChild(svg);
            svg.appendChild(element);
            container.appendChild(button);

            return element;
        } // END function makeNavButton
    } // END function drawNavButtons

    // Draws the variant style buttons
    function drawStyleButtons() {
        var svg, element, coordStyleButton, zoomInButton, zoomOutButton, darkThemeButton, helpButton;

        variantStyleButton = document.createElement('button');
        variantStyleButton.onclick = function() {
            editor.toggleVariantStyle(false); // Toggles child/sibling variants
        };
        container.appendChild(variantStyleButton);
        svg = makeButtonContainer();
        variantStyleButton.appendChild(svg);
        element = besogo.svgEl("path", {
            d: 'm75,25h-50l50,50',
            stroke: 'black',
            "stroke-width": 5,
            fill: 'none'
        });
        svg.appendChild(element);
        childVariantElement = besogo.svgEl('circle', {
            cx: 25,
            cy: 25,
            r: 20,
            stroke: 'none'
        });
        svg.appendChild(childVariantElement);
        siblingVariantElement = besogo.svgEl('circle', {
            cx: 75,
            cy: 25,
            r: 20,
            stroke: 'none'});
        svg.appendChild(siblingVariantElement);
        element = besogo.svgEl('circle', {
            cx: 75,
            cy: 75,
            r: 20,
            fill: besogo.RED,
            stroke: 'none'
        });
        svg.appendChild(element);

        hideVariantButton = document.createElement('button');
        hideVariantButton.onclick = function() {
            editor.toggleVariantStyle(true); // Toggles show/hide variants
        };
        container.appendChild(hideVariantButton);
        svg = makeButtonContainer();
        hideVariantButton.appendChild(svg);
        svg.appendChild(besogo.svgLabel(50, 50, 'variant', 'A'));
        hideVariantElement = besogo.svgCross(50, 50, 'black');
        svg.appendChild(hideVariantElement);

        coordStyleButton = document.createElement('button');
        coordStyleButton.onclick = function() {
            editor.toggleCoordStyle(); // Toggles coordinate style
        };
        coordStyleButton.title = 'Toggle coordinates';
        container.appendChild(coordStyleButton);
        svg = makeButtonContainer();
        coordStyleButton.appendChild(svg);
        svg.appendChild(besogo.svgLabel(50, 50, 'empty', '四4'));

        zoomInButton = document.createElement('button');
        zoomInButton.onclick = editor.increaseZoom;
        zoomInButton.title = 'Zoom in';
        zoomInButton.appendChild(document.createTextNode('+'));
        container.appendChild(zoomInButton);

        zoomOutButton = document.createElement('button');
        zoomOutButton.onclick = editor.decreaseZoom;
        zoomOutButton.title = 'Zoom out';
        zoomOutButton.appendChild(document.createTextNode('−'));
        container.appendChild(zoomOutButton);

        darkThemeButton = document.createElement('button');
        darkThemeButton.onclick = function() {
            var link = document.getElementById("dark-css-link");
            link.disabled = !link.disabled;
            editor.notifyListeners({ dark: !link.disabled }) // if, after toggling, link is NOT disabled, dark mode is ON
        };
        darkThemeButton.title = 'Toggle dark theme';
        container.appendChild(darkThemeButton);
        svg = makeButtonContainer();
        darkThemeButton.appendChild(svg);
        svg.appendChild(besogo.svgLabel(50, 50, 'empty', '☽'));

        helpButton = document.createElement('button');
        helpButton.onclick = function() {
            document.getElementById("help-modal").style.display = "block";
        };
        helpButton.title = 'Show help';
        container.appendChild(helpButton);
        svg = makeButtonContainer();
        helpButton.appendChild(svg);
        svg.appendChild(besogo.svgLabel(50, 50, 'empty', '?'));
    } // END function drawStyleButtons

    // Makes an SVG container for the button graphics
    function makeButtonContainer() {
        return besogo.svgEl('svg', {
            width: '100%',
            height: '100%',
            viewBox: "0 0 100 100"
        });
    }
};

(function() { // Coordinates
'use strict';

// Parent object to hold coordinate system helper functions
besogo.coord = {};

// Null function for no coordinate system
besogo.coord.none = function(sizeX, sizeY) {
    return false;
};

// Western, chess-like, "A1" coordinate system
besogo.coord.western = function(sizeX, sizeY) {
    var labels = { x: [], y: [] }, i;
    for (i = 1; i <= sizeX; i++) {
        labels.x[i] = numberToLetter(i);
    }
    for (i = 1; i <= sizeY; i++) {
        labels.y[i] = (sizeY - i + 1) + '';
    }
    return labels;
};

// Simple purely numeric coordinate system
besogo.coord.numeric = function(sizeX, sizeY) {
    var labels = { x: [], y: [] }, i;
    for (i = 1; i <= sizeX; i++) {
        labels.x[i] = i + '';
    }
    for (i = 1; i <= sizeY; i++) {
        labels.y[i] = i + '';
    }
    return labels;
};

// Pierre Audouard corner-relative coordinate system
besogo.coord.pierre = function(sizeX, sizeY) {
    var labels = { x: [], xb: [], y: [], yb: [] }, i;
    for (i = 1; i <= sizeX / 2; i++) {
        labels.x[i] = 'a' + i;
        labels.x[sizeX - i + 1] = 'b' + i;
        labels.xb[i] = 'd' + i;
        labels.xb[sizeX - i + 1] = 'c' + i;
    }
    if (sizeX % 2) {
        i = Math.ceil(sizeX / 2);
        labels.x[i] = 'a';
        labels.xb[i] = 'c';
    }
    for (i = 1; i <= sizeY / 2; i++) {
        labels.y[i] = 'a' + i;
        labels.y[sizeY - i + 1] = 'd' + i;
        labels.yb[i] = 'b' + i;
        labels.yb[sizeY - i + 1] = 'c' + i;
    }
    if (sizeY % 2) {
        i = Math.ceil(sizeY / 2);
        labels.y[i] = 'd';
        labels.yb[i] = 'b';
    }
    return labels;
};

// Corner-relative, alpha-numeric, coordinate system
besogo.coord.corner = function(sizeX, sizeY) {
    var labels = { x: [], y: [] }, i;
    for (i = 1; i <= sizeX; i++) {
        if (i < (sizeX / 2) + 1) {
            labels.x[i] = numberToLetter(i);
        } else {
            labels.x[i] = (sizeX - i + 1) + '';
        }
    }
    for (i = 1; i <= sizeY; i++) {
        labels.y[i] = (sizeY - i + 1) + '';
        if (i > (sizeY / 2)) {
            labels.y[i] = numberToLetter(sizeY - i + 1);
        } else {
            labels.y[i] = i + '';
        }
    }
    return labels;
};

// Corner-relative, numeric and CJK, coordinate system
besogo.coord.eastcor = function(sizeX, sizeY) {
    var labels = { x: [], y: [] }, i;
    for (i = 1; i <= sizeX; i++) {
        if (i < (sizeX / 2) + 1) {
            labels.x[i] = numberToCJK(i);
        } else {
            labels.x[i] = (sizeX - i + 1) + '';
        }
    }
    for (i = 1; i <= sizeY; i++) {
        labels.y[i] = (sizeY - i + 1) + '';
        if (i > (sizeY / 2)) {
            labels.y[i] = numberToCJK(sizeY - i + 1);
        } else {
            labels.y[i] = i + '';
        }
    }
    return labels;
};

// Eastern, numeric and CJK, coordinate system
besogo.coord.eastern = function(sizeX, sizeY) {
    var labels = { x: [], y: [] }, i;
    for (i = 1; i <= sizeX; i++) {
        labels.x[i] = i + ''; // Columns are numeric
    }
    for (i = 1; i <= sizeY; i++) {
        labels.y[i] = numberToCJK(i);
    }

    return labels;
};

// Helper for converting numeric coord to letter (skipping I)
function numberToLetter(number) {
    return 'ABCDEFGHJKLMNOPQRSTUVWXYZ'.charAt((number - 1) % 25);
}

// Helper for converting numeric coord to CJK symbol
function numberToCJK(number) {
    var label = '',
        cjk = '一二三四五六七八九';

    if (number >= 20) { // 20 and larger
        label = cjk.charAt(number / 10 - 1) + '十';
    } else if (number >= 10) { // 10 through 19
        label = '十';
    }
    if (number % 10) { // Ones digit if non-zero
        label = label + cjk.charAt((number - 1) % 10);
    }
    return label;
}

})(); // END closure

besogo.makeEditor = function(sizeX, sizeY) {
    'use strict';
    // Creates an associated game state tree
    var root = besogo.makeGameRoot(sizeX, sizeY),
        current = root, // Navigation cursor

        listeners = [], // Listeners of general game/editor state changes

        // Enumeration of editor tools/modes
        TOOLS = ['navOnly', // read-only navigate mode
            'auto', // auto-mode: navigate or auto-play color
            'playB', // play black stone
            'playW', // play white stone
            'addB', // setup black stone
            'addW', // setup white stone
            'addE', // setup empty stone
            'clrMark', // remove markup
            'circle', // circle markup
            'square', // square markup
            'triangle', // triangle markup
            'cross', // "X" cross markup
            'block', // filled square markup
            'label'], // label markup
        tool = 'auto', // Currently active tool (default: auto-mode)
        label = "1", // Next label that will be applied

        navHistory = [], // Navigation history

        gameInfo = {}, // Game info properties

        // Order of coordinate systems
        COORDS = 'none numeric western eastern pierre corner eastcor'.split(' '),
        coord = 'none', // Selected coordinate system
        zoom = 1.6, // Board zoom ratio

        // Possible zoom ratios when using increase and decrease functions
        ZOOM_STEPS = [1.0, 1.3, 1.5, 1.6, 1.75, 1.9],

        // Variant style: even/odd - children/siblings, <2 - show auto markup for variants
        variantStyle = 0; // 0-3, 0 is default

    return {
        navigate: navigate,// expose navigate for josekle dictionary board
        addListener: addListener,
        notifyListeners, notifyListeners,
        click: click,
        nextNode: nextNode,
        prevNode: prevNode,
        nextSibling: nextSibling,
        prevBranchPoint: prevBranchPoint,
        toggleCoordStyle: toggleCoordStyle,
        getCoordStyle: getCoordStyle,
        setCoordStyle: setCoordStyle,
        getZoom,
        setZoom,
        increaseZoom,
        decreaseZoom,
        toggleVariantStyle: toggleVariantStyle,
        getVariantStyle: getVariantStyle,
        setVariantStyle: setVariantStyle,
        getGameInfo: getGameInfo,
        setGameInfo: setGameInfo,
        setComment: setComment,
        getTool: getTool,
        setTool: setTool,
        getLabel: getLabel,
        setLabel: setLabel,
        getVariants: getVariants, // Returns variants of current node
        getCurrent: getCurrent,
        setCurrent: setCurrent,
        cutCurrent: cutCurrent,
        check: check,
        promote: promote,
        demote: demote,
        getRoot: getRoot,
        loadRoot: loadRoot // Loads new game state
    };

    // Returns the active tool
    function getTool() {
        return tool;
    }

    // Sets the active tool, returns false if failed
    function setTool(set) {
        // Toggle label mode if already label tool already selected
        if (set === 'label' && set === tool) {
            if ( /^-?\d+$/.test(label) ) { // If current label is integer
                setLabel('A'); // Toggle to characters
            } else {
                setLabel('1'); // Toggle back to numbers
            }
            return true; // Notification already handled by setLabel
        }
        // Set the tool only if in list and actually changed
        if (TOOLS.indexOf(set) !== -1 && tool !== set) {
            tool = set;
            notifyListeners({ tool: tool, label: label }); // Notify tool change
            return true;
        }
        return false;
    }

    // Gets the next label to apply
    function getLabel() {
        return label;
    }

    // Sets the next label to apply and sets active tool to label
    function setLabel(set) {
        if (typeof set === 'string') {
            set = set.replace(/\s/g, ' ').trim(); // Convert all whitespace to space and trim
            label = set || "1"; // Default to "1" if empty string
            tool = 'label'; // Also change current tool to label
            notifyListeners({ tool: tool, label: label }); // Notify tool/label change
        }
    }

    // Toggle the coordinate style
    function toggleCoordStyle() {
        coord = COORDS[(COORDS.indexOf(coord) + 1) % COORDS.length];
        notifyListeners({ coord: coord });
    }

    // Gets the current coordinate style
    function getCoordStyle() {
        return coord;
    }

    // Sets the coordinate system style
    function setCoordStyle(setCoord) {
        if (besogo.coord[setCoord]) {
            coord = setCoord;
            notifyListeners({ coord: setCoord });
        }
    }

    // Get the current zoom ratio
    function getZoom() {
        return zoom;
    }

    // Set the zoom ratio
    function setZoom(setZoom) {
        zoom = setZoom;
        notifyListeners({ zoom });
    }

    // Increases the zoom ratio to the next zoom step
    function increaseZoom() {
        let nextStep = ZOOM_STEPS.find((step) => step > zoom);
        if (nextStep) {
            setZoom(nextStep);
        }
    }

    // Decreases the zoom ratio to the previous zoom step
    function decreaseZoom() {
        let index = ZOOM_STEPS.length;
        while (--index && ZOOM_STEPS[index] >= zoom);

        if (index > -1) {
            setZoom(ZOOM_STEPS[index]);
        }
    }

    // Toggles the style for showing variants
    function toggleVariantStyle(toggleShow) {
        var childStyle = variantStyle % 2, // 0: children, 1: siblings
            showStyle = variantStyle - childStyle; // 0: show auto-markup, 2: hide
        if (toggleShow) { // Truthy input toggles showing of auto-markup
            showStyle = (showStyle + 2) % 4; // 0 => 2 or 2 => 0
        } else { // Falsy input toggles child vs sibling style
            childStyle = (childStyle + 1) % 2; // 0 => 1 or 1 => 0
        }
        variantStyle = childStyle + showStyle;
        notifyListeners({ variantStyle: variantStyle, markupChange: true });
    }

    // Returns the variant style
    function getVariantStyle() {
        return variantStyle;
    }

    // Directly sets the variant style
    function setVariantStyle(style) {
        if (style === 0 || style === 1 || style === 2 || style === 3) {
            variantStyle = style;
            notifyListeners({ variantStyle: variantStyle, markupChange: true });
        }
    }

    function getGameInfo() {
        return gameInfo;
    }

    function setGameInfo(info, id) {
        if (id) {
            gameInfo[id] = info;
        } else {
            gameInfo = info;
        }
        notifyListeners({ gameInfo: gameInfo });
    }

    function setComment(text) {
        text = text.trim(); // Trim whitespace and standardize line breaks
        text = text.replace(/\r\n/g,'\n').replace(/\n\r/g,'\n').replace(/\r/g,'\n');
        text.replace(/\f\t\v\u0085\u00a0/g,' '); // Convert other whitespace to space
        current.comment = text;
        notifyListeners({ comment: text });
    }

    // Returns variants of the current node according to the set style
    function getVariants() {
        if (variantStyle >= 2) { // Do not show variants if style >= 2
            return [];
        }
        if (variantStyle === 1) { // Display sibling variants
            // Root node does not have parent nor siblings
            return current.parent ? current.parent.children : [];
        }
        return current.children; // Otherwise, style must be 0, display child variants
    }

    // Returns the currently active node in the game state tree
    function getCurrent() {
        return current;
    }

    // Returns the root of the game state tree
    function getRoot() {
        return root;
    }

    function loadRoot(load) {
        root = load;
        current = load;
        notifyListeners({ treeChange: true, navChange: true, stoneChange: true });
    }

    // Navigates forward num nodes (to the end if num === -1)
    function nextNode(num) {
        if (current.children.length === 0) { // Check if no children
            return false; // Do nothing if no children (avoid notification)
        }
        while (current.children.length > 0 && num !== 0) {
            if (navHistory.length) { // Non-empty navigation history
                current = navHistory.pop();
            } else { // Empty navigation history
                current = current.children[0]; // Go to first child
            }
            num--;
        }
        // Notify listeners of navigation (with no tree edits)
        notifyListeners({ navChange: true }, true); // Preserve history
    }

    // Navigates backward num nodes (to the root if num === -1)
    function prevNode(num) {
        if (current.parent === null) { // Check if root
            return false; // Do nothing if already at root (avoid notification)
        }
        while (current.parent && num !== 0) {
            navHistory.push(current); // Save current into navigation history
            current = current.parent;
            num--;
        }
        // Notify listeners of navigation (with no tree edits)
        notifyListeners({ navChange: true }, true); // Preserve history
    }

    // Cyclically switches through siblings
    function nextSibling(change) {
        var siblings,
            i = 0;

        if (current.parent) {
            siblings = current.parent.children;

            // Exit early if only child
            if (siblings.length === 1) {
                return;
            }

            // Find index of current amongst siblings
            i = siblings.indexOf(current);

            // Apply change cyclically
            i = (i + change) % siblings.length;
            if (i < 0) {
                i += siblings.length;
            }

            current = siblings[i];
            // Notify listeners of navigation (with no tree edits)
            notifyListeners({ navChange: true });
        }
    }

    // Return to the previous branch point
    function prevBranchPoint(change) {
        if ( current.parent === null ) { // Check if root
          return false; // Do nothing if already at root
        }

        navHistory.push(current); // Save starting position in case we do not find a branch point

        while ( current.parent && current.parent.children.length === 1 ) { // Traverse backwards until we find a sibling
            current = current.parent;
        }

        if ( current.parent ) {
            current = current.parent;
            notifyListeners({ navChange: true });
        } else {
            current = navHistory.pop(current);
            return false;
        }

    }

    // Sets the current node
    function setCurrent(node) {
        if (current !== node) {
            current = node;
            // Notify listeners of navigation (with no tree edits)
            notifyListeners({ navChange: true });
        }
    }

    // Removes current branch from the tree
    function cutCurrent() {
        var parent = current.parent;
        if (tool === 'navOnly') {
            return; // Tree editing disabled in navOnly mode
        }
        if (parent) {
            if (confirm("Delete this branch?") === true) {
                parent.removeChild(current);
                current = parent;
                // Notify navigation and tree edited
                notifyListeners({ treeChange: true, navChange: true });
            }
        }
    }

    // Raises current variation to a higher precedence
    function promote() {
        if (tool === 'navOnly') {
            return; // Tree editing disabled in navOnly mode
        }
        if (current.parent && current.parent.promote(current)) {
            notifyListeners({ treeChange: true }); // Notify tree edited
        }
    }

    // Drops current variation to a lower precedence
    function demote() {
        if (tool === 'navOnly') {
            return; // Tree editing disabled in navOnly mode
        }
        if (current.parent && current.parent.demote(current)) {
            notifyListeners({ treeChange: true }); // Notify tree edited
        }
    }

    // Handle click with application of selected tool
    function click(i, j, ctrlKey, shiftKey) {
        switch(tool) {
            case 'navOnly':
                navigate(i, j, shiftKey);
                break;
            case 'auto':
                if (!navigate(i, j, shiftKey) && !shiftKey) { // Try to navigate to (i, j)
                    playMove(i, j, 0, ctrlKey); // Play auto-color move if navigate fails
                }
                break;
            case 'playB':
                playMove(i, j, -1, ctrlKey); // Black move
                break;
            case 'playW':
                playMove(i, j, 1, ctrlKey); // White move
                break;
            case 'addB':
                if (ctrlKey) {
                    playMove(i, j, -1, true); // Play black
                } else {
                    placeSetup(i, j, -1); // Set black
                }
                break;
            case 'addW':
                if (ctrlKey) {
                    playMove(i, j, 1, true); // Play white
                } else {
                    placeSetup(i, j, 1); // Set white
                }
                break;
            case 'addE':
                placeSetup(i, j, 0);
                break;
            case 'clrMark':
                setMarkup(i, j, 0);
                break;
            case 'circle':
                setMarkup(i, j, 1);
                break;
            case 'square':
                setMarkup(i, j, 2);
                break;
            case 'triangle':
                setMarkup(i, j, 3);
                break;
            case 'cross':
                setMarkup(i, j, 4);
                break;
            case 'block':
                setMarkup(i, j, 5);
                break;
            case 'label':
                setMarkup(i, j, label);
                break;
        }
    }

    // Navigates to child with move at (x, y), searching tree if shift key pressed
    // Returns true is successful, false if not
    function navigate(x, y, shiftKey) {
        var i, move,
            children = current.children;

        // Look for move across children
        for (i = 0; i < children.length; i++) {
            move = children[i].move;
            if (shiftKey) { // Search for move in branch
                if (jumpToMove(x, y, children[i])) {
                    return true;
                }
            } else if (move && move.x === x && move.y === y) {
                current = children[i]; // Navigate to child if found
                notifyListeners({ navChange: true }); // Notify navigation (with no tree edits)
                return true;
            }
        }

        if (shiftKey && jumpToMove(x, y, root, current)) {
            return true;
        }
        return false;
    }

    // Recursive function for jumping to move with depth-first search
    function jumpToMove(x, y, start, end) {
        var i, move,
            children = start.children;

        if (end && end === start) {
            return false;
        }

        move = start.move;
        if (move && move.x === x && move.y === y) {
            current = start;
            notifyListeners({ navChange: true }); // Notify navigation (with no tree edits)
            return true;
        }

        for (i = 0; i < children.length; i++) {
            if (jumpToMove(x, y, children[i], end)) {
                return true;
            }
        }
        return false;
    }

    // Plays a move at the given color and location
    // Set allowAll to truthy to allow illegal moves
    function playMove(i, j, color, allowAll) {
        var next;
        // Check if current node is immutable or root
        if ( !current.isMutable('move') || !current.parent ) {
            next = current.makeChild(); // Create a new child node
            if (next.playMove(i, j, color, allowAll)) { // Play in new node
                // Keep (add to game state tree) only if move succeeds
                current.addChild(next);
                current = next;
                if (current.getMarkup(i, j) < 0) { // If there is a green hint
                    if ( -current.getMarkup(i, j) !== getMoveNumber(current)) {
                        // Clear green hint if inconsistent
                        current.addMarkup(i, j, 0);
                    }
                } else if (current.getMarkup(i, j) === 2) {
                    // Clear purple hints as they are played
                    current.addMarkup(i, j, 0);
                }
                // Notify tree change, navigation, and stone change
                notifyListeners({ treeChange: true, navChange: true, stoneChange: true });
            }
        // Current node is mutable and not root
        } else if(current.playMove(i, j, color, allowAll)) { // Play in current
            // Only need to update if move succeeds
            notifyListeners({ stoneChange: true }); // Stones changed
        }

        function getMoveNumber(node) {
            var i = 0;
            while (node.parent) {
                node = node.parent;
                i++;
            }
            return i;
        }
    }

    // Places a setup stone at the given color and location
    function placeSetup(i, j, color) {
        var next;
        if (color === current.getStone(i, j)) { // Compare setup to current
            if (color !== 0) {
                color = 0; // Same as current indicates removal desired
            } else { // Color and current are both empty
                return; // No change if attempting to set empty to empty
            }
        }
        // Check if current node can accept setup stones
        if (!current.isMutable('setup')) {
            next = current.makeChild(); // Create a new child node
            if (next.placeSetup(i, j, color)) { // Place setup stone in new node
                // Keep (add to game state tree) only if change occurs
                current.addChild(next);
                current = next;
                // Notify tree change, navigation, and stone change
                notifyListeners({ treeChange: true, navChange: true, stoneChange: true });
            }
        } else if(current.placeSetup(i, j, color)) { // Try setup in current
            // Only need to update if change occurs
            notifyListeners({ stoneChange: true }); // Stones changed
        }
    }

    // Sets the markup at the given location and place
    function setMarkup(i, j, mark) {
        var temp; // For label incrementing
        if (mark === current.getMarkup(i, j)) { // Compare mark to current
            if (mark !== 0) {
                mark = 0; // Same as current indicates removal desired
            } else { // Mark and current are both empty
                return; // No change if attempting to set empty to empty
            }
        }
        if (current.addMarkup(i, j, mark)) { // Try to add the markup
            if (typeof mark === 'string') { // If markup is a label, increment the label
                if (/^-?\d+$/.test(mark)) { // Integer number label
                    temp = +mark; // Convert to number
                    // Increment and convert back to string
                    setLabel( "" + (temp + 1) );
                } else if ( /[A-Za-z]$/.test(mark) ) { // Ends with [A-Za-z]
                    // Get the last character in the label
                    temp = mark.charAt(mark.length - 1);
                    if (temp === 'z') { // Cyclical increment
                        temp = 'A'; // Move onto uppercase letters
                    } else if (temp === 'Z') {
                        temp = 'a'; // Move onto lowercase letters
                    } else {
                        temp = String.fromCharCode(temp.charCodeAt() + 1);
                    }
                    // Replace last character of label with incremented char
                    setLabel( mark.slice(0, mark.length - 1) + temp );
                }
            }
            notifyListeners({ markupChange: true }); // Notify markup change
        }
    }

    // Sets Josekle hints, mark = 1 / 2 / 3, for correct / hint / miss
    function setHints(path, start, mark) {
        var i,
            x = path[start].move.x,
            y = path[start].move.y;
        for (i = start; i < path.length; i++) {
            path[i].addMarkup(x, y, mark);
        }
        root.addMarkup(x, y, mark);
    }

    // Check correctness of current given solution
    function check(solution) {
        var i, node,
            path = [],
            hints = [];

        node = current;
        while (node.move !== null) {
            path.push(node);
            node = node.parent;
        }
        path.reverse();

        for (i = 0; i < path.length; i++) {
            path[i].submitted = true;
            node = path[i].move;
            if (i < solution.length && node.x === solution[i].x && node.y === solution[i].y) {
                hints.push(GREEN);
                setHints(path, i, -(i + 1));
            } else if (solution.find(move => move.x === node.x && move.y === node.y)) {
                hints.push(YELLOW);
                setHints(path, i, 2);
            } else {
                hints.push(WHITE);
                setHints(path, i, 3);
            }
        }

        notifyListeners({ markupChange: true, treeChange: true });
        return hints;
    }

    // Adds a listener (by call back func) that will be notified on game/editor state changes
    function addListener(listener) {
        listeners.push(listener);
    }

    // Notify listeners with the given message object
    //  Data sent to listeners:
    //    tool: changed tool selection
    //    label: changed next label
    //    coord: changed coordinate system
    //    variantStyle: changed variant style
    //    gameInfo: changed game info
    //    comment: changed comment in current node
    //  Flags sent to listeners:
    //    treeChange: nodes added or removed from tree
    //    navChange: current switched to different node
    //    stoneChange: stones modified in current node
    //    markupChange: markup modified in current node
    function notifyListeners(msg, keepHistory) {
        var i;
        if (!keepHistory && msg.navChange) {
            navHistory = []; // Clear navigation history
        }
        for (i = 0; i < listeners.length; i++) {
            listeners[i](msg);
        }
    }
};

besogo.makeFilePanel = function(container, editor) {
    'use strict';
    var fileChooser, // Reference to the file chooser element
        element, // Scratch variable for creating elements
        WARNING = "Everything not saved will be lost";

    makeNewBoardButton(9); // New 9x9 board button
    makeNewBoardButton(13); // New 13x13 board button
    makeNewBoardButton(19); // New 19x19 board button
    makeNewBoardButton('?'); // New custom board button

    // Hidden file chooser element
    fileChooser = makeFileChooser();
    container.appendChild(fileChooser);

    // Load file button
    element = document.createElement('input');
    element.type = 'button';
    element.value = 'Open';
    element.title = 'Import SGF';
    element.onclick = function() { // Bind click to the hidden file chooser
        fileChooser.click();
    };
    container.appendChild(element);

    // Save file button
    element = document.createElement('input');
    element.type = 'button';
    element.value = 'Save';
    element.title = 'Export SGF';
    element.onclick = function() {
        var fileName = prompt('Save file as', 'export.sgf');
        if (fileName) { // Canceled or empty string does nothing
            saveFile(fileName, besogo.composeSgf(editor));
        }
    };
    container.appendChild(element);

    // Export puzzles button
    element = document.createElement('input');
    element.type = 'button';
    element.value = 'Export';
    element.title = 'Export puzzles.js';
    element.onclick = function() {
        var fileName = prompt('Save file as', 'puzzles.js');
        if (fileName) { // Canceled or empty string does nothing
            saveFile(fileName, besogo.exportPuzzles(editor));
        }
    };
    container.appendChild(element);


    // Makes a new board button
    function makeNewBoardButton(size) {
        var button = document.createElement('input');
        button.type = 'button';
        button.value = size + "x" + size;
        if (size === '?') { // Make button for custom sized board
            button.title = "New custom size board";
            button.onclick = function() {
                var input = prompt("Enter custom size for new board" + "\n" + WARNING, "19:19"),
                    size;
                if (input) { // Canceled or empty string does nothing
                    size = besogo.parseSize(input);
                    editor.loadRoot(besogo.makeGameRoot(size.x, size.y));
                    editor.setGameInfo({});
                }
            };
        } else { // Make button for fixed size board
            button.title = "New " + size + "x" + size + " board";
            button.onclick = function() {
                if (confirm(button.title + "?\n" + WARNING)) {
                    editor.loadRoot(besogo.makeGameRoot(size, size));
                    editor.setGameInfo({});
                }
            };
        }
        container.appendChild(button);
    }

    // Creates the file selector
    function makeFileChooser() {
        var chooser = document.createElement('input');
        chooser.type = 'file';
        chooser.style.display = 'none'; // Keep hidden
        chooser.onchange = readFile; // Read, parse and load on file select
        return chooser;
    }

    // Reads, parses and loads an SGF file
    function readFile(evt) {
        var file = evt.target.files[0], // Selected file
            reader = new FileReader(),
            newChooser = makeFileChooser(); // Create new file input to reset selection

        container.replaceChild(newChooser, fileChooser); // Replace with the reset selector
        fileChooser = newChooser;

        reader.onload = function(e){ // Parse and load game tree
            var sgf;
            try {
                sgf = besogo.parseSgf(e.target.result);
            } catch (error) {
                alert('SGF parse error at ' + error.at + ':\n' + error.message);
                return;
            }
            besogo.loadSgf(sgf, editor);
        };
        if (confirm("Load '" + file.name + "'?\n" + WARNING)) {
            reader.readAsText(file); // Initiate file read
        }
    }

    // Composes SGF file and initializes download
    function saveFile(fileName, text) {
        var link = document.createElement('a'),
            blob = new Blob([text], { encoding:"UTF-8", type:"text/plain;charset=UTF-8" });

        link.download = fileName; // Set download file name
        link.href = URL.createObjectURL(blob);
        link.style.display = 'none'; // Make link hidden
        container.appendChild(link); // Add link to ensure that clicking works
        link.click(); // Click on link to initiate download
        container.removeChild(link); // Immediately remove the link
    }
};

besogo.makeGameRoot = function(sizeX, sizeY) {
    'use strict';
    var BLACK = -1, // Stone state constants
        WHITE = 1, // Equal to -BLACK
        EMPTY = 0, // Any falsy (e.g., undefined) value is also empty

        root = { // Inherited attributes of root node
            blackCaps: 0,
            whiteCaps: 0,
            moveNumber: 0
        };

    // Initializes non-inherited attributes
    function initNode(node, parent) {
        node.parent = parent;
        node.children = [];

        node.submitted = false;
        node.move = null;
        node.setupStones = [];
        node.comment = ''; // Comment on this node
    }
    initNode(root, null); // Initialize root node with null parent

    // Plays a move, returns true if successful
    // Set allow to truthy to allow overwrite, suicide and ko
    root.playMove = function(x, y, color, allow) {
        var captures = 0, // Number of captures made by this move
            overwrite = false, // Flags whether move overwrites a stone
            prevMove, // Previous move for ko check
            testBoard, // Copy of board state to test captures, ko, and suicide
            pending, // Pending capture locations
            i; // Scratch iteration variable

        if (!this.isMutable('move')) {
            return false; // Move fails if node is immutable
        }

        if (!color) { // Falsy color indicates auto-color
            color = this.nextMove();
        }

        if (x < 1 || y < 1 || x > sizeX || y > sizeY) {
            this.move = { // Register as pass move if out of bounds
                x: 0, y: 0, // Log pass as position (0, 0)
                color: color,
                captures: 0, // Pass never captures
                overwrite: false // Pass is never an overwrite
            };
            this.lastMove = color; // Store color of last move
            this.moveNumber++; // Increment move number
            return true; // Pass move successful
        }

        if (this.getStone(x, y)) { // Check for overwrite
            if (!allow) {
                return false; // Reject overwrite move if not allowed
            }
            overwrite = true; // Otherwise, flag overwrite and proceed
        }

        testBoard = Object.create(this); // Copy board state (no need to initialize)
        pending = []; // Initialize pending capture array

        setStone(testBoard, x, y, color); // Place the move stone

        // Check for captures of surrounding chains
        captureStones(testBoard, x - 1, y, color, pending);
        captureStones(testBoard, x + 1, y, color, pending);
        captureStones(testBoard, x, y - 1, color, pending);
        captureStones(testBoard, x, y + 1, color, pending);

        captures = pending.length; // Capture count

        prevMove = this.parent ? this.parent.move : null; // Previous move played
        if (!allow && prevMove && // If previous move exists, ...
            prevMove.color === -color && // was of the opposite color, ...
            prevMove.overwrite === false && // not an overwrite, ...
            prevMove.captures === 1 && // captured exactly one stone, and if ...
            captures === 1 && // this move captured exactly one stone at the location ...
            !testBoard.getStone(prevMove.x, prevMove.y) ) { // of the previous move
                return false; // Reject ko move if not allowed
        }

        if (captures === 0) { // Check for suicide if nothing was captured
            captureStones(testBoard, x, y, -color, pending); // Invert color for suicide check
            captures = -pending.length; // Count suicide as negative captures
            if (captures < 0 && !allow) {
                return false; // Reject suicidal move if not allowed
            }
        }

        if (color * captures < 0) { // Capture by black or suicide by white
            this.blackCaps += Math.abs(captures); // Tally captures for black
        } else { // Capture by white or suicide by black
            this.whiteCaps += Math.abs(captures); // Tally captures for white
        }

        setStone(this, x, y, color); // Place the stone
        for (i = 0; i < pending.length; i++) { // Remove the captures
            setStone(this, pending[i].x, pending[i].y, EMPTY);
        }

        this.move = { // Log the move
            x: x, y: y,
            color: color,
            captures: captures,
            overwrite: overwrite
        };
        this.lastMove = color; // Store color of last move
        this.moveNumber++; // Increment move number
        return true;
    }; // END func root.playMove

    // Check for and perform capture of opposite color chain at (x, y)
    function captureStones(board, x, y, color, captures) {
        var pending = [],
            i; // Scratch iteration variable

        if ( !recursiveCapture(board, x, y, color, pending) ) { // Captured chain found
            for (i = 0; i < pending.length; i++) { // Remove captured stones
                setStone(board, pending[i].x, pending[i].y, EMPTY);
                captures.push(pending[i]);
            }
        }
    }

    // Recursively builds a chain of pending captures starting from (x, y)
    // Stops and returns true if chain has liberties
    function recursiveCapture(board, x, y, color, pending) {
        var i; // Scratch iteration variable

        if (x < 1 || y < 1 || x > sizeX || y > sizeY) {
            return false; // Stop if out of bounds
        }
        if (board.getStone(x, y) === color) {
            return false; // Stop if other color found
        }
        if (!board.getStone(x, y)) {
            return true; // Stop and signal that liberty was found
        }
        for (i = 0; i < pending.length; i++) {
            if (pending[i].x === x && pending[i].y === y) {
                return false; // Stop if already in pending captures
            }
        }

        pending.push({ x: x, y: y }); // Add new stone into chain of pending captures

        // Recursively check for liberties and expand chain
        if (recursiveCapture(board, x - 1, y, color, pending) ||
            recursiveCapture(board, x + 1, y, color, pending) ||
            recursiveCapture(board, x, y - 1, color, pending) ||
            recursiveCapture(board, x, y + 1, color, pending)) {
                return true; // Stop and signal liberty found in subchain
        }
        return false; // Otherwise, no liberties found
    }

    // Get next to move
    root.nextMove = function() {
        var x, y, count = 0;
        if (this.lastMove) { // If a move has been played
            return -this.lastMove; // Then next is opposite of last move
        } else { // No moves have been played
            for (x = 1; x <= sizeX; x++) {
                for (y = 1; y <= sizeY; y++) {
                    // Counts up difference between black and white set stones
                    count += this.getStone(x, y);
                }
            }
            // White's turn if strictly more black stones are set
            return (count < 0) ? WHITE : BLACK;
        }
    };

    // Places a setup stone, returns true if successful
    root.placeSetup = function(x, y, color) {
        var prevColor = (this.parent && this.parent.getStone(x, y)) || EMPTY;

        if (x < 1 || y < 1 || x > sizeX || y > sizeY) {
            return false; // Do not allow out of bounds setup
        }
        if (!this.isMutable('setup') || this.getStone(x, y) === color) {
            // Prevent setup changes in immutable node or quit early if no change
            return false;
        }

        setStone(this, x, y, color); // Place the setup stone
        this.setupStones[ fromXY(x, y) ] = color - prevColor; // Record the necessary change
        return true;
    };

    // Adds markup, returns true if successful
    root.addMarkup = function(x, y, mark) {
        if (x < 1 || y < 1 || x > sizeX || y > sizeY) {
            return false; // Do not allow out of bounds markup
        }
        if (!this.parent && this.getMarkup(x, y) < 0) {
            // Avoids overwriting green with yellow in root
            return false;
        }
        this['markup' + x + '-' + y] = mark;
        return true;
    };

    // Returns the stone status of the given position
    root.getStone = function(x, y) {
        return this['board' + x + '-' + y] || EMPTY;
    };

    // Directly sets the stone state for the given game node
    function setStone(node, x, y, color) {
        node['board' + x + '-' + y] = color;
    }

    // Gets the setup stone placed at (x, y), returns false if none
    root.getSetup = function(x, y) {
        if (!this.setupStones[ fromXY(x, y) ]) { // No setup stone placed
            return false;
        } else { // Determine net effect of setup stone
            switch(this.getStone(x, y)) {
                case EMPTY:
                    return 'AE';
                case BLACK:
                    return 'AB';
                case WHITE:
                    return 'AW';
            }
        }
    };

    // Gets the markup at (x, y)
    root.getMarkup = function(x, y) {
        return this['markup' + x + '-' + y]  || EMPTY;
    };

    // Returns the best hint type
    root.getBestHint = function() {
        var i, j, mark, best = 4;
        for (i = 1; i <= sizeX; i++) {
            for (j = 1; j <= sizeY; j++) {
                mark = this.getMarkup(i, j);
                if (mark > 0 && mark < best) {
                    best = mark;
                }
            }
        }
        return (best < 4 ? best : 0);
    };


    // Determines the type of this node
    root.getType = function() {
        var i;

        if (this.move) { // Logged move implies move node
            return 'move';
        }

        for (i = 0; i < this.setupStones.length; i++) {
            if (this.setupStones[i]) { // Any setup stones implies setup node
                return 'setup';
            }
        }

        return 'empty'; // Otherwise, "empty" (neither move nor setup)
    };

    // Checks if this node can be modified by a 'type' action
    root.isMutable = function(type) {
        // Can only add a move to an empty node with no children
        if (type === 'move' && this.getType() === 'empty' && this.children.length === 0) {
            return true;
        }
        // Can only add setup stones to a non-move node with no children
        if (type === 'setup' && this.getType() !== 'move' && this.children.length === 0) {
            return true;
        }
        return false;
    };

    // Gets siblings of this node
    root.getSiblings = function() {
        return (this.parent && this.parent.children) || [];
    };

    // Makes a child node of this node, but does NOT add it to children
    root.makeChild = function() {
        var child = Object.create(this); // Child inherits properties
        initNode(child, this); // Initialize other properties

        return child;
    };

    // Adds a child to this node
    root.addChild = function(child) {
        this.children.push(child);
    };

    // Remove child node from this node, returning false if failed
    root.removeChild = function(child) {
        var i = this.children.indexOf(child);
        if (i !== -1) {
            this.children.splice(i, 1);
            return true;
        }
        return false;
    };

    // Raises child variation to a higher precedence
    root.promote = function(child) {
        var i = this.children.indexOf(child);
        if (i > 0) { // Child exists and not already first
            this.children[i] = this.children[i - 1];
            this.children[i - 1] = child;
            return true;
        }
        return false;
    };

    // Drops child variation to a lower precedence
    root.demote = function(child) {
        var i = this.children.indexOf(child);
        if (i !== -1 && i < this.children.length - 1) { // Child exists and not already last
            this.children[i] = this.children[i + 1];
            this.children[i + 1] = child;
            return true;
        }
        return false;
    };

    // Gets board size
    root.getSize = function() {
        return { x: sizeX, y: sizeY };
    };

    // Convert (x, y) coordinates to linear index
    function fromXY(x, y) {
        return (x - 1) * sizeY + (y - 1);
    }

    return root;
};

// Load a parsed SGF object into a game state tree
besogo.loadSgf = function(sgf, editor) {
    'use strict';
    var size = { x: 19, y: 19 }, // Default size (may be changed by load)
        root;

    loadRootProps(sgf); // Load size, variants style and game info
    root = besogo.makeGameRoot(size.x, size.y);

    loadNodeTree(sgf, root); // Load the rest of game tree
    editor.loadRoot(root); // Load root into the editor


    // Loads the game tree
    function loadNodeTree(sgfNode, gameNode) {
        var i, nextGameNode;

        // Load properties from the SGF node into the game state node
        for (i = 0; i < sgfNode.props.length; i++) {
            loadProp(gameNode, sgfNode.props[i]);
        }

        // Recursively load the rest of the tree
        for (i = 0; i < sgfNode.children.length; i++) {
            nextGameNode = gameNode.makeChild();
            gameNode.addChild(nextGameNode);
            loadNodeTree(sgfNode.children[i], nextGameNode);
        }
    }

    // Loads property into node
    function loadProp(node, prop) {
        var setupFunc = 'placeSetup',
            markupFunc = 'addMarkup',
            move;

        switch(prop.id) {
            case 'B': // Play a black move
                move = lettersToCoords(prop.values[0]);
                node.playMove(move.x, move.y, -1, true);
                break;
            case 'W': // Play a white move
                move = lettersToCoords(prop.values[0]);
                node.playMove(move.x, move.y, 1, true);
                break;
            case 'AB': // Setup black stones
                applyPointList(prop.values, node, setupFunc, -1);
                break;
            case 'AW': // Setup white stones
                applyPointList(prop.values, node, setupFunc, 1);
                break;
            case 'AE': // Setup empty stones
                applyPointList(prop.values, node, setupFunc, 0);
                break;
            case 'CR': // Add circle markup
                applyPointList(prop.values, node, markupFunc, 1);
                break;
            case 'SQ': // Add square markup
                applyPointList(prop.values, node, markupFunc, 2);
                break;
            case 'TR': // Add triangle markup
                applyPointList(prop.values, node, markupFunc, 3);
                break;
            case 'M': // Intentional fallthrough treats 'M' as 'MA'
            case 'MA': // Add 'X' cross markup
                applyPointList(prop.values, node, markupFunc, 4);
                break;
            case 'SL': // Add 'selected' (small filled square) markup
                applyPointList(prop.values, node, markupFunc, 5);
                break;
            case 'L': // Intentional fallthrough treats 'L' as 'LB'
            case 'LB': // Add label markup
                applyPointList(prop.values, node, markupFunc, 'label');
                break;
            case 'C': // Comment placed on node
                if (node.comment) {
                    node.comment += '\n' + prop.values.join().trim();
                } else {
                    node.comment = prop.values.join().trim();
                }
                break;
        }
    } // END function loadProp

    // Extracts point list and calls func on each
    // Set param to 'label' to signal handling of label markup property
    function applyPointList(values, node, func, param) {
        var i, x, y, // Scratch iteration variables
            point, // Current point in iteration
            otherPoint, // Bottom-right point of compressed point lists
            label; // Label extracted from value
        for (i = 0; i < values.length; i++) {
            point = lettersToCoords(values[i].slice(0, 2));
            if (param === 'label') { // Label markup property
                label = values[i].slice(3).replace(/\n/g, ' ');
                node[func](point.x, point.y, label); // Apply with extracted label
            } else { // Not a label markup property
                if (values[i].charAt(2) === ':') { // Expand compressed point list
                    otherPoint = lettersToCoords(values[i].slice(3));
                    if (otherPoint.x === point.x && otherPoint.y === point.y) {
                        // Redundant compressed pointlist
                        node[func](point.x, point.y, param);
                    } else if (otherPoint.x < point.x || otherPoint.y < point.y) {
                        // Only apply to corners if not arranged properly
                        node[func](point.x, point.y, param);
                        node[func](otherPoint.x, otherPoint.y, param);
                    } else { // Iterate over the compressed points
                        for (x = point.x; x <= otherPoint.x; x++) {
                            for (y = point.y; y <= otherPoint.y; y++) {
                                node[func](x, y, param);
                            }
                        }
                    }
                } else { // Apply on single point
                    node[func](point.x, point.y, param);
                }
            }
        }
    } // END function applyPointList

    // Loads root properties (size, variant style and game info)
    function loadRootProps(node) {
        var gameInfoIds = ['PB', 'BR', 'BT', 'PW', 'WR', 'WT', // Player info
                'HA', 'KM', 'RU', 'TM', 'OT', // Game parameters
                'DT', 'EV', 'GN', 'PC', 'RO', // Event info
                'GC', 'ON', 'RE', // General comments
                'AN', 'CP', 'SO', 'US' ], // IP credits
            gameInfo = {}, // Structure for game info properties
            i, id, value; // Scratch iteration variables

        for (i = 0; i < node.props.length; i++) {
            id = node.props[i].id; // Property ID
            value = node.props[i].values.join().trim(); // Join the values array
            if (id === 'SZ') { // Size property
                size = besogo.parseSize(value);
            } else if (id === 'ST') { // Style property
                editor.setVariantStyle( +value ); // Converts value to number
            } else if (gameInfoIds.indexOf(id) !== -1) { // Game info property
                if (id !== 'GC') { // Treat all but GC as simpletext
                    value = value.replace(/\n/g, ' '); // Convert line breaks to spaces
                }
                if (value) { // Skip load of empty game info strings
                    gameInfo[id] = value;
                }
            }
        }
        editor.setGameInfo(gameInfo);
    }

    // Converts letters to numerical coordinates
    function lettersToCoords(letters) {
        if (letters.match(/^[A-Za-z]{2}$/)) { // Verify input is two letters
            return {
                x: charToNum(letters.charAt(0)),
                y: charToNum(letters.charAt(1)) };
        } else { // Anything but two letters
            return { x: 0, y: 0 }; // Return (0, 0) coordinates
        }
    }

    function charToNum(c) { // Helper for lettersToCoords
        if ( c.match(/[A-Z]/) ) { // Letters A-Z to 27-52
            return c.charCodeAt(0) - 'A'.charCodeAt(0) + 27;
        } else { // Letters a-z to 1-26
            return c.charCodeAt(0) - 'a'.charCodeAt(0) + 1;
        }
    }
};

besogo.makeNamesPanel = function(container, editor) {
    'use strict';
    var playerBox = document.createElement('div'),
        whiteBox = document.createElement('div'),
        blackBox = document.createElement('div'),
        whiteInfo = document.createTextNode(''),
        blackInfo = document.createTextNode(''),
        whiteCaps = document.createElement('span'),
        blackCaps = document.createElement('span');

    playerBox.className = 'besogo-playerInfo';
    whiteBox.className = 'besogo-whiteInfo';
    blackBox.className = 'besogo-blackInfo';
    whiteCaps.className = 'besogo-whiteCaps';
    whiteCaps.title = 'White captures';
    blackCaps.className = 'besogo-blackCaps';
    blackCaps.title = 'Black captures';
    whiteBox.appendChild(whiteInfo);
    whiteBox.appendChild(whiteCaps);
    blackBox.appendChild(blackInfo);
    blackBox.appendChild(blackCaps);
    playerBox.appendChild(whiteBox);
    playerBox.appendChild(blackBox);
    container.appendChild(playerBox);

    editor.addListener(update);
    update({ navChange: true, gameInfo: editor.getGameInfo() });

    function update(msg) {
        var infoString, // Scratch string
            textNode,
            current,
            passFlag = 0;

        if (msg.gameInfo) {
            infoString = (msg.gameInfo.PW || 'White') + // White name
                ' (' + (msg.gameInfo.WR || '?') + ')' + // White rank
                (msg.gameInfo.WT ? ' ' + msg.gameInfo.WT : ''); // White team
            textNode = document.createTextNode(infoString);
            whiteBox.replaceChild(textNode, whiteInfo);
            whiteInfo = textNode;

            infoString = (msg.gameInfo.PB || 'Black') + // Black name
                ' (' + (msg.gameInfo.BR || '?') + ')' + // Black rank
                (msg.gameInfo.BT ? ' ' + msg.gameInfo.BT : ''); // Black team
            textNode = document.createTextNode(infoString);
            blackBox.replaceChild(textNode, blackInfo);
            blackInfo = textNode;
        }

        if (msg.navChange || msg.stoneChange) {
            current = editor.getCurrent();
            if (current.move && current.move.x === 0 && current.move.y === 0) {
                passFlag = current.move.color;
            }
            updateText(whiteCaps, (passFlag === 1 ? 'Passed  ' : '') + current.whiteCaps);
            updateText(blackCaps, current.blackCaps + (passFlag === -1 ? '  Passed' : ''));
        }
    }

    function updateText(parent, text) {
        var textNode = document.createTextNode(text);
        while (parent.firstChild) {
            parent.removeChild(parent.firstChild);
        }
        parent.appendChild(textNode);
    }
};

besogo.parseSgf = function(text) {
    'use strict';
    var at = 0, // Current position
        ch = text.charAt(at); // Current character at position

    findOpenParens(); // Find beginning of game tree
    return parseTree(); // Parse game tree

    // Builds and throws an error
    function error(msg) {
        throw {
            name: "Syntax Error",
            message: msg,
            at: at,
            text: text
        };
    }

    // Advances text position by one
    function next(check) {
        if (check && check !== ch) { // Verify current character if param given
            error( "Expected '" + check + "' instead of '" + ch + "'");
        }
        at++;
        ch = text.charAt(at);
        return ch;
    }

    // Skips over whitespace until non-whitespace found
    function white() {
        while (ch && ch <= ' ') {
            next();
        }
    }

    // Skips all chars until '(' or end found
    function findOpenParens() {
        while (ch && ch !== '(') {
            next();
        }
    }

    // Returns true if line break (CR, LF, CR+LF, LF+CR) found
    // Advances the cursor ONCE for double character (CR+LF, LF+CR) line breaks
    function lineBreak() {
        if (ch === '\n') { // Line Feed (LF)
            if (text.charAt(at + 1) === '\r') { // LF+CR, double character line break
                next(); // Advance cursor only once (pointing at second character)
            }
            return true;
        } else if (ch === '\r') { // Carriage Return (CR)
            if (text.charAt(at + 1) === '\n') { // CR+LF, double character line break
                next(); // Advance cursor only once (pointing at second character)
            }
            return true;
        }
        return false; // Did not find a line break or advance
    }

    // Parses a sub-tree of the game record
    function parseTree() {
        var rootNode, // Root of this sub-tree
            currentNode, // Pointer to parent of the next node
            nextNode; // Scratch for parsing the next node or sub-tree

        next('('); // Double-check opening parens at start of sub-tree
        white(); // Skip whitespace before root node

        if (ch !== ";") { // Error on sub-tree missing root node
            error("Sub-tree missing root");
        }
        rootNode = parseNode(); // Get the first node of this sub-tree
        white(); // Skip whitespace before parsing next node

        currentNode = rootNode; // Parent of the next node parsed
        while (ch === ';') { // Get sequence of nodes within this sub-tree
            nextNode = parseNode(); // Parse the next node
            // Add next node as child of current
            currentNode.children.push(nextNode);
            currentNode = nextNode; // Advance current pointer to this child
            white(); // Skip whitespace between/after sequence nodes
        }

        // Look for sub-trees of this sub-tree
        while (ch === "(") {
            nextNode = parseTree(); // Parse the next sub-tree
            // Add sub-tree as child of last sequence node
            currentNode.children.push(nextNode); // Do NOT advance current
            white(); // Skip whitespace between/after sub-trees
        }
        next(')'); // Expect closing parenthesis at end of this sub-tree

        return rootNode;
    }

    // Parses a node and its properties
    function parseNode() {
        var property, // Scratch for parsing properties
            node = { props: [], children: [] }; // Node to construct

        next(';'); // Double-check semi-colon at start of node
        white(); // Skip whitespace before properties
        // Parse properties until end of node detected
        while ( ch && ch !== ';' && ch !== '(' && ch !== ')') {
            property = parseProperty(); // Parse the property and values
            node.props.push(property); // Add property to node
            white(); // Skip whitespace between/after properties
        }

        return node;
    }

    // Parses a property and its values
    function parseProperty() {
        var property = { id: '', values: [] }; // Property to construct

        // Look for property ID within letters
        while ( ch && /[A-Za-z]/.test(ch) ) {
            if (/[A-Z]/.test(ch)) { // Ignores lower case letters
                property.id += ch; // Only adds upper case letters
            }
            next();
        }
        if (!property.id) { // Error if id empty
            error('Missing property ID');
        }

        white(); // Skip whitespace before values
        while(ch === '[') { // Look for values of this property
            property.values.push( parseValue() );
            white(); // Skip whitespace between/after values
        }
        if (property.values.length === 0) { // Error on empty list of values
            error('Missing property values');
        }

        return property;
    }

    // Parses a value
    function parseValue() {
        var value = '';
        next('['); // Double-check opening bracket at start of value

        // Read until end of value (unescaped closing bracket)
        while ( ch && ch !== ']' ) {
            if ( ch === '\\' ) { // Backslash escape handling
                next('\\');
                if (lineBreak()) { // Soft (escaped) line break
                    // Nothing, soft line breaks are removed
                } else if (ch <= ' ') { // Other whitespace
                    value += ' '; // Convert to space
                } else {
                    value += ch; // Pass other escaped characters verbatim
                }
            } else { // Non-escaped character
                if (lineBreak()) { // Hard (non-escaped) line break
                    value += '\n'; // Convert all new lines to just LF
                } else if (ch <= ' ') { // Other whitespace
                    value += ' '; // Convert to space
                } else {
                    value += ch; // Other characters
                }
            }
            next();
        }
        next(']'); // Expect closing bracket at end of value

        return value;
    }
};

besogo.exportPuzzles = function(editor) {
    'use strict';
    var i, sequences = [],
        leafs = getLeafs(editor.getRoot());
    for (i = 0; i < leafs.length; i++) {
        sequences.push(getMoveSequence(leafs[i]));
    }
    return 'var puzzles = \n' + JSON.stringify(shuffle(sequences));

    // Returns list of the leaf nodes in the game tree
    function getLeafs(node) {
        var i, leafs = [], children = node.children;
        if (children.length === 0) {
            return [node];
        } else {
            for (i = 0; i < children.length; i++) {
                leafs = leafs.concat(getLeafs(children[i]));
            }
        }
        return leafs;
    }

    // Return move sequence to reach this node
    function getMoveSequence(node) {
        var moves = [];
        while (node.move !== null) {
            moves.push({x : node.move.x, y : node.move.y});
            node = node.parent;
        }
        return moves.reverse();
    }

    function shuffle(array) {
        let currentIndex = array.length, randomIndex;
        while (currentIndex != 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    }
};

// Convert game state tree into SGF string
besogo.composeSgf = function(editor) {
    'use strict';
    return '(' + composeNode(editor.getRoot()) + ')';

    // Recursively composes game node tree
    function composeNode(tree) {
        var string = ';', // Node starts with semi-colon
            children = tree.children,
            i; // Scratch iteration variable

        if (!tree.parent) { // Null parent means node is root
            // Compose root-specific properties
            string += composeRootProps(tree);
        }
        string += composeNodeProps(tree); // Compose general properties

        // Recurse composition on child nodes
        if (children.length === 1) { // Continue sequence if only one child
            string += '\n' + composeNode(children[0]);
        } else if (children.length > 1) {
            for (i = 0; i < children.length; i++) {
                string += '\n(' + composeNode(children[i]) + ')';
            }
        }

        return string;
    }

    // Composes root specific properties
    function composeRootProps(tree) {
        var string = 'FF[4]GM[1]CA[UTF-8]AP[besogo:' + besogo.VERSION + ']',
            x = tree.getSize().x,
            y = tree.getSize().y,
            gameInfo = editor.getGameInfo(), // Game info structure
            hasGameInfo = false, // Flag for existence of game info
            id; // Scratch iteration variable

        if (x === y) { // Square board size
            string += 'SZ[' + x + ']';
        } else { // Non-square board size
            string += 'SZ[' + x + ':' + y + ']';
        }
        string += 'ST[' + editor.getVariantStyle() + ']\n'; // Line break after header

        for ( id in gameInfo ) { // Compose game info properties
            if (gameInfo.hasOwnProperty(id) && gameInfo[id]) { // Skip empty strings
                string += id + '[' + escapeText(gameInfo[id]) + ']';
                hasGameInfo = true;
            }
        }
        string += (hasGameInfo ? '\n' : ''); // Line break if game info exists

        return string;
    }

    // Composes other properties
    function composeNodeProps(node) {
        var string = '',
            props, // Scratch variable for property structures
            stone, i, j; // Scratch iteration variables

        // Compose either move or setup properties depending on type of node
        if (node.getType() === 'move') { // Compose move properties
            stone = node.move;
            string += (stone.color === 1) ? 'W' : 'B';
            string += '[' + coordsToLetters(stone.x, stone.y) + ']';
        } else if (node.getType() === 'setup') { // Compose setup properties
            props = { AB: [], AW: [], AE: [] };
            for (i = 1; i <= node.getSize().x; i++) {
                for (j = 1; j <= node.getSize().y; j++) {
                    stone = node.getSetup(i, j);
                    if (stone) { // If setup stone placed, add to structure
                        props[ stone ].push({ x: i, y: j });
                    }
                }
            }
            string += composePointLists(props);
        }

        // Compose markup properties
        props = { CR: [], SQ: [], TR: [], MA: [], SL: [], LB: [] };
        for (i = 1; i <= node.getSize().x; i++) {
            for (j = 1; j <= node.getSize().y; j++) {
                stone = node.getMarkup(i, j);
                if (stone) { // If markup placed
                    if (typeof stone === 'string') { // String is label mark
                        props.LB.push({ x: i, y: j, label: stone });
                    } else { // Numerical code for markup
                        // Convert numerical code to property ID
                        stone = (['CR', 'SQ', 'TR', 'MA', 'SL'])[stone - 1];
                        props[stone].push({ x: i, y: j });
                    }
                }
            }
        }
        string += composePointLists(props);

        if (node.comment) { // Compose comment property
            string += (string ? '\n' : ''); // Add line break if other properties exist
            string += 'C[' + escapeText(node.comment) + ']';
        }

        return string;
    } // END function composeNodeProps

    // Composes properties from structure of point lists
    // Each member should be an array of points for property ID = key
    // Each point should specify point with (x, y) and may have optional label
    function composePointLists(lists) {
        var string = '',
            id, points, i; // Scratch iteration variables

        for (id in lists) { // Object own keys specifies property IDs
            if (lists.hasOwnProperty(id)) {
                points = lists[id]; // Corresponding members are point lists
                if (points.length > 0) { // Only add property if list non-empty
                    string += id;
                    for (i = 0; i < points.length; i++) {
                        string += '[' + coordsToLetters(points[i].x, points[i].y);
                        if (points[i].label) { // Add optional composed label
                            string += ':' + escapeText(points[i].label);
                        }
                        string += ']';
                    }
                }
            }
        }
        return string;
    }

    // Escapes backslash and close bracket for text output
    function escapeText(input) {
        input = input.replace(/\\/g, '\\\\'); // Escape backslash
        return input.replace(/\]/g, '\\]'); // Escape close bracket
    }

    // Converts numerical coordinates to letters
    function coordsToLetters(x, y) {
        if (x === 0 || y === 0) {
            return '';
        } else {
            return numToChar(x) + numToChar(y);
        }
    }

    function numToChar(num) { // Helper for coordsToLetters
        if (num > 26) { // Numbers 27-52 to A-Z
            return String.fromCharCode('A'.charCodeAt(0) + num - 27);
        } else { // Numbers 1-26 to a-z
            return String.fromCharCode('a'.charCodeAt(0) + num - 1);
        }
    }
};

(function() { // SVG utilities
'use strict';

// Color palette
besogo.RED  = '#be0119'; // Darker red (marked variant)
besogo.LRED = '#ff474c'; // Lighter red (auto-marked variant)
besogo.BLUE = '#0165fc'; // Bright blue (last move)
besogo.PURP = '#9a0eea'; // Red + blue (variant + last move)
besogo.GREY = '#929591'; // Between white and black
besogo.GOLD = '#dbb40c'; // Tool selection
besogo.TURQ = '#06c2ac'; // Turqoise (nav selection)

besogo.BLACK_STONES = 4; // Number of black stone images
besogo.WHITE_STONES = 11; // Number of white stone images

// Makes an SVG element with given name and attributes
besogo.svgEl = function(name, attributes) {
    var attr, // Scratch iteration variable
        element = document.createElementNS("http://www.w3.org/2000/svg", name);

    for ( attr in (attributes || {}) ) { // Add attributes if supplied
        if (attributes.hasOwnProperty(attr)) {
            element.setAttribute(attr, attributes[attr]);
        }
    }
    return element;
};

// Makes an SVG group for containing the shadow layer
besogo.svgShadowGroup = function() {
    var group = besogo.svgEl('g'),
        filter = besogo.svgEl('filter', { id: 'blur' }),
        blur = besogo.svgEl('feGaussianBlur', {
            in: 'SourceGraphic',
            stdDeviation: '2'
        });

    filter.appendChild(blur);
    group.appendChild(filter);
    return group;
};

// Makes a stone shadow
besogo.svgShadow = function(x, y) {
    return besogo.svgEl("circle", {
        cx: x,
        cy: y,
        r: 43,
        stroke: 'none',
        fill: 'black',
        opacity: 0.32,
        filter: 'url(#blur)'
    });
};

// Makes a photo realistic stone element
besogo.realStone = function(x, y, color, index) {
    var element;

    if (color < 0) {
        color = 'black' + (index % besogo.BLACK_STONES);
    } else {
        color = 'white' + (index % besogo.WHITE_STONES);
    }
    color = 'img/' + color + '.png';

    element =  besogo.svgEl("image", {
        x: (x - 44),
        y: (y - 44),
        height: 88,
        width: 88
    });
    element.setAttributeNS('http://www.w3.org/1999/xlink', 'href', color);

    return element;
};

// Makes a stone element
besogo.svgStone = function(x, y, color) {
    var className = "besogo-svg-greyStone"; // Grey stone by default

    if (color === -1) { // Black stone
        className = "besogo-svg-blackStone";
    } else if (color === 1) { // White stone
        className = "besogo-svg-whiteStone";
    }

    return besogo.svgEl("circle", {
        cx: x,
        cy: y,
        r: 42,
        'class': className
    });
};

// Makes a circle at (x, y)
// NOTE: modified to make a green "correct" mark
besogo.svgCircle = function(x, y, color) {
    return besogo.svgEl("circle", {
        cx: x,
        cy: y,
        r: 38,
        fill: "none",
        'class': "besogo-svg-correct"
    });
};

// Makes a square at (x, y)
// NOTE: modified to make a yellow "hint" mark
besogo.svgSquare = function(x, y, color) {
    return besogo.svgEl("circle", {
        cx: x,
        cy: y,
        r: 38,
        fill: "none",
        'class': "besogo-svg-hint"
    });
};

// Makes an equilateral triangle at (x, y)
// NOTE: modified to make a red "miss" mark
besogo.svgTriangle = function(x, y, color) {
    var path = "m" + (x - 24) + "," + (y - 24) + "l48,48m0,-48l-48,48";

    return besogo.svgEl("path", {
        d: path,
        fill: "none",
        'class': "besogo-svg-miss"
    });
};

// Makes an "X" cross at (x, y)
besogo.svgCross = function(x, y, color) {
    var path = "m" + (x - 24) + "," + (y - 24) + "l48,48m0,-48l-48,48";

    return besogo.svgEl("path", {
        d: path,
        stroke: color,
        "stroke-width": 8,
        fill: "none"
    });
};

// Makes an "+" plus sign at (x, y)
besogo.svgPlus = function(x, y, color) {
    var path = "m" + x + "," + (y - 28) + "v56m-28,-28h56",
        attrs;
    attrs = {
        d: path,
        'class': "besogo-last-plus",
        "stroke-width": 8,
        fill: "none"
    };
    if (color) {
        attrs['stroke'] = color;
    }

    return besogo.svgEl("path", attrs);
};

// Makes a small filled square at (x, y)
besogo.svgBlock = function(x, y, color) {
    return besogo.svgEl("rect", {
        x: x - 18,
        y: y - 18,
        width: 36,
        height: 36,
        stroke: "none",
        "stroke-width": 8,
        fill: color
    });
};

// Makes a label at (x, y)
besogo.svgLabel = function(x, y, color, label) {
    var element,
        attrs,
        size;

    // Trims label to 3 characters
    if (label.length > 3) {
        label = label.slice(0, 2) + '…';
    }

    // Set font size according to label length
    switch(label.length) {
        case 1:
            size = 72;
            break;
        case 2:
            size = 56;
            break;
        case 3:
            size = 36;
            break;
    }

    attrs = {
        x: x,
        y: y,
        dy: ".65ex", // Seems to work for vertically centering these fonts
        "font-size": size,
        "text-anchor": "middle", // Horizontal centering
        "font-family": "Helvetica, Arial, sans-serif"
    };
    if (typeof color === 'number') {
        if (color < 0) {
            attrs["class"] = "besogo-black-label";
        } else if (color > 0) {
            attrs["class"] = "besogo-white-label";
        } else {
            attrs["class"] = "besogo-empty-label"
        }
    } else {
        attrs["class"] = "besogo-" + color + "-label";
    }

    element = besogo.svgEl("text", attrs);
    element.appendChild( document.createTextNode(label) );

    return element;
};

})(); // END closure

besogo.makeToolPanel = function(container, editor) {
    'use strict';
    var element, // Scratch for building SVG images
        svg, // Scratch for building SVG images
        labelText, // Text area for next label input
        selectors = {}; // Holds selection rects

    svg = makeButtonSVG('auto', 'Auto-play/navigate\n' +
        'crtl+click to force ko, suicide, overwrite\n' +
        'shift+click to jump to move'); // Auto-play/nav tool button
    svg.appendChild(makeYinYang(0, 0));

    // svg = makeButtonSVG('playB', 'Play black'); // Play black button
    // svg.appendChild(besogo.svgStone(0, 0, -1));

    // svg = makeButtonSVG('playW', 'Play white'); // Play white button
    // svg.appendChild(besogo.svgStone(0, 0, 1));

    svg = makeButtonSVG('addB', 'Set black\nctrl+click to play'); // Add black button
    element = besogo.svgEl('g');
    element.appendChild(besogo.svgStone(0, 0, -1)); // Black stone
    svg.appendChild(element);

    svg = makeButtonSVG('addW', 'Set white\nctrl+click to play'); // Add white button
    element = besogo.svgEl('g');
    element.appendChild(besogo.svgStone(0, 0, 1)); // White stone
    svg.appendChild(element);

    svg = makeButtonSVG('addE', 'Set empty point'); // Add empty button
    element = besogo.svgEl('g');
    element.appendChild(besogo.svgStone(0, 0)); // Grey stone
    element.appendChild(besogo.svgCross(0, 0, besogo.RED)); // Red cross
    svg.appendChild(element);

    svg = makeButtonSVG('circle', 'Circle'); // Circle markup button
    svg.appendChild(besogo.svgCircle(0, 0, 'black'));

    svg = makeButtonSVG('square', 'Square'); // Square markup button
    svg.appendChild(besogo.svgSquare(0, 0, 'black'));

    svg = makeButtonSVG('triangle', 'Triangle'); // Triangle markup button
    svg.appendChild(besogo.svgTriangle(0, 0, 'black'));

    svg = makeButtonSVG('cross', 'Cross'); // Cross markup button
    svg.appendChild(besogo.svgCross(0, 0, 'black'));

    svg = makeButtonSVG('block', 'Block'); // Block markup button
    svg.appendChild(besogo.svgBlock(0, 0, 'black'));

    svg = makeButtonSVG('clrMark', 'Clear mark'); // Clear markup button
    element = besogo.svgEl('g');
    element.appendChild(besogo.svgTriangle(0, 0, besogo.GREY));
    element.appendChild(besogo.svgCross(0, 0, besogo.RED));
    svg.appendChild(element);

    svg = makeButtonSVG('label', 'Label'); // Label markup button
    svg.appendChild(besogo.svgLabel(0, 0, 'empty', 'A1'));

    labelText = document.createElement("input"); // Label entry text field
    labelText.type = "text";
    labelText.title = 'Next label';
    labelText.onblur = function() {
        editor.setLabel(labelText.value);
    };
    labelText.addEventListener('keydown', function(evt) {
        evt = evt || window.event;
        evt.stopPropagation(); // Stop keydown propagation when in focus
    });
    container.appendChild(labelText);

    makeButtonText('Pass', 'Pass move', function(){
        var tool = editor.getTool();
        if (tool !== 'navOnly' && tool !== 'auto' && tool !== 'playB' && tool !== 'playW') {
            editor.setTool('auto'); // Ensures that a move tool is selected
        }
        editor.click(0, 0, false); // Clicking off the board signals a pass
    });

    makeButtonText('Raise', 'Raise variation', function(){
        editor.promote();
    });

    makeButtonText('Lower', 'Lower variation', function(){
        editor.demote();
    });

    makeButtonText('Cut', 'Remove branch', function(){
        editor.cutCurrent();
    });

    editor.addListener(toolStateUpdate); // Set up listener for tool state updates
    toolStateUpdate({ label: editor.getLabel(), tool: editor.getTool() }); // Initialize


    // Creates a button holding an SVG image
    function makeButtonSVG(tool, tooltip) {
        var button = document.createElement('button'),
            svg = besogo.svgEl('svg', { // Icon container
                width: '100%',
                height: '100%',
                viewBox: '-55 -55 110 110' }), // Centered on (0, 0)
            selected = besogo.svgEl("rect", { // Selection rectangle
                x: -50, // Center on (0, 0)
                y: -50,
                width: 100,
                height: 100,
                fill: 'none',
                'stroke-width': 8,
                stroke: besogo.GOLD,
                rx: 20, // Rounded rectangle
                ry: 20, // Thanks, Steve
                visibility: 'hidden'
            });

        container.appendChild(button);
        button.appendChild(svg);
        button.onclick = function() {
            if (tool === 'auto' && editor.getTool() === 'auto') {
                editor.setTool('navOnly');
            } else {
                editor.setTool(tool);
            }
        };
        button.title = tooltip;
        selectors[tool] = selected;
        svg.appendChild(selected);
        return svg; // Returns reference to the icon container
    }

    // Creates text button
    function makeButtonText(text, tip, callback) {
        var button = document.createElement('input');
        button.type = 'button';
        button.value = text;
        button.title = tip;
        button.onclick = callback;
        container.appendChild(button);
    }

    // Callback for updating tool state and label
    function toolStateUpdate(msg) {
        var tool;
        if (msg.label) {
            labelText.value = msg.label;
        }
        if (msg.tool) {
            for (tool in selectors) { // Update which tool is selected
                if (selectors.hasOwnProperty(tool)) {
                    if (msg.tool === tool) {
                        selectors[tool].setAttribute('visibility', 'visible');
                    } else {
                        selectors[tool].setAttribute('visibility', 'hidden');
                    }
                }
            }
        }
    }

    // Draws a yin yang
    function makeYinYang(x, y) {
        var element = besogo.svgEl('g');

        // Draw black half circle on right side
        element.appendChild( besogo.svgEl("path", {
            d: "m" + x + "," + (y - 44) + " a44 44 0 0 1 0,88z",
            stroke: "none",
            fill: "black"
        }));

        // Draw white part of ying yang on left side
        element.appendChild( besogo.svgEl("path", {
            d: "m" + x + "," + (y + 44) + "a44 44 0 0 1 0,-88a22 22 0 0 1 0,44z",
            stroke: "none",
            fill: "white"
        }));

        // Draw round part of black half of ying yang
        element.appendChild( besogo.svgEl("circle", {
            cx: x,
            cy: y + 22,
            r: 22,
            stroke: "none",
            fill: "black"
        }));

        return element;
    }
};

besogo.makeTreePanel = function(container, editor) {
    'use strict';
    var svg,
        pathGroup,
        bottomLayer,
        currentMarker,
        SCALE = 0.25; // Tree size scaling factor

    rebuildNavTree();
    editor.addListener(treeUpdate);


    // Callback for handling tree changes
    function treeUpdate(msg) {
        if (msg.treeChange) { // Tree structure changed
            rebuildNavTree(); // Rebuild entire tree
        } else if (msg.navChange) { // Only navigation changed
            updateCurrentMarker(); // Update current location marker
        } else if (msg.stoneChange) { // Only stones in current changed
            updateCurrentNodeIcon();
        }
    }

    // Updates the current marker in the tree
    function updateCurrentMarker() {
        var current = editor.getCurrent();

        setSelectionMarker(currentMarker);
        setCurrentMarker(current.navTreeMarker);
    }

    // Sets marker element to indicate the current node
    function setCurrentMarker(marker) {
        var width = container.clientWidth,
            height = container.clientHeight,
            top = container.scrollTop,
            left = container.scrollLeft,
            markX = (marker.getAttribute('x') - 5) * SCALE, // Computed position of marker
            markY = (marker.getAttribute('y') - 5) * SCALE,
            GRIDSIZE = 120 * SCALE; // Size of the square grid

        if (markX < left) { // Ensure horizontal visibility of current marker
            container.scrollLeft = markX;
        } else if (markX + GRIDSIZE > left + width) {
            container.scrollLeft = markX + GRIDSIZE - width;
        }
        if (markY < top) { // Ensure vertical visibility of current marker
            container.scrollTop = markY;
        } else if (markY + GRIDSIZE > top + height) {
            container.scrollTop = markY + GRIDSIZE - height;
        }

        marker.setAttribute('opacity', 0.5); // Always visible
        marker.onmouseover = null; // Clear hover over action
        marker.onmouseout = null; // Clear hover off action
        bottomLayer.appendChild(marker); // Moves marker to the background
        currentMarker = marker;
    }

    // Sets marker
    function setSelectionMarker(marker) {
        marker.setAttribute('opacity', 0); // Normally invisible
        marker.onmouseover = function() { // Show on hover over
            marker.setAttribute('opacity', 0.5);
        };
        marker.onmouseout = function() { // Hide on hover off
            marker.setAttribute('opacity', 0);
        };
        svg.appendChild(marker); // Move marker to foreground
    }

    // Rebuilds the entire navigation tree
    function rebuildNavTree() {
        var current = editor.getCurrent(), // Current location in game state tree
            root = editor.getRoot(), // Root node of game state
            nextOpen = [], // Tracks occupied grid positions
            oldSvg = svg, // Store the old SVG root
            background = besogo.svgEl("rect", { // Background color for tree
                height: '100%',
                width: '100%',
                'class': 'besogo-svg-board besogo-svg-backer'
            }),
            path, // Root path
            width, // Calculated dimensions of the SVG
            height;

        svg = besogo.svgEl("svg");
        bottomLayer = besogo.svgEl("g"); // Holder for the current marker
        pathGroup = besogo.svgEl("g"); // Holder for path elements

        svg.appendChild(background); // Background color first
        svg.appendChild(bottomLayer); // Bottom layer (for current marker) second
        svg.appendChild(pathGroup); // Navigation path third

        path = recursiveTreeBuild(root, 0, 0, nextOpen); // Build the tree
        pathGroup.appendChild(finishPath(path, 'black')); // Finish and add root path

        width = 120 * nextOpen.length; // Compute height and width of nav tree
        height = 120 * Math.max.apply(Math, nextOpen);
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        svg.setAttribute('height', height * SCALE); // Scale down the actual SVG size
        svg.setAttribute('width', width * SCALE);

        if (oldSvg) { // Replace SVG in container
            container.replaceChild(svg, oldSvg);
        } else { // SVG not yet added to container
            container.appendChild(svg);
        }

        setCurrentMarker(current.navTreeMarker); // Set current marker and ensure visible
    } // END function rebuildNavTree

    // Recursively builds the tree
    function recursiveTreeBuild(node, x, y, nextOpen) {
        var children = node.children,
            position,
            path,
            childPath,
            i; // Scratch iteration variable

        if (children.length === 0) { // Reached end of branch
            path = 'm' + svgPos(x) + ',' + svgPos(y); // Start path at end of branch
        } else { // Current node has children
            position = (nextOpen[x + 1] || 0); // First open spot in next column
            position = (position < y) ? y : position; // Bring level with current y

            if (y < position - 1) { // Check if first child natural drop > 1
                y = position - 1; // Bring current y within 1 of first child drop
            }
            // Place first child and extend path
            path = recursiveTreeBuild(children[0], x + 1, position, nextOpen) +
                extendPath(x, y, nextOpen);

            // Place other children (intentionally starting at i = 1)
            for (i = 1; i < children.length; i++) {
                position = nextOpen[x + 1];
                childPath = recursiveTreeBuild(children[i], x + 1, position, nextOpen) +
                    extendPath(x, y, nextOpen, position - 1);
                // End path at beginning of branch
                pathGroup.appendChild(finishPath(childPath, 'black'));
            }
        }
        svg.appendChild(makeNodeIcon(node, x, y));
        addSelectionMarker(node, x, y);

        nextOpen[x] = y + 1; // Claims (x, y)
        return path;
    } // END function recursiveTreeBuild

    function makeNodeIcon(node, x, y) { // Makes a node icon for the tree
        var element = besogo.svgEl("g"),
            color,
            hint = 0;

        if (node.move) {
            hint = node.getMarkup(node.move.x, node.move.y);
        }
        if (hint === 1 || hint < 0) {
            hint = besogo.svgCircle(svgPos(x), svgPos(y), color)
        } else if (hint === 2) {
            hint = besogo.svgSquare(svgPos(x), svgPos(y), color)
        } else if (hint === 3) {
            hint = besogo.svgTriangle(svgPos(x), svgPos(y), color)
        } else {
            hint = 0;
        }

        switch(node.getType()){
            case 'move': // Move node
                color = node.move.color;
                element.appendChild( besogo.svgStone(svgPos(x), svgPos(y), color) );
                element.appendChild( besogo.svgLabel(svgPos(x), svgPos(y), color, '' + node.moveNumber) );
                break;
            case 'setup': // Setup node
                element = besogo.svgEl("g");
                element.appendChild(besogo.svgStone(svgPos(x), svgPos(y))); // Grey stone
                element.appendChild(besogo.svgPlus(svgPos(x), svgPos(y), besogo.RED));
                break;
            default: // Empty node
                element = besogo.svgEl("g");
                element.appendChild(besogo.svgStone(svgPos(x), svgPos(y))); // Grey stone
        }

        if (hint) {
            element.appendChild(hint);
        }

        node.navTreeIcon = element; // Save icon reference in game state tree
        node.navTreeX = x; // Save position of the icon
        node.navTreeY = y;

        return element;
    } // END function makeNodeIcon

    function updateCurrentNodeIcon() { // Updates the current node icon
        var current = editor.getCurrent(), // Current location in game state tree
            oldIcon = current.navTreeIcon,
            newIcon = makeNodeIcon(current, current.navTreeX, current.navTreeY);
        svg.replaceChild(newIcon, oldIcon);
    }

    function addSelectionMarker(node, x, y) {
        var element = besogo.svgEl("rect", { // Create selection marker
            x: svgPos(x) - 55,
            y: svgPos(y) - 55,
            width: 110,
            height: 110,
            "class": "besogo-nav-select"
        });
        element.onclick = function() {
            editor.setCurrent(node);
        };

        node.navTreeMarker = element; // Save selection marker in node
        setSelectionMarker(element); // Add as and set selection marker properties
    }

    function extendPath(x, y, nextOpen, prevChildPos) { // Extends path from child to current
        var childPos = nextOpen[x + 1] - 1; // Position of child
        if (childPos === y) { // Child is horizontally level with current
            return 'h-120'; // Horizontal line back to current
        } else if (childPos === y + 1) { // Child is one drop from current
            return 'l-120,-120'; // Diagonal drop line back to current
        } else if (prevChildPos && prevChildPos !== y) {
            // Previous is already dropped, extend back to previous child drop line
            return 'l-60,-60v-' + (120 * (childPos - prevChildPos));
        } else { // Extend double-bend drop line back to parent
            return 'l-60,-60v-' + (120 * (childPos - y - 1)) + 'l-60,-60';
        }
    }

    function finishPath(path, color) { // Finishes path element
        var element = besogo.svgEl("path", {
            d: path,
            stroke: color,
            "stroke-width": 8,
            fill: "none"
        });
        return element;
    }

    function svgPos(x) { // Converts (x, y) coordinates to SVG position
        return (x * 120) + 60;
    }
};
